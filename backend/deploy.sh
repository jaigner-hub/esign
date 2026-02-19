#!/bin/bash
# Deploy FreeSign Phase 1 to ffxi

set -e

echo "🚀 Deploying FreeSign Phase 1 to ffxi..."

# Create backend directory on server
echo "📁 Setting up backend directory..."
ssh ffxi "sudo mkdir -p /var/www/freesign-backend && sudo chown www-data:www-data /var/www/freesign-backend"

# Copy backend files
echo "📦 Copying backend files..."
scp -r /home/enum/.openclaw/workspace/freesign-backend/* ffxi:/tmp/freesign-backend/
ssh ffxi "sudo mv /tmp/freesign-backend/* /var/www/freesign-backend/ && sudo chown -R www-data:www-data /var/www/freesign-backend"

# Install dependencies
echo "📥 Installing npm dependencies..."
ssh ffxi "cd /var/www/freesign-backend && sudo npm install --production"

# Copy frontend files
echo "🎨 Updating frontend files..."
scp /home/enum/.openclaw/workspace/freesign-backend/public/index.html ffxi:/tmp/index.html
scp /home/enum/.openclaw/workspace/freesign-backend/public/css/style.css ffxi:/tmp/style.css
scp /home/enum/.openclaw/workspace/freesign-backend/public/js/app.js ffxi:/tmp/app.js

ssh ffxi "sudo mv /tmp/index.html /var/www/esign/ && sudo mv /tmp/style.css /var/www/esign/css/ && sudo mv /tmp/app.js /var/www/esign/js/"

# Install systemd service
echo "🔧 Installing systemd service..."
scp /home/enum/.openclaw/workspace/freesign-backend/freesign-api.service ffxi:/tmp/
ssh ffxi "sudo mv /tmp/freesign-api.service /etc/systemd/system/ && sudo systemctl daemon-reload"

# Enable and start service
echo "▶️ Starting FreeSign API service..."
ssh ffxi "sudo systemctl enable freesign-api && sudo systemctl restart freesign-api"

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set up PostgreSQL database on ffxi"
echo "2. Create /var/www/freesign-backend/.env with your secrets"
echo "3. Update nginx config to proxy /api to the backend"
echo "4. Restart nginx"
