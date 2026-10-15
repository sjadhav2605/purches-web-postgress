import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

/**
 * Automatically ensures all PostgreSQL tables and initial seed data exist.
 * Safe to run on every startup (idempotent: uses IF NOT EXISTS and checks before inserting).
 */
export async function ensureDatabaseSchema() {
  console.log('🔄 Checking PostgreSQL database schema & tables...');

  try {
    // 1. json_set compatibility functions
    await pool.query(`
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

    // 2. Core Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        address TEXT NOT NULL,
        gstin VARCHAR(20) NULL,
        active SMALLINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sites_code ON sites(code);

      CREATE TABLE IF NOT EXISTS vendors (
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
      CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);

      CREATE TABLE IF NOT EXISTS users (
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
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

      CREATE TABLE IF NOT EXISTS materials (
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
      CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
      CREATE INDEX IF NOT EXISTS idx_materials_desc ON materials(description);

      CREATE TABLE IF NOT EXISTS requisitions (
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
        dispatch_link_reopened BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_pr_no ON requisitions(pr_no);
      CREATE INDEX IF NOT EXISTS idx_pr_status ON requisitions(status);
      CREATE INDEX IF NOT EXISTS idx_pr_created ON requisitions(created_at);

      CREATE TABLE IF NOT EXISTS requisition_items (
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
      CREATE INDEX IF NOT EXISTS idx_req_items_req_id ON requisition_items(requisition_id);

      CREATE TABLE IF NOT EXISTS rfqs (
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
        dispatch_link_reopened BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_rfqs_req_id ON rfqs(requisition_id);

      CREATE TABLE IF NOT EXISTS rfq_bids (
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

      CREATE TABLE IF NOT EXISTS bid_revisions (
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
      CREATE INDEX IF NOT EXISTS idx_bid_rev_rfq ON bid_revisions(rfq_id);
      CREATE INDEX IF NOT EXISTS idx_bid_rev_bid ON bid_revisions(bid_id);
      CREATE INDEX IF NOT EXISTS idx_bid_rev_vendor ON bid_revisions(vendor_id);

      CREATE TABLE IF NOT EXISTS bid_revision_items (
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
      CREATE INDEX IF NOT EXISTS idx_rev_items_rev_id ON bid_revision_items(revision_id);

      CREATE TABLE IF NOT EXISTS purchase_orders (
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
        extra_charges JSONB NULL DEFAULT '{}'::jsonb,
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
      CREATE INDEX IF NOT EXISTS idx_po_no ON purchase_orders(po_no);
      CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

      CREATE TABLE IF NOT EXISTS deliveries (
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
        damage_photos JSONB NULL,
        damage_remarks TEXT NULL,
        damaged_items JSONB NULL,
        remarks TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_deliveries_po ON deliveries(po_id);

      CREATE TABLE IF NOT EXISTS delivery_receipts (
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

      CREATE TABLE IF NOT EXISTS payments (
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
      CREATE INDEX IF NOT EXISTS idx_payments_po ON payments(po_id);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        actor_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
        actor_name VARCHAR(150) NULL,
        note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

      CREATE TABLE IF NOT EXISTS notifications (
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
      CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notif_vendor ON notifications(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_notif_role ON notifications(role);

      CREATE TABLE IF NOT EXISTS notification_log (
        id SERIAL PRIMARY KEY,
        user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
        channel VARCHAR(50) NOT NULL,
        event VARCHAR(100) NULL,
        status VARCHAR(50) NOT NULL,
        error TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS status_history (
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
      CREATE INDEX IF NOT EXISTS idx_sh_entity ON status_history(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_sh_created ON status_history(created_at);

      CREATE TABLE IF NOT EXISTS requisition_edits (
        id SERIAL PRIMARY KEY,
        requisition_id INT NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
        field VARCHAR(100) NOT NULL,
        old_value TEXT NULL,
        new_value TEXT NULL,
        edited_by VARCHAR(150) NOT NULL,
        edited_by_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_req_edits_req_id ON requisition_edits(requisition_id);

      CREATE TABLE IF NOT EXISTS vendor_billed_challans (
        id SERIAL PRIMARY KEY,
        challan_no VARCHAR(100) NOT NULL,
        challan_date DATE NOT NULL,
        po_id INT NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
        requisition_id INT NULL REFERENCES requisitions(id) ON DELETE SET NULL,
        vendor_id INT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        basic_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        freight_charges NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        loading_unloading_charges NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        packaging_charges NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        other_charges NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        gst_percent NUMERIC(5, 2) NULL DEFAULT 18.00,
        gst_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        document_file TEXT NULL,
        document_name VARCHAR(255) NULL,
        vehicle_no VARCHAR(100) NULL,
        notes TEXT NULL,
        created_by_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
        created_by_name VARCHAR(150) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_vbc_po ON vendor_billed_challans(po_id);
      CREATE INDEX IF NOT EXISTS idx_vbc_vendor ON vendor_billed_challans(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_vbc_site ON vendor_billed_challans(site_id);
      CREATE INDEX IF NOT EXISTS idx_vbc_challan_no ON vendor_billed_challans(challan_no);
      CREATE INDEX IF NOT EXISTS idx_vbc_status ON vendor_billed_challans(status);

      -- Ensure optional/added columns exist in existing tables
      ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS extra_charges JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS declaration_text TEXT NULL;
      ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_updated_by_id INT NULL;
      ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_updated_by_name VARCHAR(150) NULL;
      ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_updated_at VARCHAR(50) NULL;

      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS damage_photos JSONB NULL;
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS damage_remarks TEXT NULL;
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS damaged_items JSONB NULL;

      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS target_director_id INT NULL;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS target_director_name VARCHAR(100) NULL;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS dispatch_date DATE NULL;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS vehicle_no VARCHAR(100) NULL;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS transport_name VARCHAR(150) NULL;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS challan_no VARCHAR(100) NULL;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS dispatched_qty NUMERIC(12, 3) NULL;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS dispatch_remarks TEXT NULL;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255) NULL DEFAULT 'Net 30 Days Credit';
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS advance_pct NUMERIC(5, 2) NULL DEFAULT 0.00;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS credit_days INT NULL DEFAULT 30;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS payment_terms_notes TEXT NULL;
      ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS dispatch_link_reopened BOOLEAN DEFAULT FALSE;

      ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS dispatch_link_reopened BOOLEAN DEFAULT FALSE;

      ALTER TABLE requisition_items ADD COLUMN IF NOT EXISTS approved_rate NUMERIC(15, 2) NULL;
    `);

    console.log('✅ PostgreSQL tables verified/created successfully.');

    // 3. Ensure Default Master Data & Users
    await ensureSeedData();

  } catch (err) {
    console.error('❌ Error during ensureDatabaseSchema:', err.message, err.stack);
  }
}

