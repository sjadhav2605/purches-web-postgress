import pool from '../config/db.js';

async function migrate() {
  console.log('--- Creating vendor_billed_challans table ---');
  
  const createTableQuery = `
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
  `;

  await pool.query(createTableQuery);
  console.log('✅ vendor_billed_challans table created successfully!');

  // Check if we can seed 1 sample record for demonstration
  const [existing] = await pool.query('SELECT COUNT(*) as count FROM vendor_billed_challans');
  if (Number(existing[0].count) === 0) {
    // Look for an existing PO or site and vendor
    const [pos] = await pool.query('SELECT id, po_no, requisition_id, vendor_id, site_id, total_amount FROM purchase_orders LIMIT 1');
    if (pos.length > 0) {
      const p = pos[0];
      const baseAmt = 45000.00;
      const freight = 2500.00;
      const loading = 1200.00;
      const packaging = 500.00;
      const other = 300.00;
      const sub = baseAmt + freight + loading + packaging + other; // 49500
      const gstAmt = sub * 0.18; // 8910
      const total = sub + gstAmt; // 58410

      await pool.query(`
        INSERT INTO vendor_billed_challans (
          challan_no, challan_date, po_id, requisition_id, vendor_id, site_id,
          basic_amount, freight_charges, loading_unloading_charges, packaging_charges, other_charges,
          gst_percent, gst_amount, total_amount, vehicle_no, notes,
          created_by_id, created_by_name, status
        ) VALUES (
          'CH-VEND-2026-9011', CURRENT_DATE, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          18.00, ?, ?, 'MH-12-AB-4509', 'Full commercial challan with transport and loading charges included.',
          3, 'Purchase Manager', 'Submitted'
        )
      `, [p.id, p.requisition_id, p.vendor_id, p.site_id, baseAmt, freight, loading, packaging, other, gstAmt, total]);

      console.log('✅ Seeded 1 sample Vendor Billed Challan for PO #' + p.po_no);
    }
  }

  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
