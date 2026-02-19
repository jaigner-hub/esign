/**
 * FreeSign Backend API
 * Phase 1: Freemium authentication and usage tracking
 * Phase 2: Email verification + Stripe checkout fix
 * Phase 3: Pay-per-signature ($0.99 each)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const { Resend } = require('resend');
const validator = require('validator');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3100;

// Initialize Stripe (handle missing/placeholder keys gracefully)
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripeReady = stripeKey && !stripeKey.includes('placeholder');
const stripe = stripeReady ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;

// Initialize email transporter
let emailTransporter = null;
if (process.env.SMTP_HOST) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else if (process.env.SENDGRID_API_KEY) {
  emailTransporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY,
    },
  });
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@freesign.ink';

// Database pool
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'freesign',
  user: process.env.DB_USER || 'freesign',
  password: process.env.DB_PASSWORD,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Run migrations on startup
async function runMigrations() {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token)`);
    // Phase 3: Pay-per-signature credits
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_credits INTEGER DEFAULT 0`);
    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('Migration warning:', err.message);
  }
}
runMigrations();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://freesign.ink',
  credentials: true
}));

// Stripe webhook needs raw body - must be before express.json()
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json({ limit: '10mb' }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many attempts, please try again later' }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'Rate limit exceeded' }
});

app.use('/api/auth/', authLimiter);
app.use('/api/', apiLimiter);

// JWT authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'SELECT id, email, name, tier, subscription_status, stripe_customer_id, email_verified, signature_credits FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Helper: Get current month's usage for a user
async function getMonthlyUsage(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) as count 
     FROM signature_events 
     WHERE user_id = $1 
     AND signed_at >= DATE_TRUNC('month', NOW())
     AND signed_at < DATE_TRUNC('month', NOW() + INTERVAL '1 month')`,
    [userId]
  );
  return parseInt(result.rows[0].count);
}

// Constants
const FREE_MONTHLY_LIMIT = 3;
const SIGNATURE_PRICE_CENTS = 99; // $0.99

// Helper: Generate verification token
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: Send verification email
async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.FRONTEND_URL || 'https://freesign.ink'}/?verify=${token}`;
  
  if (!resendClient) {
    console.log(`📧 Email verification link for ${email}: ${verifyUrl}`);
    console.log('   (No SMTP configured - logging only)');
    return true;
  }

  try {
    await resendClient.emails.send({
      from: `"FreeSign" <${FROM_EMAIL}>`,
      to: email,
      subject: 'Verify your FreeSign account',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; font-size: 24px;">Welcome to FreeSign! 🖊️</h1>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Please verify your email address to start signing PDFs.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0;">
            Verify Email
          </a>
          <p style="color: #999; font-size: 14px;">
            Or copy this link: ${verifyUrl}
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This link expires in 24 hours. If you didn't create an account, ignore this email.
          </p>
        </div>
      `,
      text: `Welcome to FreeSign! Verify your email: ${verifyUrl} (expires in 24 hours)`,
    });
    console.log(`📧 Verification email sent to ${email}`);
    return true;
  } catch (err) {
    console.error('Failed to send verification email:', err.message);
    return false;
  }
}

// ========== AUTH ENDPOINTS ==========

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, tier, email_verified, verification_token, verification_token_expires) 
       VALUES ($1, $2, $3, 'free', FALSE, $4, $5) 
       RETURNING id, email, name, tier, email_verified, created_at`,
      [email.toLowerCase(), name || null, passwordHash, verificationToken, tokenExpires]
    );

    const user = result.rows[0];

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken);

    // Generate JWT (user can log in but signing is gated on verification)
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created! Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        emailVerified: user.email_verified,
      },
      token,
      needsVerification: true,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify email
app.get('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL
       WHERE verification_token = $1 AND verification_token_expires > NOW()
       RETURNING id, email, name, tier, email_verified`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    res.json({ 
      message: 'Email verified successfully!',
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
        tier: result.rows[0].tier,
        emailVerified: true,
      }
    });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend verification email
app.post('/api/auth/resend-verification', authenticateToken, async (req, res) => {
  try {
    if (req.user.email_verified) {
      return res.json({ message: 'Email already verified' });
    }

    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3`,
      [verificationToken, tokenExpires, req.user.id]
    );

    await sendVerificationEmail(req.user.email, verificationToken);

    res.json({ message: 'Verification email sent! Check your inbox.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, email, name, password_hash, tier, subscription_status, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        subscriptionStatus: user.subscription_status,
        emailVerified: user.email_verified,
      },
      token,
      needsVerification: !user.email_verified,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const usage = await getMonthlyUsage(req.user.id);
    const credits = req.user.signature_credits || 0;
    const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - usage);

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        tier: req.user.tier,
        subscriptionStatus: req.user.subscription_status,
        emailVerified: req.user.email_verified,
      },
      usage: {
        used: usage,
        limit: FREE_MONTHLY_LIMIT,
        remaining: freeRemaining,
        credits: credits,
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ========== USAGE ENDPOINTS ==========

// Get current usage
app.get('/api/usage', authenticateToken, async (req, res) => {
  try {
    const usage = await getMonthlyUsage(req.user.id);
    const credits = req.user.signature_credits || 0;
    const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - usage);

    res.json({
      used: usage,
      limit: FREE_MONTHLY_LIMIT,
      remaining: freeRemaining,
      credits: credits,
      tier: req.user.tier,
      period: 'monthly'
    });
  } catch (err) {
    console.error('Usage error:', err);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

// Record signature event
app.post('/api/signatures/record', authenticateToken, async (req, res) => {
  try {
    // Check email verification
    if (!req.user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before signing documents',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const { documentName } = req.body;
    
    const usage = await getMonthlyUsage(req.user.id);
    const credits = req.user.signature_credits || 0;
    const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - usage);

    let usedCredit = false;

    if (freeRemaining > 0) {
      // Use free allocation
    } else if (credits > 0) {
      // Deduct a paid credit
      await pool.query(
        'UPDATE users SET signature_credits = signature_credits - 1 WHERE id = $1 AND signature_credits > 0',
        [req.user.id]
      );
      usedCredit = true;
    } else {
      // No free sigs left and no credits
      return res.status(402).json({
        error: 'No signatures remaining',
        code: 'LIMIT_EXCEEDED',
        usage: { used: usage, limit: FREE_MONTHLY_LIMIT, credits: 0 },
      });
    }

    await pool.query(
      'INSERT INTO signature_events (user_id, document_name) VALUES ($1, $2)',
      [req.user.id, documentName || 'Untitled Document']
    );

    const newUsage = usage + 1;
    const newCredits = usedCredit ? credits - 1 : credits;
    const newFreeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - newUsage);

    res.json({
      success: true,
      allowed: true,
      usedCredit: usedCredit,
      usage: {
        used: newUsage,
        limit: FREE_MONTHLY_LIMIT,
        remaining: newFreeRemaining,
        credits: newCredits,
      }
    });
  } catch (err) {
    console.error('Record signature error:', err);
    res.status(500).json({ error: 'Failed to record signature' });
  }
});

// Check if user can sign
app.get('/api/signatures/check', authenticateToken, async (req, res) => {
  try {
    const usage = await getMonthlyUsage(req.user.id);
    const credits = req.user.signature_credits || 0;
    const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - usage);
    const canSign = freeRemaining > 0 || credits > 0;

    res.json({
      allowed: canSign,
      emailVerified: req.user.email_verified,
      usage: {
        used: usage,
        limit: FREE_MONTHLY_LIMIT,
        remaining: freeRemaining,
        credits: credits,
      },
      tier: req.user.tier,
      purchaseAvailable: true,
      purchasePrice: '$0.99',
    });
  } catch (err) {
    console.error('Check signature error:', err);
    res.status(500).json({ error: 'Failed to check signature allowance' });
  }
});

// ========== BILLING ENDPOINTS ==========

// Purchase a single signature credit ($0.99)
app.post('/api/billing/purchase-signature', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured yet. Please contact support.' });
    }

    let customerId = req.user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: String(req.user.id) }
      });
      customerId = customer.id;
      
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, req.user.id]
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'FreeSign - 1 Signature Credit',
            description: 'One PDF signature credit (never expires)',
          },
          unit_amount: SIGNATURE_PRICE_CENTS,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'https://freesign.ink'}/?checkout=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://freesign.ink'}/?checkout=canceled`,
      metadata: { 
        userId: String(req.user.id), 
        type: 'signature_credit',
        credits: '1',
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Purchase signature error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Legacy: Create checkout session for Pro plan (kept but hidden from UI)
app.post('/api/billing/checkout', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured yet. Please contact support.' });
    }

    const { plan = 'pro' } = req.body;
    
    let priceId = plan === 'pro' 
      ? process.env.STRIPE_PRO_PRICE_ID 
      : process.env.STRIPE_BUSINESS_PRICE_ID;

    if (!priceId || priceId.includes('placeholder')) {
      try {
        const result = await autoSetupStripeProduct(plan);
        priceId = result.priceId;
      } catch (setupErr) {
        console.error('Stripe auto-setup failed:', setupErr);
        return res.status(500).json({ error: 'Billing is being set up. Please try again shortly.' });
      }
    }

    let customerId = req.user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: String(req.user.id) }
      });
      customerId = customer.id;
      
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, req.user.id]
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'https://freesign.ink'}/?checkout=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://freesign.ink'}/?checkout=canceled`,
      metadata: { userId: String(req.user.id), plan }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Auto-create Stripe product/price
async function autoSetupStripeProduct(plan) {
  const productName = plan === 'pro' ? 'FreeSign Pro' : 'FreeSign Business';
  const amount = plan === 'pro' ? 999 : 2999;

  const products = await stripe.products.list({ limit: 20 });
  let product = products.data.find(p => p.name === productName && p.active);

  if (!product) {
    product = await stripe.products.create({
      name: productName,
      description: plan === 'pro' 
        ? 'Unlimited PDF signatures, no watermark' 
        : 'Business plan with team features',
    });
  }

  const prices = await stripe.prices.list({ product: product.id, limit: 10 });
  let price = prices.data.find(p => p.unit_amount === amount && p.recurring?.interval === 'month' && p.active);

  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
  }

  const envKey = plan === 'pro' ? 'STRIPE_PRO_PRICE_ID' : 'STRIPE_BUSINESS_PRICE_ID';
  process.env[envKey] = price.id;
  
  const fs = require('fs');
  const path = require('path');
  try {
    const envPath = path.join(__dirname, '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace(new RegExp(`${envKey}=.*`), `${envKey}=${price.id}`);
    fs.writeFileSync(envPath, env);
  } catch (e) {
    console.warn('Could not update .env file:', e.message);
  }

  console.log(`✅ Auto-created Stripe ${plan}: product=${product.id}, price=${price.id}`);
  return { productId: product.id, priceId: price.id };
}

// Create customer portal session
app.post('/api/billing/portal', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    if (!req.user.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: req.user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'https://freesign.ink'}/account`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Stripe webhook handler (defined as function, registered before express.json)
async function handleStripeWebhook(req, res) {
  if (!stripe) return res.status(503).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const type = session.metadata?.type;

        if (userId && type === 'signature_credit') {
          // Pay-per-signature: add credits
          const creditsToAdd = parseInt(session.metadata?.credits || '1');
          await pool.query(
            `UPDATE users SET signature_credits = COALESCE(signature_credits, 0) + $1 WHERE id = $2`,
            [creditsToAdd, userId]
          );
          console.log(`✅ Added ${creditsToAdd} signature credit(s) to user ${userId}`);
        } else if (userId) {
          // Legacy subscription flow
          const plan = session.metadata?.plan || 'pro';
          await pool.query(
            `UPDATE users 
             SET tier = $1, 
                 stripe_subscription_id = $2,
                 subscription_status = 'active'
             WHERE id = $3`,
            [plan, session.subscription, userId]
          );
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        await pool.query(
          `UPDATE users 
           SET subscription_status = 'active' 
           WHERE stripe_customer_id = $1`,
          [customerId]
        );
        break;
      }

      case 'invoice.payment_failed':
      case 'customer.subscription.deleted': {
        const obj = event.data.object;
        const customerId = obj.customer;
        
        await pool.query(
          `UPDATE users 
           SET tier = 'free',
               subscription_status = 'inactive',
               stripe_subscription_id = NULL
           WHERE stripe_customer_id = $1`,
          [customerId]
        );
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;
        
        await pool.query(
          `UPDATE users 
           SET subscription_status = $1
           WHERE stripe_customer_id = $2`,
          [status, customerId]
        );
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe: stripeReady ? 'configured' : 'not configured',
    email: resendClient ? '✅ Resend' : '📋 log-only',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`FreeSign API server running on port ${PORT}`);
  console.log(`  Stripe: ${stripeReady ? '✅ configured' : '⚠️  placeholder keys'}`);
  console.log(`  Email:  ${resendClient ? '✅ Resend' : '📋 log-only mode'}`);
});

module.exports = app;
