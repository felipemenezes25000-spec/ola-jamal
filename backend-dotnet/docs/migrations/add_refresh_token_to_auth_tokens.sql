-- Migration: Add refresh token columns to auth_tokens table
-- Purpose: Support token refresh flow (refresh token rotation)
-- Date: 2026-03-19

ALTER TABLE auth_tokens
    ADD COLUMN IF NOT EXISTS refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;

-- Index for fast lookup by refresh_token (used in POST /api/auth/refresh)
CREATE INDEX IF NOT EXISTS idx_auth_tokens_refresh_token
    ON auth_tokens (refresh_token)
    WHERE refresh_token IS NOT NULL;
