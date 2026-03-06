-- ============================================================
-- KINETIC INTEGRITY MONITOR — AUTHENTICATION SCHEMA
-- Generated: 2026-03-06
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: users (extended with auth fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                     VARCHAR(255) UNIQUE NOT NULL,
    password_hash             VARCHAR(255) NOT NULL,
    subscription_tier         VARCHAR(50)  NOT NULL DEFAULT 'free',
    subscription_status       VARCHAR(50)  NOT NULL DEFAULT 'active',
    sellar_customer_id        VARCHAR(255) DEFAULT NULL,
    sellar_subscription_id    VARCHAR(255) DEFAULT NULL,
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    upgraded_at               TIMESTAMPTZ  DEFAULT NULL,
    last_login_at             TIMESTAMPTZ  DEFAULT NULL,
    login_attempt_count       INTEGER      NOT NULL DEFAULT 0,
    login_attempt_reset_at    TIMESTAMPTZ  DEFAULT NULL,
    account_locked_until      TIMESTAMPTZ  DEFAULT NULL,
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT password_length     CHECK (LENGTH(password_hash) > 0),
    CONSTRAINT valid_tier          CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    CONSTRAINT valid_status        CHECK (subscription_status IN ('active', 'cancelled', 'past_due'))
);

COMMENT ON COLUMN users.login_attempt_count    IS 'Consecutive failed login attempts (reset on success)';
COMMENT ON COLUMN users.login_attempt_reset_at IS 'When to reset the attempt counter (15 min window)';
COMMENT ON COLUMN users.account_locked_until   IS 'If set and in future, account is locked from login';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_users_email      ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

-- ============================================================
-- TABLE: password_resets
-- ============================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ  DEFAULT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT token_not_empty CHECK (LENGTH(token) > 0)
);

COMMENT ON TABLE password_resets IS 'Single-use password reset tokens, expire in 1 hour';

CREATE INDEX IF NOT EXISTS idx_password_resets_token      ON password_resets (token);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets (expires_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id    ON password_resets (user_id);

-- ============================================================
-- TABLE: auth_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
    email         VARCHAR(255),
    event_type    VARCHAR(50)  NOT NULL,
    success       BOOLEAN      NOT NULL DEFAULT FALSE,
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    error_message TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_event CHECK (event_type IN (
        'signup', 'login', 'logout', 'password_change',
        'password_reset_request', 'password_reset_complete', 'refresh_token'
    ))
);

COMMENT ON TABLE auth_logs IS 'Immutable audit trail of all authentication events';

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id    ON auth_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_email      ON auth_logs (email);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type ON auth_logs (event_type);

-- ============================================================
-- MIGRATION: Add auth columns to existing users table
-- Run this if upgrading from the original schema
-- ============================================================
-- ALTER TABLE users
--   ADD COLUMN IF NOT EXISTS last_login_at          TIMESTAMPTZ DEFAULT NULL,
--   ADD COLUMN IF NOT EXISTS login_attempt_count    INTEGER     NOT NULL DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS login_attempt_reset_at TIMESTAMPTZ DEFAULT NULL,
--   ADD COLUMN IF NOT EXISTS account_locked_until   TIMESTAMPTZ DEFAULT NULL;
