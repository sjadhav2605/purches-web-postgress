import pool from '../config/db.js';

async function runMigration() {
  try {
    console.log('Running Commercial Terms schema migration...');
    await pool.query(`
      ALTER TABLE purchase_orders 
      ADD COLUMN IF NOT EXISTS declaration_text TEXT NULL,
      ADD COLUMN IF NOT EXISTS terms_updated_by_id INT NULL,
      ADD COLUMN IF NOT EXISTS terms_updated_by_name VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS terms_updated_at VARCHAR(50) NULL
    `);
    console.log('✓ Migration applied successfully to purchase_orders table.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

runMigration();
