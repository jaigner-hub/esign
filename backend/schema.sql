-- FreeSign Database Schema
-- Run this to initialize the PostgreSQL database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    avatar_url TEXT,
    tier VARCHAR(20) DEFAULT 'free',  -- free | pro | business
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(20) DEFAULT 'inactive', -- active | canceled | past_due | inactive
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- Signature events table (tracks usage for freemium)
CREATE TABLE IF NOT EXISTS signature_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_name VARCHAR(255),
    signed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast usage queries
CREATE INDEX IF NOT EXISTS idx_sig_events_user_date ON signature_events(user_id, signed_at);

-- Saved signatures table (Pro+ feature)
CREATE TABLE IF NOT EXISTS saved_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100),
    type VARCHAR(20),   -- font | drawn | uploaded
    data_url TEXT,      -- PNG data URL
    font_index INT,
    font_size INT,
    color VARCHAR(7),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user's saved signatures
CREATE INDEX IF NOT EXISTS idx_saved_sigs_user ON saved_signatures(user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert a test user (optional, remove in production)
-- INSERT INTO users (email, name, tier) VALUES ('test@example.com', 'Test User', 'free');
