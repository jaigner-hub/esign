/**
 * Database initialization script
 * Run with: npm run db:init
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'freesign',
  user: process.env.DB_USER || 'freesign',
  password: process.env.DB_PASSWORD,
});

async function initDb() {
  try {
    console.log('Initializing database...');
    
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    
    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
