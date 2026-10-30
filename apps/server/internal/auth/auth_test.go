package auth

import (
	"testing"
)

func TestHashAndVerifyPassword(t *testing.T) {
	pass := "SecureGunbound2026!"
	hash, err := HashPassword(pass)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	if !VerifyPassword(pass, hash) {
		t.Error("expected correct password to verify, got false")
	}

	if VerifyPassword("WrongPassword123", hash) {
		t.Error("expected wrong password to fail, got true")
	}
}

func TestJWTIssueAndValidate(t *testing.T) {
	jwtSecret := "test_secret_key_gunbound_2026_super_long"
	authSvc := NewAuthService(NewInMemoryUserRepo(), jwtSecret)

	user, err := authSvc.Register("player1", "ProPlayer", "player1@test.com", "pass123456")
	if err != nil {
		t.Fatalf("registration failed: %v", err)
	}

	token, err := authSvc.Login("player1", "pass123456")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	claims, err := authSvc.ValidateToken(token)
	if err != nil {
		t.Fatalf("failed to validate token: %v", err)
	}

	if claims.UserID != user.ID {
		t.Errorf("expected user ID %s, got %s", user.ID, claims.UserID)
	}

	if claims.Username != "player1" {
		t.Errorf("expected username 'player1', got '%s'", claims.Username)
	}
}

