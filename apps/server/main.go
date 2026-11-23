package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"gumbound-web/server/internal/auth"
	"gumbound-web/server/internal/db"
	"gumbound-web/server/internal/gateway"
	"gumbound-web/server/internal/lobby"
	"gumbound-web/server/internal/match"
)

// allowedOrigins returns the CORS/WS origin allowlist from ALLOWED_ORIGIN
// (comma-separated). Empty list falls back to the requesting origin in dev
// mode only (GO_ENV != "production").
func allowedOrigins() []string {
	var out []string
	for _, o := range strings.Split(os.Getenv("ALLOWED_ORIGIN"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			out = append(out, o)
		}
	}
	return out
}

func originAllowed(origin string, allow []string) bool {
	if origin == "" {
		return true // non-browser clients (curl, server-to-server) have no Origin
	}
	for _, a := range allow {
		if a == origin {
			return true
		}
	}
	if len(allow) == 0 && os.Getenv("GO_ENV") != "production" {
		return true // permissive only outside production
	}
	return false
}

func withSecurityHeaders(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy",
			"default-src 'self'; script-src 'self' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: blob:; font-src 'self'; connect-src 'self' data: blob: ws: wss: http://localhost:8080 http://127.0.0.1:8080 ws://localhost:8080 ws://127.0.0.1:8080; "+
				"object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
		next(w, r)
	}
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	allow := allowedOrigins()
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := originAllowed(origin, allow)
		if allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}
		if r.Method == http.MethodOptions {
			if !allowed {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func main() {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is required; refusing to start with a default secret")
	}
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET must be at least 32 characters")
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

	// Seed accounts only for local development; never enable in production.
	if os.Getenv("SEED_ACCOUNTS") == "1" {
		_, _ = authService.Register("player1", "GumboundPro", "player1@gunbound.local", "123456")
		_, _ = authService.Register("player2", "BoomerKing", "player2@gunbound.local", "123456")
		_, _ = authService.Register("admin", "GameMaster", "admin@gunbound.local", "admin123")
		log.Println("Seeded development accounts: player1/123456, player2/123456, admin/admin123")
	}

	authHandlers := auth.NewHandlers(authService)

	gw := gateway.NewGateway()
	authHandlers.RegisterWebSocketHandler(gw)

	lobbyManager := lobby.NewLobbyManager()
	lobbyManager.RegisterHandlers(gw)

	matchManager := match.NewMatchManager(lobbyManager)
	matchManager.RegisterHandlers(gw)

	http.HandleFunc("/health", withSecurityHeaders(withCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","version":"2026.1","active_conns":%d}`, gw.ActiveConnectionCount())
	})))

	http.HandleFunc("/api/register", withSecurityHeaders(withCORS(authHandlers.HandleRegister)))
	http.HandleFunc("/api/login", withSecurityHeaders(withCORS(authHandlers.HandleLogin)))
	http.HandleFunc("/ws", gw.HandleWebSocket)

	// Serve static client build if present
	distDir := "../client/dist"
	if _, err := os.Stat(distDir); err == nil {
		fs := http.FileServer(http.Dir(distDir))
		http.Handle("/", withSecurityHeaders(fs.ServeHTTP))
		log.Printf("Serving client UI from %s\n", distDir)
	}

	// Optional TLS termination. Set TLS_CERT/TLS_KEY to serve WSS/HTTPS directly;
	// otherwise a reverse proxy in front is expected to terminate TLS.
	port := ":8080"
	cert, key := os.Getenv("TLS_CERT"), os.Getenv("TLS_KEY")
	srv := &http.Server{Addr: port, Handler: nil}
	if cert != "" && key != "" {
		log.Printf("Gumbound Web 2026 Server running on https://localhost%s (WSS: /ws)\n", port)
		if err := srv.ListenAndServeTLS(cert, key); err != nil {
			log.Fatalf("Server failed to start: %v", err)
		}
		return
	}
	if os.Getenv("GO_ENV") == "production" {
		log.Println("WARNING: running without TLS in production; terminate TLS at a reverse proxy")
	}
	log.Printf("Gumbound Web 2026 Server running on http://localhost%s (WS: /ws)\n", port)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
