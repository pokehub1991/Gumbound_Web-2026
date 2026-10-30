package auth

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	ErrUserExists   = errors.New("user already exists")
	ErrUserNotFound = errors.New("user not found")
	ErrInvalidPass  = errors.New("invalid credentials")
)

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	Nickname     string    `json:"nickname"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Gold         int       `json:"gold"`
	GP           int       `json:"gp"`
	Wins         int       `json:"wins"`
	Losses       int       `json:"losses"`
	Authority    int       `json:"authority"`
	CreatedAt    time.Time `json:"created_at"`
}

type UserRepository interface {
	Create(u *User) error
	FindByUsername(username string) (*User, error)
	FindByID(id string) (*User, error)
}

type InMemoryUserRepo struct {
	usersByID map[string]*User
	usersByName map[string]*User
	mu sync.RWMutex
}

func NewInMemoryUserRepo() *InMemoryUserRepo {
	return &InMemoryUserRepo{
		usersByID:   make(map[string]*User),
		usersByName: make(map[string]*User),
	}
}

func (r *InMemoryUserRepo) Create(u *User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.usersByName[u.Username]; exists {
		return ErrUserExists
	}

	r.usersByID[u.ID] = u
	r.usersByName[u.Username] = u
	return nil
}

func (r *InMemoryUserRepo) FindByUsername(username string) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	user, exists := r.usersByName[username]
	if !exists {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (r *InMemoryUserRepo) FindByID(id string) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	user, exists := r.usersByID[id]
	if !exists {
		return nil, ErrUserNotFound
	}
	return user, nil
}

type AuthService struct {
	repo      UserRepository
	jwtSecret string
}

func NewAuthService(repo UserRepository, jwtSecret string) *AuthService {
	return &AuthService{
		repo:      repo,
		jwtSecret: jwtSecret,
	}
}

func (s *AuthService) Register(username, nickname, email, password string) (*User, error) {
	if len(username) < 3 || len(password) < 6 {
		return nil, fmt.Errorf("username must be at least 3 chars, password at least 6")
	}

	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	user := &User{
		ID:           uuid.New().String(),
		Username:     username,
		Nickname:     nickname,
		Email:        email,
		PasswordHash: hash,
		Gold:         10000,
		GP:           0,
		Wins:         0,
		Losses:       0,
		Authority:    1,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.Create(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *AuthService) Login(username, password string) (string, error) {
	user, err := s.repo.FindByUsername(username)
	if err != nil {
		return "", ErrInvalidPass
	}

	if !VerifyPassword(password, user.PasswordHash) {
		return "", ErrInvalidPass
	}

	return IssueToken(user.ID, user.Username, s.jwtSecret)
}

func (s *AuthService) ValidateToken(token string) (*Claims, error) {
	return ParseToken(token, s.jwtSecret)
}
