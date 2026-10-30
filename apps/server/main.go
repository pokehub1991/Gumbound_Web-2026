package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"gumbound-web/server/internal/auth"
	"gumbound-web/server/internal/db"
	"gumbound-web/server/internal/gateway"
	"gumbound-web/server/internal/lobby"
	"gumbound-web/server/internal/match"
)

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func main() {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "gumbound_s2_default_jwt_secret_key_2026_super_secure"
	}

	var userRepo auth.UserRepository
	pgConnStr := os.Getenv("DATABASE_URL")
	if pgConnStr != "" {
		sqlDB, err := db.ConnectPostgres(pgConnStr)
		if err != nil {
			log.Printf("PostgreSQL connection error: %v, falling back to in-memory store", err)
			userRepo = auth.NewInMemoryUserRepo()
		} else {
			userRepo = db.NewPostgresUserRepo(sqlDB)
		}
	} else {
		log.Println("No DATABASE_URL supplied, using thread-safe in-memory user repository")
		userRepo = auth.NewInMemoryUserRepo()
	}

	authService := auth.NewAuthService(userRepo, jwtSecret)

	// Seed default accounts so login works out of the box
	_, _ = authService.Register("player1", "GumboundPro", "player1@gunbound.local", "123456")
	_, _ = authService.Register("player2", "BoomerKing", "player2@gunbound.local", "123456")
	_, _ = authService.Register("admin", "GameMaster", "admin@gunbound.local", "admin123")
	log.Println("Seeded default test accounts: player1/123456, player2/123456, admin/admin123")

	authHandlers := auth.NewHandlers(authService)

	gw := gateway.NewGateway()
	authHandlers.RegisterWebSocketHandler(gw)

	lobbyManager := lobby.NewLobbyManager()
	lobbyManager.RegisterHandlers(gw)

	matchManager := match.NewMatchManager(lobbyManager)
	matchManager.RegisterHandlers(gw)

	http.HandleFunc("/health", withCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","version":"2026.1","active_conns":%d}`, gw.ActiveConnectionCount())
	}))

	http.HandleFunc("/api/register", withCORS(authHandlers.HandleRegister))
	http.HandleFunc("/api/login", withCORS(authHandlers.HandleLogin))
	http.HandleFunc("/ws", gw.HandleWebSocket)

	port := ":8080"
	log.Printf("Gumbound Web 2026 Server running on http://localhost%s (WS: /ws)\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
