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
)

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
	authHandlers := auth.NewHandlers(authService)

	gw := gateway.NewGateway()
	authHandlers.RegisterWebSocketHandler(gw)

	lobbyManager := lobby.NewLobbyManager()
	lobbyManager.RegisterHandlers(gw)

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","version":"2026.1","active_conns":%d}`, gw.ActiveConnectionCount())
	})

	http.HandleFunc("/api/register", authHandlers.HandleRegister)
	http.HandleFunc("/api/login", authHandlers.HandleLogin)
	http.HandleFunc("/ws", gw.HandleWebSocket)

	port := ":8080"
	log.Printf("Gumbound Web 2026 Server running on http://localhost%s (WS: /ws)\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
