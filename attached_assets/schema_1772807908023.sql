-- ============================================================
-- KINETIC INTEGRITY MONITOR - FREE TO PRO UPGRADE SCHEMA
-- Generated: 2026-03-06
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: users
-- Stores all registered users with subscription information
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email                 VARCHAR(255) NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    subscription_tier     VARCHAR(20)  NOT NULL DEFAULT 'free'
                            CHECK (subscription_tier IN ('free', 'pro')),
    subscription_status   VARCHAR(20)  NOT NULL DEFAULT 'active'
                            CHECK (subscription_status IN ('active', 'cancelled', 'past_due')),
    sellar_customer_id    VARCHAR(255) DEFAULT NULL,
    sellar_subscription_id VARCHAR(255) DEFAULT NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    upgraded_at           TIMESTAMPTZ  DEFAULT NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_unique UNIQUE (email)
);

COMMENT ON TABLE  users                        IS 'Registered users with subscription data';
COMMENT ON COLUMN users.id                     IS 'UUID primary key';
COMMENT ON COLUMN users.subscription_tier      IS 'Current plan: free (5 agents) or pro (unlimited)';
COMMENT ON COLUMN users.subscription_status    IS 'Billing status of subscription';
COMMENT ON COLUMN users.sellar_customer_id     IS 'Sellar platform customer identifier';
COMMENT ON COLUMN users.sellar_subscription_id IS 'Sellar recurring subscription identifier';
COMMENT ON COLUMN users.upgraded_at            IS 'Timestamp when user first upgraded to Pro; NULL if still free';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: agents
-- Stores all AI agents owned by users
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID         NOT NULL,
    name            VARCHAR(255) NOT NULL CHECK (length(trim(name)) >= 1),
    framework       VARCHAR(50)  NOT NULL DEFAULT 'custom'
                      CHECK (framework IN ('langchain', 'crewai', 'custom')),
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'paused', 'terminated')),
    entropy_score   DECIMAL(5,4) NOT NULL DEFAULT 0.0
                      CHECK (entropy_score >= 0 AND entropy_score <= 1),
    tokens_consumed BIGINT       NOT NULL DEFAULT 0
                      CHECK (tokens_consumed >= 0),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT agents_user_fk FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE  agents               IS 'AI agents registered by users';
COMMENT ON COLUMN agents.user_id       IS 'Owner of this agent (FK → users)';
COMMENT ON COLUMN agents.framework     IS 'Agent framework: langchain, crewai, or custom';
COMMENT ON COLUMN agents.entropy_score IS 'Behavioral entropy score 0.0–1.0';
COMMENT ON COLUMN agents.tokens_consumed IS 'Cumulative token usage by this agent';

CREATE TRIGGER agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_user_id   ON agents (user_id);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_status     ON agents (status);

-- ============================================================
-- TABLE: subscription_changes
-- Immutable audit trail of all tier changes (write-once)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_changes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         NOT NULL,
    old_tier    VARCHAR(20)  NOT NULL CHECK (old_tier IN ('free', 'pro')),
    new_tier    VARCHAR(20)  NOT NULL CHECK (new_tier IN ('free', 'pro')),
    changed_by  VARCHAR(20)  NOT NULL CHECK (changed_by IN ('system', 'user', 'admin')),
    reason      TEXT         NOT NULL,
    changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT subscription_changes_user_fk FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE subscription_changes IS 'Write-once audit log of subscription tier changes';

-- Prevent UPDATE on this table (write-once semantics)
CREATE OR REPLACE RULE subscription_changes_no_update AS
    ON UPDATE TO subscription_changes DO INSTEAD NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sub_changes_user_id    ON subscription_changes (user_id);
CREATE INDEX IF NOT EXISTS idx_sub_changes_changed_at ON subscription_changes (changed_at DESC);

-- ============================================================
-- INDEXES on users table
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email              ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_sellar_customer    ON users (sellar_customer_id) WHERE sellar_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier  ON users (subscription_tier);

-- ============================================================
-- SEED DATA (testing only — remove in production)
-- ============================================================
-- Test free user (password: testpass123)
INSERT INTO users (id, email, password_hash, subscription_tier, subscription_status)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'free@example.com',
    '$2b$10$examplehashforfreeuser00000000000000000000000000',
    'free',
    'active'
) ON CONFLICT DO NOTHING;

-- Test pro user (password: testpass123)
INSERT INTO users (id, email, password_hash, subscription_tier, subscription_status, upgraded_at)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'pro@example.com',
    '$2b$10$examplehashforprouserooo000000000000000000000000',
    'pro',
    'active',
    NOW()
) ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRATION INSTRUCTIONS (for existing databases)
-- ============================================================
-- If upgrading from an existing schema without subscription columns:
--
-- ALTER TABLE users
--   ADD COLUMN IF NOT EXISTS subscription_tier    VARCHAR(20) NOT NULL DEFAULT 'free'
--       CHECK (subscription_tier IN ('free', 'pro')),
--   ADD COLUMN IF NOT EXISTS subscription_status  VARCHAR(20) NOT NULL DEFAULT 'active'
--       CHECK (subscription_status IN ('active', 'cancelled', 'past_due')),
--   ADD COLUMN IF NOT EXISTS sellar_customer_id    VARCHAR(255) DEFAULT NULL,
--   ADD COLUMN IF NOT EXISTS sellar_subscription_id VARCHAR(255) DEFAULT NULL,
--   ADD COLUMN IF NOT EXISTS upgraded_at           TIMESTAMPTZ DEFAULT NULL;
--
-- -- Backfill existing users to free tier
-- UPDATE users SET subscription_tier = 'free', subscription_status = 'active'
--   WHERE subscription_tier IS NULL;
