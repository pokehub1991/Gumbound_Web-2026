package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestOriginAllowed(t *testing.T) {
	os.Unsetenv("GO_ENV")

	os.Setenv("ALLOWED_ORIGIN", "https://game.example.com, https://www.example.com")
	defer os.Unsetenv("ALLOWED_ORIGIN")
	allow := allowedOrigins()

	if !originAllowed("https://game.example.com", allow) {
		t.Fatal("listed origin must pass")
	}
	if originAllowed("https://evil.example.com", allow) {
		t.Fatal("unlisted origin must be rejected")
	}
	if !originAllowed("", allow) {
		t.Fatal("empty Origin (non-browser) must pass")
	}

	os.Unsetenv("ALLOWED_ORIGIN")
	empty := allowedOrigins()
	os.Setenv("GO_ENV", "development")
	defer os.Unsetenv("GO_ENV")
	if !originAllowed("https://anything.test", empty) {
		t.Fatal("empty allowlist + non-production must be permissive")
	}
	os.Setenv("GO_ENV", "production")
	defer os.Unsetenv("GO_ENV")
	if originAllowed("https://anything.test", empty) {
		t.Fatal("empty allowlist + production must be strict")
	}
}

func TestSecurityHeadersPresent(t *testing.T) {
	h := withSecurityHeaders(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	for _, name := range []string{
		"X-Content-Type-Options",
		"X-Frame-Options",
		"Referrer-Policy",
		"Content-Security-Policy",
	} {
		if rec.Header().Get(name) == "" {
			t.Errorf("missing security header: %s", name)
		}
	}
}

func TestCORSPreflightUsesConfiguredOrigin(t *testing.T) {
	os.Setenv("ALLOWED_ORIGIN", "https://game.example.com")
	defer os.Unsetenv("ALLOWED_ORIGIN")
	os.Unsetenv("GO_ENV")

	called := false
	h := withCORS(func(w http.ResponseWriter, r *http.Request) { called = true })
	req := httptest.NewRequest(http.MethodOptions, "/api/login", nil)
	req.Header.Set("Origin", "https://game.example.com")
	rec := httptest.NewRecorder()
	h(rec, req)

	if called {
		t.Fatal("preflight must short-circuit handler")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://game.example.com" {
		t.Fatalf("CORS reflected origin mismatch: %q", got)
	}
	if strings.Contains(rec.Header().Get("Access-Control-Allow-Origin"), "*") {
		t.Fatal("CORS must not use wildcard")
	}
	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status: got %d want 204", rec.Code)
	}
}

func TestCORSPreflightUnlistedOrigin(t *testing.T) {
	os.Setenv("ALLOWED_ORIGIN", "https://game.example.com")
	defer os.Unsetenv("ALLOWED_ORIGIN")
	os.Setenv("GO_ENV", "production")
	defer os.Unsetenv("GO_ENV")

	h := withCORS(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler must not run when origin is not allowed")
	})
	req := httptest.NewRequest(http.MethodOptions, "/api/login", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("unlisted origin must not get CORS grant in production")
	}
}
