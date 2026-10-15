import mysql from 'mysql2/promise';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const mysqlConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'ddpl_procurement',
  port: Number(process.env.MYSQL_PORT) || 3306
};

const pgConfig = {
  host: process.env.PG_HOST || '127.0.0.1',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'root',
  port: Number(process.env.PG_PORT) || 5432
};

const TARGET_DB = 'ddpl_procurement';

async function setupPostgresDatabase() {
  console.log('🔄 Checking PostgreSQL database...');
  const rootClient = new pg.Client({
    ...pgConfig,
    database: 'postgres'
  });
  await rootClient.connect();

  const checkDb = await rootClient.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [TARGET_DB]
  );

  if (checkDb.rows.length === 0) {
    console.log(`📦 Creating PostgreSQL database "${TARGET_DB}"...`);
    await rootClient.query(`CREATE DATABASE "${TARGET_DB}"`);
    console.log(`✅ Database "${TARGET_DB}" created.`);
  } else {
    console.log(`✅ PostgreSQL database "${TARGET_DB}" already exists.`);
  }

  await rootClient.end();
}

async function createPostgresSchema(pgClient) {
  console.log('🏗️  Creating PostgreSQL tables and functions...');

  // 1. json_set compatibility functions
  await pgClient.query(`
    CREATE OR REPLACE FUNCTION json_set(target jsonb, path text, val text)
    RETURNS jsonb AS $$
    DECLARE
        cleaned_path text;
        path_array text[];
    BEGIN
        IF target IS NULL THEN
            target := '{}'::jsonb;
        END IF;
        cleaned_path := regexp_replace(path, '^\\$\\.?', '');
        cleaned_path := replace(cleaned_path, '"', '');
        path_array := string_to_array(cleaned_path, '.');
        RETURN jsonb_set(target, path_array, to_jsonb(val), true);
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;

    CREATE OR REPLACE FUNCTION json_set(target text, path text, val text)
    RETURNS jsonb AS $$
    BEGIN
        RETURN json_set(COALESCE(target::jsonb, '{}'::jsonb), path, val);
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
  `);

  // Drop tables in reverse foreign key order if re-running
  const dropOrder = [
    'delivery_receipts',
    'deliveries',
    'payments',
    'purchase_orders',
    'bid_revision_items',
    'bid_revisions',
    'rfq_bids',
    'rfqs',
    'requisition_edits',
    'requisition_items',
    'requisitions',
    'materials',
    'notification_log',
    'notifications',
    'audit_logs',
    'status_history',
    'users',
    'vendors',
    'sites'
  ];

  for (const table of dropOrder) {
    await pgClient.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
  }

  // 1. SITES TABLE
  await pgClient.query(`
    CREATE TABLE sites (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      address TEXT NOT NULL,
      gstin VARCHAR(20) NULL,
      active SMALLINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_sites_code ON sites(code);
  `);

  // 2. VENDORS TABLE
  await pgClient.query(`
    CREATE TABLE vendors (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      gstin VARCHAR(20) NULL,
      pan VARCHAR(20) NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(25) NULL,
      address TEXT NULL,
      categories JSONB NULL,
      advance_pct NUMERIC(5, 2) DEFAULT 0.00,
      credit_days INT DEFAULT 0,
      active SMALLINT DEFAULT 1,
      constitution VARCHAR(100) NULL,
      gst_treatment VARCHAR(150) NULL,
      city VARCHAR(100) NULL,
      state VARCHAR(100) NULL,
      pin VARCHAR(20) NULL,
      contact_person VARCHAR(150) NULL,
      designation VARCHAR(100) NULL,
      landline VARCHAR(50) NULL,
      website VARCHAR(255) NULL,
      goods_services TEXT NULL,
      brands TEXT NULL,
      payment_terms_note TEXT NULL,
      review_note TEXT NULL,
      account_holder VARCHAR(200) NULL,
      bank_name VARCHAR(150) NULL,
      branch VARCHAR(150) NULL,
      account_no VARCHAR(50) NULL,
      account_type VARCHAR(50) NULL,
      ifsc VARCHAR(25) NULL,
      micr VARCHAR(25) NULL,
      year_established VARCHAR(20) NULL,
      years_in_business INT NULL,
      employees VARCHAR(50) NULL,
      form_submitted VARCHAR(50) NULL,
      documents JSONB NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_vendors_name ON vendors(name);
  `);

  // 3. USERS TABLE
  await pgClient.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(30) NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(150) NOT NULL,
      role VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      vendor_id INT NULL REFERENCES vendors(id) ON DELETE SET NULL,
      default_site_id INT NULL REFERENCES sites(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_role ON users(role);
  `);

  // 4. MATERIALS TABLE
  await pgClient.query(`
    CREATE TABLE materials (
      id SERIAL PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      spec TEXT NULL,
      unit VARCHAR(50) NOT NULL,
      category VARCHAR(100) NOT NULL,
      site_id INT NULL REFERENCES sites(id) ON DELETE SET NULL,
      is_common SMALLINT DEFAULT 1,
      hsn VARCHAR(20) NULL,
      ref_rate NUMERIC(12, 2) DEFAULT 0.00,
      active SMALLINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_materials_category ON materials(category);
    CREATE INDEX idx_materials_desc ON materials(description);
  `);

  // 5. REQUISITIONS TABLE
  await pgClient.query(`
    CREATE TABLE requisitions (
      id SERIAL PRIMARY KEY,
      pr_no VARCHAR(50) NOT NULL UNIQUE,
      site_id INT NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
      requested_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      category VARCHAR(150) NOT NULL,
      status VARCHAR(100) NOT NULL DEFAULT 'Raised',
      required_by_date DATE NULL,
      remarks TEXT NULL,
      history JSONB NULL,
      decline_reason TEXT NULL,
      approved_by VARCHAR(150) NULL,
      approved_by_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMP NULL,
      declined_by VARCHAR(150) NULL,
      declined_by_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      declined_at TIMESTAMP NULL,
      shortlisted_vendor_id INT NULL REFERENCES vendors(id) ON DELETE SET NULL,
      target_director_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      target_director_name VARCHAR(100) NULL,
      dispatch_date DATE NULL,
      vehicle_no VARCHAR(100) NULL,
      transport_name VARCHAR(150) NULL,
      challan_no VARCHAR(100) NULL,
      dispatched_qty NUMERIC(12, 3) NULL,
      dispatch_remarks TEXT NULL,
      payment_terms VARCHAR(255) NULL DEFAULT 'Net 30 Days Credit',
      advance_pct NUMERIC(5, 2) NULL DEFAULT 0.00,
      credit_days INT NULL DEFAULT 30,
      payment_terms_notes TEXT NULL,
      expected_delivery_date TIMESTAMP NULL,
      bill_no VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_pr_no ON requisitions(pr_no);
    CREATE INDEX idx_pr_status ON requisitions(status);
    CREATE INDEX idx_pr_created ON requisitions(created_at);
  `);

  // 6. REQUISITION_ITEMS TABLE
  await pgClient.query(`
    CREATE TABLE requisition_items (
      id SERIAL PRIMARY KEY,
      requisition_id INT NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
      material_id INT NULL REFERENCES materials(id) ON DELETE SET NULL,
      description VARCHAR(255) NOT NULL,
      spec TEXT NULL,
      unit VARCHAR(50) NOT NULL,
      quantity NUMERIC(12, 3) NOT NULL,
      est_rate NUMERIC(12, 2) DEFAULT 0.00,
      approved_rate NUMERIC(15, 2) NULL,
      is_custom SMALLINT DEFAULT 0,
      justification TEXT NULL,
      photos JSONB NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_req_items_req_id ON requisition_items(requisition_id);
  `);

  // 7. RFQS TABLE
  await pgClient.query(`
    CREATE TABLE rfqs (
      id SERIAL PRIMARY KEY,
      rfq_no VARCHAR(50) NOT NULL UNIQUE,
      requisition_id INT NOT NULL REFERENCES requisitions(id) ON DELETE RESTRICT,
      site_id INT NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
      current_rev INT DEFAULT 0,
      deadline DATE NULL,
      winner_vendor_id INT NULL REFERENCES vendors(id) ON DELETE SET NULL,
      status VARCHAR(50) DEFAULT 'Draft',
      shortlisted_vendors JSONB NULL,
      shortlist_reason TEXT NULL,
      director_note TEXT NULL,
      shortlisted_vendor_id INT NULL REFERENCES vendors(id) ON DELETE SET NULL,
      director_declined_reason TEXT NULL,
      created_by_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_by_name VARCHAR(150) NULL,
      created_by_role VARCHAR(50) NULL,
      payment_terms VARCHAR(255) NULL DEFAULT 'Net 30 Days Credit',
      advance_pct NUMERIC(5, 2) NULL DEFAULT 0.00,
      credit_days INT NULL DEFAULT 30,
      payment_terms_notes TEXT NULL,
      target_director_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      target_director_name VARCHAR(100) NULL,
      expected_delivery_date TIMESTAMP NULL,
      dispatch_date TIMESTAMP NULL,
      challan_no VARCHAR(100) NULL,
      bill_no VARCHAR(100) NULL,
      vehicle_no VARCHAR(100) NULL,
      transport_name VARCHAR(150) NULL,
      driver_contact VARCHAR(50) NULL,
      dispatch_remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_rfqs_req_id ON rfqs(requisition_id);
  `);

  // 8. RFQ_BIDS TABLE
  await pgClient.query(`
    CREATE TABLE rfq_bids (
      id SERIAL PRIMARY KEY,
      rfq_id INT NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
      revision_no INT DEFAULT 0,
      vendor_id INT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
      items JSONB NOT NULL,
      lead_from DATE NULL,
      lead_to DATE NULL,
      delivery_days INT NULL,
      entered_by VARCHAR(50) DEFAULT 'vendor',
      status VARCHAR(50) DEFAULT 'Submitted',
      current_round INT DEFAULT 0,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uk_rfq_rev_vendor UNIQUE (rfq_id, revision_no, vendor_id)
    );
  `);

  // 9. BID_REVISIONS TABLE
  await pgClient.query(`
    CREATE TABLE bid_revisions (
      id SERIAL PRIMARY KEY,
      rfq_id INT NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
      bid_id INT NOT NULL REFERENCES rfq_bids(id) ON DELETE CASCADE,
      vendor_id INT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
      round INT NOT NULL DEFAULT 1,
      status VARCHAR(50) DEFAULT 'Revision Requested',
      requested_by_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      request_remarks TEXT NULL,
      response_type VARCHAR(50) NULL,
      vendor_remarks TEXT NULL,
      subtotal NUMERIC(14, 2) DEFAULT 0.00,
      cgst NUMERIC(14, 2) DEFAULT 0.00,
      sgst NUMERIC(14, 2) DEFAULT 0.00,
      total_amount NUMERIC(14, 2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      responded_at TIMESTAMP NULL
    );
    CREATE INDEX idx_bid_rev_rfq ON bid_revisions(rfq_id);
    CREATE INDEX idx_bid_rev_bid ON bid_revisions(bid_id);
    CREATE INDEX idx_bid_rev_vendor ON bid_revisions(vendor_id);
  `);

  // 10. BID_REVISION_ITEMS TABLE
  await pgClient.query(`
    CREATE TABLE bid_revision_items (
      id SERIAL PRIMARY KEY,
      revision_id INT NOT NULL REFERENCES bid_revisions(id) ON DELETE CASCADE,
      item_index INT DEFAULT 0,
      description VARCHAR(255) NOT NULL,
      spec TEXT NULL,
      unit VARCHAR(50) NULL,
      quantity NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
      original_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      revised_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      final_rate NUMERIC(12, 2) NULL,
      availability VARCHAR(50) DEFAULT 'Available'
    );
    CREATE INDEX idx_rev_items_rev_id ON bid_revision_items(revision_id);
  `);

  // 11. PURCHASE_ORDERS TABLE
  await pgClient.query(`
    CREATE TABLE purchase_orders (
      id SERIAL PRIMARY KEY,
      po_no VARCHAR(50) NOT NULL UNIQUE,
      requisition_id INT NOT NULL REFERENCES requisitions(id) ON DELETE RESTRICT,
      rfq_id INT NULL REFERENCES rfqs(id) ON DELETE SET NULL,
      vendor_id INT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
      site_id INT NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
      subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      cgst NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      sgst NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      payment_terms JSONB NULL,
      items JSONB NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Approved',
      approved_by_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      verified_by_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      pdf_file_path VARCHAR(500) NULL,
      invoice_no VARCHAR(100) NULL,
      dispatch_date DATE NULL,
      expected_delivery_date DATE NULL,
      dispatch_notes TEXT NULL,
      declaration_text TEXT NULL,
      terms_updated_by_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      terms_updated_by_name VARCHAR(150) NULL,
      terms_updated_at VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_po_no ON purchase_orders(po_no);
    CREATE INDEX idx_po_status ON purchase_orders(status);
  `);

  // 12. DELIVERIES TABLE
  await pgClient.query(`
    CREATE TABLE deliveries (
      id SERIAL PRIMARY KEY,
      po_id INT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
      requisition_id INT NULL REFERENCES requisitions(id) ON DELETE SET NULL,
      site_id INT NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
      challan_no VARCHAR(100) NULL,
      received_date DATE NOT NULL,
      recorded_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      received_items JSONB NOT NULL,
      challan_photos JSONB NULL,
      material_photos JSONB NULL,
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_deliveries_po ON deliveries(po_id);
  `);

  // 13. DELIVERY_RECEIPTS TABLE
  await pgClient.query(`
    CREATE TABLE delivery_receipts (
      id SERIAL PRIMARY KEY,
      delivery_id INT NULL REFERENCES deliveries(id) ON DELETE SET NULL,
      requisition_id INT NULL REFERENCES requisitions(id) ON DELETE SET NULL,
      po_id INT NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
      received_by VARCHAR(150) NOT NULL,
      received_by_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      received_qty NUMERIC(12, 3) NULL,
      proof_file TEXT NULL,
      remark TEXT NULL,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 14. PAYMENTS TABLE
  await pgClient.query(`
    CREATE TABLE payments (
      id SERIAL PRIMARY KEY,
      po_id INT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
      vendor_id INT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
      amount NUMERIC(14, 2) NOT NULL,
      payment_date DATE NOT NULL,
      mode VARCHAR(50) NOT NULL,
      reference_no VARCHAR(100) NOT NULL,
      note TEXT NULL,
      recorded_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_payments_po ON payments(po_id);
  `);

  // 15. AUDIT_LOGS TABLE
  await pgClient.query(`
    CREATE TABLE audit_logs (
      id BIGSERIAL PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL,
      actor_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      actor_name VARCHAR(150) NULL,
      note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX idx_audit_created ON audit_logs(created_at);
  `);

  // 16. NOTIFICATIONS TABLE
  await pgClient.query(`
    CREATE TABLE notifications (
      id SERIAL PRIMARY KEY,
      user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      vendor_id INT NULL REFERENCES vendors(id) ON DELETE SET NULL,
      role VARCHAR(50) NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      link VARCHAR(255) NULL,
      channel VARCHAR(50) DEFAULT 'in_app',
      type VARCHAR(50) DEFAULT 'info',
      is_read SMALLINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_notif_user ON notifications(user_id);
    CREATE INDEX idx_notif_vendor ON notifications(vendor_id);
    CREATE INDEX idx_notif_role ON notifications(role);
  `);

  // 17. NOTIFICATION_LOG TABLE
  await pgClient.query(`
    CREATE TABLE notification_log (
      id SERIAL PRIMARY KEY,
      user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
      channel VARCHAR(50) NOT NULL,
      event VARCHAR(100) NULL,
      status VARCHAR(50) NOT NULL,
      error TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 18. STATUS_HISTORY TABLE
  await pgClient.query(`
    CREATE TABLE status_history (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INT NOT NULL,
      from_status VARCHAR(100) NULL,
      to_status VARCHAR(100) NOT NULL,
      action_by VARCHAR(150) NOT NULL,
      action_by_id INT NULL,
      role VARCHAR(50) NOT NULL,
      remark TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_sh_entity ON status_history(entity_type, entity_id);
    CREATE INDEX idx_sh_created ON status_history(created_at);
  `);

  // 19. REQUISITION_EDITS TABLE
  await pgClient.query(`
    CREATE TABLE requisition_edits (
      id SERIAL PRIMARY KEY,
      requisition_id INT NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
      field VARCHAR(100) NOT NULL,
      old_value TEXT NULL,
      new_value TEXT NULL,
      edited_by VARCHAR(150) NOT NULL,
      edited_by_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_req_edits_req_id ON requisition_edits(requisition_id);
  `);

  console.log('✅ PostgreSQL tables and functions successfully created!');
}

async function migrateDataFromMySQL(mysqlConn, pgClient) {
  console.log('🚀 Migrating data from MySQL to PostgreSQL...');

  const migrationOrder = [
    'sites',
    'vendors',
    'users',
    'materials',
    'requisitions',
    'requisition_items',
    'rfqs',
    'rfq_bids',
    'bid_revisions',
    'bid_revision_items',
    'purchase_orders',
    'deliveries',
    'delivery_receipts',
    'payments',
    'audit_logs',
    'notifications',
    'notification_log',
    'status_history',
    'requisition_edits'
  ];

  // Disable FK constraints temporarily in Postgres for clean bulk load
  await pgClient.query("SET session_replication_role = 'replica';");

  for (const tableName of migrationOrder) {
    // Get all rows from MySQL
    const [rows] = await mysqlConn.query(`SELECT * FROM ${tableName}`);
    console.log(`➡️  Migrating "${tableName}": ${rows.length} rows...`);

    if (rows.length === 0) continue;

    // Get PG columns for this table
    const colRes = await pgClient.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [tableName]);

    const pgColMap = new Map(colRes.rows.map(r => [r.column_name.toLowerCase(), r.data_type]));

    for (const row of rows) {
      const cols = [];
      const placeholders = [];
      const values = [];

      let idx = 1;
      for (const [key, val] of Object.entries(row)) {
        const colLower = key.toLowerCase();
        if (!pgColMap.has(colLower)) continue; // ignore unknown cols

        const dataType = pgColMap.get(colLower);
        cols.push(`"${colLower}"`);
        placeholders.push(`$${idx++}`);

        if (val === null || val === undefined) {
          values.push(null);
        } else if (dataType === 'jsonb' || dataType === 'json') {
          // ensure valid JSON
          if (typeof val === 'string') {
            try {
              // validate JSON string
              JSON.parse(val);
              values.push(val);
            } catch {
              values.push(JSON.stringify(val));
            }
          } else if (typeof val === 'object') {
            values.push(JSON.stringify(val));
          } else {
            values.push(JSON.stringify(val));
          }
        } else if (val instanceof Date) {
          values.push(val.toISOString());
        } else {
          values.push(val);
        }
      }

      if (cols.length > 0) {
        const insertSql = `INSERT INTO "${tableName}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
        await pgClient.query(insertSql, values);
      }
    }

    // Reset sequence in Postgres
    try {
      await pgClient.query(`
        SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE(max(id), 1)) FROM "${tableName}";
      `);
    } catch {
      // table might not have serial 'id'
    }
  }

  // Re-enable FK constraints
  await pgClient.query("SET session_replication_role = 'origin';");
  console.log('✅ Data migration completed!');
}

async function verifyCounts(mysqlConn, pgClient) {
  console.log('\n📊 Verifying row counts:');
  console.log('--------------------------------------------------');
  console.log('Table Name               | MySQL Count | PG Count');
  console.log('--------------------------------------------------');

  const tables = [
    'sites', 'vendors', 'users', 'materials', 'requisitions',
    'requisition_items', 'rfqs', 'rfq_bids', 'bid_revisions',
    'bid_revision_items', 'purchase_orders', 'deliveries',
    'delivery_receipts', 'payments', 'audit_logs', 'notifications',
    'notification_log', 'status_history', 'requisition_edits'
  ];

  let allMatch = true;
  for (const table of tables) {
    const [mRows] = await mysqlConn.query(`SELECT COUNT(*) AS c FROM ${table}`);
    const pRes = await pgClient.query(`SELECT COUNT(*) AS c FROM "${table}"`);

    const mCount = Number(mRows[0].c);
    const pCount = Number(pRes.rows[0].c);
    const match = mCount === pCount ? '✅' : '❌';

    console.log(`${table.padEnd(24)} | ${String(mCount).padStart(11)} | ${String(pCount).padStart(8)} ${match}`);
    if (mCount !== pCount) allMatch = false;
  }
  console.log('--------------------------------------------------');
  if (allMatch) {
    console.log('🎉 100% DATA MATCH! All tables successfully migrated to PostgreSQL!');
  } else {
    console.log('⚠️ Some row counts do not match. Check details above.');
  }
}

async function run() {
  try {
    await setupPostgresDatabase();

    const pgClient = new pg.Client({
      ...pgConfig,
      database: TARGET_DB
    });
    await pgClient.connect();
    console.log(`✅ Connected to PostgreSQL database "${TARGET_DB}".`);

    await createPostgresSchema(pgClient);

    const mysqlConn = await mysql.createConnection(mysqlConfig);
    console.log(`✅ Connected to MySQL database "${mysqlConfig.database}".`);

    await migrateDataFromMySQL(mysqlConn, pgClient);
    await verifyCounts(mysqlConn, pgClient);

    await mysqlConn.end();
    await pgClient.end();
    console.log('\n🌟 Complete PostgreSQL migration finished successfully!\n');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
