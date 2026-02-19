# FreeSign Phase 1 - Deployment Summary

## What's Been Deployed

### Backend (Node.js/Express)
- **Location:** `/var/www/freesign-backend/` on ffxi
- **Service:** `freesign-api` (systemd)
- **Port:** 3100 (localhost only, proxied via nginx)
- **API Base:** `https://freesign.ink/api/`

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Authenticate user |
| GET | `/api/auth/me` | Get current user info |
| GET | `/api/usage` | Get monthly usage stats |
| GET | `/api/signatures/check` | Check if user can sign |
| POST | `/api/signatures/record` | Record a signature event |
| POST | `/api/billing/checkout` | Start Stripe checkout |
| POST | `/api/billing/portal` | Stripe customer portal |
| POST | `/api/billing/webhook` | Stripe webhook handler |
| GET | `/api/health` | Health check |

### Database (PostgreSQL)
- **Database:** `freesign`
- **User:** `freesign`
- **Port:** 5433
- **Tables:** `users`, `signature_events`, `saved_signatures`

### Frontend Updates
- New header with auth buttons and usage display
- Auth modal (login/signup)
- Upgrade modal for Pro subscription
- Usage tracking before download
- Free-tier watermark on PDFs

## Configuration

### Environment Variables
Edit `/var/www/freesign-backend/.env`:

```bash
# Database (already set)
DB_HOST=localhost
DB_PORT=5433
DB_NAME=freesign
DB_USER=freesign
DB_PASSWORD=4xqfVMjVG2RaWHtNc94E3OWn

# JWT (already set)
JWT_SECRET=wosIu1gBq8LHphy38OqOAtoagJgkhPVafemw8/SALi4=

# Stripe (NEEDS TO BE UPDATED with real keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
```

## Setting Up Stripe

1. Go to https://dashboard.stripe.com
2. Create a product called "FreeSign Pro" with price $9.99/month
3. Copy the Price ID (starts with `price_`)
4. Get your API keys from Developers → API keys
5. Set up webhook endpoint: `https://freesign.ink/api/billing/webhook`
6. Update the `.env` file with real keys
7. Restart the service: `sudo systemctl restart freesign-api`

## Managing the Service

```bash
# Check status
sudo systemctl status freesign-api

# View logs
sudo journalctl -u freesign-api -f

# Restart
sudo systemctl restart freesign-api

# Stop
sudo systemctl stop freesign-api
```

## Testing

```bash
# Health check
curl https://freesign.ink/api/health

# Register
curl -X POST https://freesign.ink/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST https://freesign.ink/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password123"}'
```

## Files Modified/Created

### Backend
- `/var/www/freesign-backend/server.js` - Main API server
- `/var/www/freesign-backend/package.json` - Dependencies
- `/var/www/freesign-backend/schema.sql` - Database schema
- `/var/www/freesign-backend/.env` - Environment variables
- `/etc/systemd/system/freesign-api.service` - Systemd service

### Frontend
- `/var/www/esign/index.html` - Updated with auth UI
- `/var/www/esign/css/style.css` - New styles for auth/upgrade modals
- `/var/www/esign/js/app.js` - New version with auth and gating

### Nginx
- `/etc/nginx/sites-available/esign` - Updated with /api proxy

## Freemium Logic

1. Free tier: 3 signatures per month
2. Pro tier: Unlimited signatures ($9.99/month)
3. Users must be logged in to sign
4. Usage is checked before download
5. Free PDFs have "Signed with FreeSign.ink" watermark
6. Stripe handles subscription management

## Security Notes

- JWT tokens expire after 7 days
- Passwords hashed with bcrypt (12 rounds)
- PostgreSQL uses md5 auth
- Rate limiting on auth endpoints (10 per 15 min)
- CORS restricted to freesign.ink
- API only accessible via HTTPS