async function ensureSeedData() {
  const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // Default Sites
  const [siteRows] = await pool.query("SELECT id FROM sites WHERE code = 'CC-PIRANGUT' LIMIT 1");
  if (siteRows.length === 0) {
    await pool.query(`
      INSERT INTO sites (code, name, address, gstin, active) VALUES 
      ('CC-PIRANGUT', 'Coca-Cola India Pvt Ltd, Pune Concentrate Plant', 'Plot No. 1109-1110, Village Pirangut, Mulshi, Pune 412115', '27AAACB8573G1ZJ', 1),
      ('INFO-SDB7', 'Infosys Phase-II, SDB 7, 2nd Floor', 'Infosys Campus, Hinjawadi Phase 2, Pune', '27AAECD7921Q1Z2', 1)
      ON CONFLICT DO NOTHING
    `);
    console.log('📍 Initial Sites seeded.');
  }

  // Default Vendors
  const [vendorRows] = await pool.query("SELECT id FROM vendors LIMIT 1");
  if (vendorRows.length === 0) {
    await pool.query(`
      INSERT INTO vendors (name, gstin, email, phone, address, categories, advance_pct, credit_days, active) 
      VALUES 
      ('Generic Building Supplies Co.', '27AAACG0000A1Z5', 'contact@genericbuilding.in', '+91 98220 12345', 'MIDC Industrial Area, Pune 411018', '["Civil / Structural", "Plaster & Masonry"]', 0, 30, 1),
      ('Sundeep & Company Server', '27ADAFS7037E1Z5', 'sales@sundeepcompany.com', '+91 98224 56789', '25 New Timber Market, Pune 411042', '["Plaster & Masonry", "Paint & Finishing"]', 50, 15, 1)
      ON CONFLICT DO NOTHING
    `);
    console.log('🏢 Initial Vendors seeded.');
  }

  // Default Materials
  const [materialRows] = await pool.query("SELECT id FROM materials LIMIT 1");
  if (materialRows.length === 0) {
    await pool.query(`
      INSERT INTO materials (description, spec, unit, category, ref_rate, active) VALUES 
      ('OPC 53 Grade Cement, 50 Kg Bag', 'IS 12269', 'Bag', 'Civil / Structural', 400.00, 1),
      ('Ready-Mix Plaster UltraTech READIPLAST, 40 Kg Bag', 'Ready-to-use', 'Bag', 'Plaster & Masonry', 241.52, 1),
      ('River Sand', 'Washed coarse sand', 'Brass', 'Civil / Structural', 4500.00, 1),
      ('Apex Ultima Exterior Emulsion', 'Asian Paints White', 'Liter', 'Paint & Finishing', 450.00, 1)
      ON CONFLICT DO NOTHING
    `);
    console.log('🧱 Initial Materials seeded.');
  }

  // Default Users for All Roles
  const defaultUsers = [
    { email: 'admin@ddpl.com', name: 'DDPL Administrator', role: 'admin' },
    { email: 'supervisor@ddpl.com', name: 'Site Supervisor Ramesh', role: 'supervisor', default_site_id: 1 },
    { email: 'pc@ddpl.com', name: 'Project Coordinator Joshi', role: 'pc' },
    { email: 'purchase@ddpl.com', name: 'Purchase Manager Sharma', role: 'purchase' },
    { email: 'director1@ddpl.com', name: 'Director 1', role: 'director' },
    { email: 'director2@ddpl.com', name: 'Director 2', role: 'director' },
    { email: 'director3@ddpl.com', name: 'Director 3', role: 'director' },
    { email: 'accounts@ddpl.com', name: 'Senior Accountant Kulkarni', role: 'accounts' },
    { email: 'vendor@ddpl.com', name: 'Generic Building Supplies', role: 'vendor', vendor_id: 1 }
  ];

  for (const u of defaultUsers) {
    const [existing] = await pool.query("SELECT id, password_hash FROM users WHERE email = ? LIMIT 1", [u.email]);
    if (existing.length > 0) {
      // Repair seeded accounts whose stored hash is malformed (valid bcrypt = 60 chars, $2a/$2b/$2y).
      // Such rows can never authenticate. Valid hashes (incl. user-changed passwords) are left untouched.
      const hash = existing[0].password_hash || '';
      if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
        await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, existing[0].id]);
        console.log(`🔧 Repaired malformed password hash for seeded user: ${u.email}`);
      }
    }
    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, status, vendor_id, default_site_id) 
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
        [u.email, passwordHash, u.name, u.role, u.vendor_id || null, u.default_site_id || null]
      );
      console.log(`👤 Seeded user: ${u.email} (${u.role})`);
    }
  }

  // Synchronize Director IDs to 5, 10, 11 (matching the system's role switcher definitions)
  try {
    await pool.query(`
      UPDATE users SET id = 10 WHERE email = 'director2@ddpl.com' AND id != 10;
      UPDATE users SET id = 11 WHERE email = 'director3@ddpl.com' AND id != 11;
      UPDATE users SET id = 5 WHERE email = 'director1@ddpl.com' AND id != 5;

      -- Update any existing RFQs or requisitions assigned to legacy IDs (6 -> 10, 7 -> 11)
      UPDATE rfqs SET target_director_id = 10 WHERE target_director_id = 6;
      UPDATE rfqs SET target_director_id = 11 WHERE target_director_id = 7;
      UPDATE requisitions SET target_director_id = 10 WHERE target_director_id = 6;
      UPDATE requisitions SET target_director_id = 11 WHERE target_director_id = 7;

      -- Also if target_director_name matches Director 2 or 3, ensure target_director_id is set
      UPDATE rfqs SET target_director_id = 10 WHERE LOWER(target_director_name) LIKE '%director 2%' AND target_director_id IS NULL;
      UPDATE rfqs SET target_director_id = 11 WHERE LOWER(target_director_name) LIKE '%director 3%' AND target_director_id IS NULL;
      UPDATE requisitions SET target_director_id = 10 WHERE LOWER(target_director_name) LIKE '%director 2%' AND target_director_id IS NULL;
      UPDATE requisitions SET target_director_id = 11 WHERE LOWER(target_director_name) LIKE '%director 3%' AND target_director_id IS NULL;

      SELECT setval('users_id_seq', (SELECT GREATEST(MAX(id), 20) FROM users));
    `);
    console.log('🏛️ Director IDs (5, 10, 11) synchronized successfully.');
  } catch (err) {
    console.warn('Note on Director ID sync:', err.message);
  }
}
