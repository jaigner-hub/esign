/**
 * Stripe Product/Price Setup Script
 * Creates the Pro plan product and price in Stripe, then updates .env
 * 
 * Usage: node scripts/setup-stripe.js
 * Requires STRIPE_SECRET_KEY to be set (not placeholder)
 */

const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('placeholder')) {
    console.error('❌ Set a real STRIPE_SECRET_KEY in .env first');
    console.error('   Get test keys from: https://dashboard.stripe.com/test/apikeys');
    process.exit(1);
  }

  const stripe = new Stripe(key, { apiVersion: '2023-10-16' });

  try {
    // Check for existing product
    const products = await stripe.products.list({ limit: 10 });
    let proProduct = products.data.find(p => p.name === 'FreeSign Pro');

    if (!proProduct) {
      console.log('Creating FreeSign Pro product...');
      proProduct = await stripe.products.create({
        name: 'FreeSign Pro',
        description: 'Unlimited PDF signatures, no watermark, saved signature profiles',
      });
      console.log('✅ Product created:', proProduct.id);
    } else {
      console.log('✅ Product already exists:', proProduct.id);
    }

    // Check for existing price
    const prices = await stripe.prices.list({ product: proProduct.id, limit: 10 });
    let proPrice = prices.data.find(p => p.unit_amount === 999 && p.recurring?.interval === 'month' && p.active);

    if (!proPrice) {
      console.log('Creating $9.99/month price...');
      proPrice = await stripe.prices.create({
        product: proProduct.id,
        unit_amount: 999,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      console.log('✅ Price created:', proPrice.id);
    } else {
      console.log('✅ Price already exists:', proPrice.id);
    }

    // Update .env
    const envPath = path.join(__dirname, '..', '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace(/STRIPE_PRO_PRICE_ID=.*/, `STRIPE_PRO_PRICE_ID=${proPrice.id}`);
    fs.writeFileSync(envPath, env);

    console.log('\n✅ Setup complete!');
    console.log(`   Pro Price ID: ${proPrice.id}`);
    console.log('\nNext steps:');
    console.log('1. Set up webhook at: https://dashboard.stripe.com/test/webhooks');
    console.log('   Endpoint: https://freesign.ink/api/billing/webhook');
    console.log('   Events: checkout.session.completed, invoice.payment_succeeded,');
    console.log('           invoice.payment_failed, customer.subscription.deleted,');
    console.log('           customer.subscription.updated');
    console.log('2. Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET in .env');
    console.log('3. Restart: sudo systemctl restart freesign-api');
  } catch (err) {
    console.error('❌ Stripe setup failed:', err.message);
    process.exit(1);
  }
}

setup();
