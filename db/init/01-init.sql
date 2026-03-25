-- DeskBuddy Database Initialization (PostgreSQL / Supabase)
-- Uses schemas instead of separate databases (Supabase compatible)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

------------------------------------------------------------
-- Auth Schema
------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth_db;

CREATE TABLE IF NOT EXISTS auth_db.users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON auth_db.users(email);

------------------------------------------------------------
-- Journal Schema
------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS journal_db;

CREATE TABLE IF NOT EXISTS journal_db.journal_entries (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        NOT NULL,
    text         TEXT        NOT NULL,
    input_type   VARCHAR(20) DEFAULT 'typed',
    sentiment    VARCHAR(20) DEFAULT NULL,
    emotion      VARCHAR(32) DEFAULT NULL,
    confidence   FLOAT       DEFAULT NULL,
    mood_summary TEXT        DEFAULT NULL,
    created_at   TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user
    ON journal_db.journal_entries(user_id, created_at DESC);

------------------------------------------------------------
-- Tasks Schema
------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS tasks_db;

CREATE TABLE IF NOT EXISTS tasks_db.tasks (
    id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID         NOT NULL,
    title      VARCHAR(200) NOT NULL,
    category   VARCHAR(64),
    difficulty SMALLINT     DEFAULT 1,
    status     VARCHAR(20)  DEFAULT 'todo',
    due_at     TIMESTAMP    NOT NULL,
    created_at TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks_db.tasks(user_id, due_at);

------------------------------------------------------------
-- Checkin Schema
------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS checkin_db;

CREATE TABLE IF NOT EXISTS checkin_db.daily_checkins (
    id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID    NOT NULL,
    checkin_date DATE    NOT NULL,
    caption      TEXT,
    photo_url    VARCHAR(500),
    created_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_checkins_user
    ON checkin_db.daily_checkins(user_id, checkin_date DESC);
