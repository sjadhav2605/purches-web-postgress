import pool from '../config/db.js';

async function updateSchema() {
  console.log('Running dispatch schema update...');
  try {
    await pool.query(`
      ALTER TABLE requisitions 
      MODIFY COLUMN status ENUM('Draft', 'Pending PC Approval', 'PR Raised', 'RFQ Sent', 'Bids In', 'Shortlisted', 'Approved', 'PO Issued', 'Dispatched', 'Site Verified', 'Rejected') 
      NOT NULL DEFAULT 'PR Raised'
    `);
    console.log('✅ Requisitions status ENUM updated with Dispatched');
  } catch (err) {
    console.log('Note on requisitions status:', err.message);
  }

  // Ensure purchase_orders has dispatch columns
  try {
    await pool.query('ALTER TABLE purchase_orders ADD COLUMN dispatch_date DATE NULL');
  } catch (e) {}
  try {
    await pool.query('ALTER TABLE purchase_orders ADD COLUMN expected_delivery_date DATE NULL');
  } catch (e) {}
  try {
    await pool.query('ALTER TABLE purchase_orders ADD COLUMN dispatch_notes TEXT NULL');
  } catch (e) {}
  console.log('✅ Purchase orders columns verified.');

  process.exit(0);
}

updateSchema();
