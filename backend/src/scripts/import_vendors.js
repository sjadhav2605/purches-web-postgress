import xlsx from 'xlsx';
import path from 'path';
import pool from '../config/db.js';

async function importVendors() {
  const excelPath = path.resolve('../DDPL_Vendor_Register_Cleaned.xlsx');
  console.log('Loading workbook from:', excelPath);
  const workbook = xlsx.readFile(excelPath);

  const vendorImportSheet = workbook.Sheets['Vendor_Import'];
  const vendorRows = xlsx.utils.sheet_to_json(vendorImportSheet);

  const bankSheet = workbook.Sheets['Bank & KYC'];
  const bankRows = xlsx.utils.sheet_to_json(bankSheet);

  console.log(`Found ${vendorRows.length} vendor rows and ${bankRows.length} bank rows.`);

  // Map Bank & KYC rows by vendor name (normalized)
  const bankMap = new Map();
  for (const b of bankRows) {
    if (b.Vendor) {
      bankMap.set(b.Vendor.trim().toLowerCase(), b);
    }
  }

  // 1. Add extra columns to vendors table if they don't exist
  const alterColumns = [
    { name: 'constitution', def: 'VARCHAR(100) NULL' },
    { name: 'gst_treatment', def: 'VARCHAR(150) NULL' },
    { name: 'city', def: 'VARCHAR(100) NULL' },
    { name: 'state', def: 'VARCHAR(100) NULL' },
    { name: 'pin', def: 'VARCHAR(20) NULL' },
    { name: 'contact_person', def: 'VARCHAR(150) NULL' },
    { name: 'designation', def: 'VARCHAR(100) NULL' },
    { name: 'landline', def: 'VARCHAR(50) NULL' },
    { name: 'website', def: 'VARCHAR(255) NULL' },
    { name: 'goods_services', def: 'TEXT NULL' },
    { name: 'brands', def: 'TEXT NULL' },
    { name: 'payment_terms_note', def: 'TEXT NULL' },
    { name: 'review_note', def: 'TEXT NULL' },
    { name: 'account_holder', def: 'VARCHAR(200) NULL' },
    { name: 'bank_name', def: 'VARCHAR(150) NULL' },
    { name: 'branch', def: 'VARCHAR(150) NULL' },
    { name: 'account_no', def: 'VARCHAR(50) NULL' },
    { name: 'account_type', def: 'VARCHAR(50) NULL' },
    { name: 'ifsc', def: 'VARCHAR(25) NULL' },
    { name: 'micr', def: 'VARCHAR(25) NULL' },
    { name: 'year_established', def: 'VARCHAR(20) NULL' },
    { name: 'years_in_business', def: 'INT NULL' },
    { name: 'employees', def: 'VARCHAR(50) NULL' },
    { name: 'form_submitted', def: 'VARCHAR(50) NULL' }
  ];

  const [existingCols] = await pool.query('SHOW COLUMNS FROM vendors');
  const existingColNames = new Set(existingCols.map((c) => c.Field.toLowerCase()));

  for (const col of alterColumns) {
    if (!existingColNames.has(col.name.toLowerCase())) {
      try {
        await pool.query(`ALTER TABLE vendors ADD COLUMN ${col.name} ${col.def}`);
        console.log(`Added column '${col.name}' to vendors table.`);
      } catch (err) {
        console.warn(`Could not add column ${col.name}:`, err.message);
      }
    }
  }

  // 2. Insert or update vendors
  let inserted = 0;
  let updated = 0;

  for (const row of vendorRows) {
    const rawName = row['Vendor name'];
    if (!rawName) continue;
    const vendorName = rawName.trim();

    const bank = bankMap.get(vendorName.toLowerCase()) || {};

    const gstin = row['GSTIN'] ? String(row['GSTIN']).trim() : null;
    const pan = row['PAN'] ? String(row['PAN']).trim() : null;
    const email = row['Email'] ? String(row['Email']).trim() : null;
    const phone = row['Mobile'] ? String(row['Mobile']).trim() : (row['Landline'] ? String(row['Landline']).trim() : null);
    
    // Build combined address if needed
    const parts = [
      row['Address'],
      row['City'],
      row['State'] ? (row['PIN'] ? `${row['State']} - ${row['PIN']}` : row['State']) : row['PIN']
    ].filter(Boolean);
    const combinedAddress = parts.join(', ') || null;

    const rawCats = row['Categories'];
    let categoriesArr = [];
    if (rawCats) {
      categoriesArr = String(rawCats).split(',').map((c) => c.trim()).filter(Boolean);
    }

    const advancePct = Number(row['Advance %']) || 0;
    const creditDays = Number(row['Credit days']) || 30;
    const isActive = row['Import to portal'] === 'Hold' ? 0 : 1;

    // Check if vendor with same name or same gstin exists
    const [existing] = await pool.query(
      'SELECT id FROM vendors WHERE name = ? OR (gstin IS NOT NULL AND gstin = ?)',
      [vendorName, gstin || '___NOT_MATCH___']
    );

    const vendorPayload = {
      name: vendorName,
      constitution: row['Constitution'] || null,
      gstin,
      gst_treatment: row['GST treatment'] || null,
      pan,
      address: combinedAddress,
      city: row['City'] || null,
      state: row['State'] || null,
      pin: row['PIN'] ? String(row['PIN']) : null,
      contact_person: row['Contact person'] || null,
      designation: row['Designation'] || null,
      phone,
      email,
      landline: row['Landline'] ? String(row['Landline']) : null,
      website: row['Website'] || null,
      categories: JSON.stringify(categoriesArr),
      goods_services: row['Goods / services offered'] || null,
      brands: row['Brands'] || null,
      advance_pct: advancePct,
      credit_days: creditDays,
      payment_terms_note: row['Payment terms note'] || null,
      review_note: row['Review note'] || null,
      active: isActive,

      // Bank & KYC
      account_holder: bank['Account holder (if given)'] || null,
      bank_name: bank['Bank'] || null,
      branch: bank['Branch'] || null,
      account_no: bank['Account no.'] ? String(bank['Account no.']) : null,
      account_type: bank['Account type'] || null,
      ifsc: bank['IFSC'] || null,
      micr: bank['MICR'] ? String(bank['MICR']) : null,
      year_established: bank['Year established'] ? String(bank['Year established']) : null,
      years_in_business: Number(bank['Years in business']) || null,
      employees: bank['Employees'] ? String(bank['Employees']) : null,
      form_submitted: bank['Form submitted'] ? String(bank['Form submitted']) : null
    };

    if (existing.length > 0) {
      const vId = existing[0].id;
      const setClauses = Object.keys(vendorPayload).map((k) => `\`${k}\` = ?`).join(', ');
      const values = [...Object.values(vendorPayload), vId];
      await pool.query(`UPDATE vendors SET ${setClauses} WHERE id = ?`, values);
      updated++;
    } else {
      const cols = Object.keys(vendorPayload).map((k) => `\`${k}\``).join(', ');
      const placeholders = Object.keys(vendorPayload).map(() => '?').join(', ');
      const values = Object.values(vendorPayload);
      await pool.query(`INSERT INTO vendors (${cols}) VALUES (${placeholders})`, values);
      inserted++;
    }
  }

  console.log(`\nImport complete! Inserted: ${inserted}, Updated: ${updated}`);

  // Link default vendor user to the first active vendor if not linked
  const [activeVendors] = await pool.query('SELECT id, name FROM vendors WHERE active = 1 ORDER BY id ASC LIMIT 1');
  if (activeVendors.length > 0) {
    await pool.query("UPDATE users SET vendor_id = ? WHERE role = 'vendor' AND (vendor_id IS NULL OR vendor_id = 0)", [activeVendors[0].id]);
    console.log(`Linked vendor user to '${activeVendors[0].name}' (ID: ${activeVendors[0].id})`);
  }

  const [totalVendors] = await pool.query('SELECT COUNT(*) as total FROM vendors');
  console.log(`Total vendors in database now: ${totalVendors[0].total}`);

  process.exit(0);
}

importVendors().catch((err) => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
