CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(16) UNIQUE NOT NULL,
    nickname VARCHAR(16) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    country CHAR(3) DEFAULT '',
    gold INTEGER DEFAULT 10000,
    gp INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 1000,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    authority SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

