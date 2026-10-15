import pool from '../config/db.js';

async function migrate() {
  console.log('Starting migration for bid revisions and notifications...');

  // 1. Create notifications table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      vendor_id INT NULL,
      role VARCHAR(50) NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      link VARCHAR(255) NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notif_user (user_id),
      INDEX idx_notif_vendor (vendor_id),
      INDEX idx_notif_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ notifications table created/verified');

  // 2. Add status and current_round to rfq_bids if not already existing
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rfq_bids';
  `);
  const colNames = cols.map(c => c.COLUMN_NAME);

  if (!colNames.includes('status')) {
    await pool.query(`
      ALTER TABLE rfq_bids 
      ADD COLUMN status VARCHAR(50) DEFAULT 'Submitted';
    `);
    console.log('✅ Added status column to rfq_bids');
  }

  if (!colNames.includes('current_round')) {
    await pool.query(`
      ALTER TABLE rfq_bids 
      ADD COLUMN current_round INT DEFAULT 0;
    `);
    console.log('✅ Added current_round column to rfq_bids');
  }

  // 3. Create bid_revisions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bid_revisions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rfq_id INT NOT NULL,
      bid_id INT NOT NULL,
      vendor_id INT NOT NULL,
      round INT NOT NULL DEFAULT 1,
      status ENUM('Revision Requested', 'Revised Bid Submitted', 'Accepted', 'Rejected') DEFAULT 'Revision Requested',
      requested_by_id INT NULL,
      request_remarks TEXT NULL,
      response_type ENUM('accepted', 'counter', 'original') NULL,
      vendor_remarks TEXT NULL,
      subtotal DECIMAL(14, 2) DEFAULT 0.00,
      cgst DECIMAL(14, 2) DEFAULT 0.00,
      sgst DECIMAL(14, 2) DEFAULT 0.00,
      total_amount DECIMAL(14, 2) DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME NULL,
      FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
      FOREIGN KEY (bid_id) REFERENCES rfq_bids(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
      FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_bid_rev_rfq (rfq_id),
      INDEX idx_bid_rev_bid (bid_id),
      INDEX idx_bid_rev_vendor (vendor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ bid_revisions table created/verified');

  // 4. Create bid_revision_items table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bid_revision_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      revision_id INT NOT NULL,
      item_index INT DEFAULT 0,
      description VARCHAR(255) NOT NULL,
      spec TEXT NULL,
      unit VARCHAR(50) NULL,
      quantity DECIMAL(12, 3) NOT NULL DEFAULT 1,
      original_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      revised_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      final_rate DECIMAL(12, 2) NULL,
      availability VARCHAR(50) DEFAULT 'Available',
      FOREIGN KEY (revision_id) REFERENCES bid_revisions(id) ON DELETE CASCADE,
      INDEX idx_rev_items_rev_id (revision_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ bid_revision_items table created/verified');

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
