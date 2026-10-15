import pool from '../config/db.js';

async function runMigration() {
  try {
    console.log('Running RFQ & Requisition Payment Terms migration...');

    // 1. Add columns to requisitions table
    await pool.query(`
      ALTER TABLE requisitions
      ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255) DEFAULT 'Net 30 Days Credit',
      ADD COLUMN IF NOT EXISTS advance_pct DECIMAL(5,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS credit_days INT DEFAULT 30,
      ADD COLUMN IF NOT EXISTS payment_terms_notes TEXT NULL
    `);
    console.log('✓ Columns added/verified on requisitions table.');

    // 2. Add columns to rfqs table
    await pool.query(`
      ALTER TABLE rfqs
      ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255) DEFAULT 'Net 30 Days Credit',
      ADD COLUMN IF NOT EXISTS advance_pct DECIMAL(5,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS credit_days INT DEFAULT 30,
      ADD COLUMN IF NOT EXISTS payment_terms_notes TEXT NULL
    `);
    console.log('✓ Columns added/verified on rfqs table.');

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

runMigration();
