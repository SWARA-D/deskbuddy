-- DeskBuddy Database Initialization (PostgreSQL)
-- v2 — adds journal_analyses columns inline on journal_entries
--      (single table, easier for Next.js API routes without a microservice layer)

------------------------------------------------------------
-- Create databases
------------------------------------------------------------
CREATE DATABASE deskbuddy_auth;
CREATE DATABASE deskbuddy_journal;
CREATE DATABASE deskbuddy_tasks;
CREATE DATABASE deskbuddy_checkin;

------------------------------------------------------------
-- Auth Database
------------------------------------------------------------
\connect deskbuddy_auth

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

------------------------------------------------------------
-- Journal Database  (entries + analysis in one table)
------------------------------------------------------------
\connect deskbuddy_journal

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS journal_entries (
    id           UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID      NOT NULL,
    text         TEXT      NOT NULL,
    input_type   VARCHAR(20) DEFAULT 'typed',
    -- analysis columns (populated after AI analysis)
    sentiment    VARCHAR(20)  DEFAULT NULL,
    emotion      VARCHAR(32)  DEFAULT NULL,
    confidence   FLOAT        DEFAULT NULL,
    mood_summary TEXT         DEFAULT NULL,
    created_at   TIMESTAMP  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user
    ON journal_entries(user_id, created_at DESC);

-- Run this if you already have the old schema (idempotent):
-- ALTER TABLE journal_entries
--     ADD COLUMN IF NOT EXISTS sentiment    VARCHAR(20),
--     ADD COLUMN IF NOT EXISTS emotion      VARCHAR(32),
--     ADD COLUMN IF NOT EXISTS confidence   FLOAT,
--     ADD COLUMN IF NOT EXISTS mood_summary TEXT;

------------------------------------------------------------
-- Tasks Database
------------------------------------------------------------
\connect deskbuddy_tasks

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tasks (
    id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID         NOT NULL,
    title      VARCHAR(200) NOT NULL,
    category   VARCHAR(64),
    difficulty SMALLINT     DEFAULT 1,
    status     VARCHAR(20)  DEFAULT 'todo',
    due_at     TIMESTAMP    NOT NULL,
    created_at TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, due_at);

------------------------------------------------------------
-- Checkin Database
------------------------------------------------------------
\connect deskbuddy_checkin

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS daily_checkins (
    id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID    NOT NULL,
    checkin_date DATE    NOT NULL,
    caption      TEXT,
    photo_url    VARCHAR(500),
    created_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_checkins_user
    ON daily_checkins(user_id, checkin_date DESC);