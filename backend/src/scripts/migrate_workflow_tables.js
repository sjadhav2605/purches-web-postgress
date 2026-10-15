import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

async function migrate() {
  console.log('--- Starting DDPL Workflow Database Migration ---');

  // 1. status_history table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INT NOT NULL,
      from_status VARCHAR(100) NULL,
      to_status VARCHAR(100) NOT NULL,
      action_by VARCHAR(150) NOT NULL,
      action_by_id INT NULL,
      role VARCHAR(50) NOT NULL,
      remark TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sh_entity (entity_type, entity_id),
      INDEX idx_sh_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ status_history table verified/created');

  // 2. requisition_edits table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requisition_edits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      requisition_id INT NOT NULL,
      field VARCHAR(100) NOT NULL,
      old_value TEXT NULL,
      new_value TEXT NULL,
      edited_by VARCHAR(150) NOT NULL,
      edited_by_id INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_req_edits_req_id (requisition_id),
      FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ requisition_edits table verified/created');

  // 3. delivery_receipts table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_receipts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      delivery_id INT NULL,
      requisition_id INT NULL,
      po_id INT NULL,
      received_by VARCHAR(150) NOT NULL,
      received_by_id INT NULL,
      received_qty DECIMAL(12, 3) NULL,
      proof_file LONGTEXT NULL,
      remark TEXT NULL,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dr_del (delivery_id),
      INDEX idx_dr_req (requisition_id),
      INDEX idx_dr_po (po_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ delivery_receipts table verified/created');

  // 4. notifications channel column
  const [notifCols] = await pool.query('DESCRIBE notifications');
  const notifColNames = notifCols.map((c) => c.Field);
  if (!notifColNames.includes('channel')) {
    await pool.query(`ALTER TABLE notifications ADD COLUMN channel VARCHAR(50) DEFAULT 'in_app' AFTER link`);
    console.log('✓ notifications: added channel column');
  }

  // 5. requisitions status column update to VARCHAR(100)
  await pool.query(`ALTER TABLE requisitions MODIFY COLUMN status VARCHAR(100) NOT NULL DEFAULT 'Raised'`);
  console.log('✓ requisitions: status modified to VARCHAR(100)');

  // 6. requisitions columns for workflow
  const [reqCols] = await pool.query('DESCRIBE requisitions');
  const reqColNames = reqCols.map((c) => c.Field);

  const reqColsToAdd = [
    { name: 'decline_reason', type: 'TEXT NULL' },
    { name: 'approved_by', type: 'VARCHAR(150) NULL' },
    { name: 'approved_by_id', type: 'INT NULL' },
    { name: 'approved_at', type: 'DATETIME NULL' },
    { name: 'declined_by', type: 'VARCHAR(150) NULL' },
    { name: 'declined_by_id', type: 'INT NULL' },
    { name: 'declined_at', type: 'DATETIME NULL' },
    { name: 'shortlisted_vendor_id', type: 'INT NULL' },
    { name: 'dispatch_date', type: 'DATE NULL' },
    { name: 'vehicle_no', type: 'VARCHAR(100) NULL' },
    { name: 'transport_name', type: 'VARCHAR(150) NULL' },
    { name: 'challan_no', type: 'VARCHAR(100) NULL' },
    { name: 'dispatched_qty', type: 'DECIMAL(12, 3) NULL' },
    { name: 'dispatch_remarks', type: 'TEXT NULL' }
  ];

  for (const col of reqColsToAdd) {
    if (!reqColNames.includes(col.name)) {
      await pool.query(`ALTER TABLE requisitions ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✓ requisitions: added ${col.name}`);
    }
  }

  // 7. rfqs columns
  const [rfqCols] = await pool.query('DESCRIBE rfqs');
  const rfqColNames = rfqCols.map((c) => c.Field);
  if (!rfqColNames.includes('shortlisted_vendor_id')) {
    await pool.query(`ALTER TABLE rfqs ADD COLUMN shortlisted_vendor_id INT NULL`);
    console.log('✓ rfqs: added shortlisted_vendor_id');
  }
  if (!rfqColNames.includes('director_declined_reason')) {
    await pool.query(`ALTER TABLE rfqs ADD COLUMN director_declined_reason TEXT NULL`);
    console.log('✓ rfqs: added director_declined_reason');
  }
  if (!rfqColNames.includes('director_note')) {
    await pool.query(`ALTER TABLE rfqs ADD COLUMN director_note TEXT NULL`);
    console.log('✓ rfqs: added director_note');
  }

  // 8. deliveries columns
  const [delCols] = await pool.query('DESCRIBE deliveries');
  const delColNames = delCols.map((c) => c.Field);
  if (!delColNames.includes('requisition_id')) {
    await pool.query(`ALTER TABLE deliveries ADD COLUMN requisition_id INT NULL AFTER po_id`);
    console.log('✓ deliveries: added requisition_id');
  }

  // 9. Seed demo second vendor for testing: vendor2@ddpl.com -> vendor 5
  const [v2Users] = await pool.query("SELECT id FROM users WHERE email = 'vendor2@ddpl.com'");
  if (v2Users.length === 0) {
    const hash = await bcrypt.hash('Admin@123', 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, status, vendor_id) 
       VALUES ('vendor2@ddpl.com', ?, 'Aditya Enterprises Representative', 'vendor', 'active', 5)`,
      [hash]
    );
    console.log('✓ Created demo user: vendor2@ddpl.com (vendor_id: 5)');
  }

  console.log('--- Migration completed successfully ---');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
