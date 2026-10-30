package db

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
	"gumbound-web/server/internal/auth"
)

type PostgresUserRepo struct {
	db *sql.DB
}

func NewPostgresUserRepo(db *sql.DB) *PostgresUserRepo {
	return &PostgresUserRepo{db: db}
}

func ConnectPostgres(connStr string) (*sql.DB, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("error opening db connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("error pinging postgres: %w", err)
	}

	log.Println("PostgreSQL connection established successfully")
	return db, nil
}

func (r *PostgresUserRepo) Create(u *auth.User) error {
	query := `
		INSERT INTO users (id, username, nickname, email, password_hash, gold, gp, wins, losses, authority)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.Exec(query, u.ID, u.Username, u.Nickname, u.Email, u.PasswordHash, u.Gold, u.GP, u.Wins, u.Losses, u.Authority)
	return err
}

func (r *PostgresUserRepo) FindByUsername(username string) (*auth.User, error) {
	query := `
		SELECT id, username, nickname, email, password_hash, gold, gp, wins, losses, authority, created_at
		FROM users WHERE username = $1
	`
	row := r.db.QueryRow(query, username)
	var u auth.User
	err := row.Scan(&u.ID, &u.Username, &u.Nickname, &u.Email, &u.PasswordHash, &u.Gold, &u.GP, &u.Wins, &u.Losses, &u.Authority, &u.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, auth.ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *PostgresUserRepo) FindByID(id string) (*auth.User, error) {
	query := `
		SELECT id, username, nickname, email, password_hash, gold, gp, wins, losses, authority, created_at
		FROM users WHERE id = $1
	`
	row := r.db.QueryRow(query, id)
	var u auth.User
	err := row.Scan(&u.ID, &u.Username, &u.Nickname, &u.Email, &u.PasswordHash, &u.Gold, &u.GP, &u.Wins, &u.Losses, &u.Authority, &u.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, auth.ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

