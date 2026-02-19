#!/bin/bash
# PostgreSQL setup script for FreeSign
# Run this on ffxi as root or postgres user

set -e

echo "🐘 Setting up PostgreSQL for FreeSign..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "📥 Installing PostgreSQL..."
    apt-get update
    apt-get install -y postgresql postgresql-contrib
fi

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
DB_NAME="freesign"
DB_USER="freesign"
DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)

echo "Creating database: $DB_NAME"
echo "Creating user: $DB_USER"

sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
    END IF;
END
\$\$;

-- Create database if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME') THEN
        CREATE DATABASE $DB_NAME OWNER $DB_USER;
    END IF;
END
\$\$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
EOF

# Run schema
if [ -f /var/www/freesign-backend/schema.sql ]; then
    echo "📊 Running database schema..."
    sudo -u postgres psql -d $DB_NAME -f /var/www/freesign-backend/schema.sql
fi

echo ""
echo "✅ PostgreSQL setup complete!"
echo ""
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASS"
echo ""
echo "Add this to /var/www/freesign-backend/.env:"
echo "DB_PASSWORD=$DB_PASS"
