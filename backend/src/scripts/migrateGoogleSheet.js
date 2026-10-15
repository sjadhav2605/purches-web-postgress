import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';

/**
 * Data Migration Script:
 * Imports historical data from old Google Apps Script exports into the MySQL database.
 */
export const migrateOldData = async () => {
  console.log('🔄 Starting Data Migration from Google Sheets / Old Portal...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Migrate Sites (Coca-Cola, Infosys)
    const sampleSites = [
      { code: 'CC-PIRANGUT', name: 'Coca-Cola India Pvt Ltd, Pune Concentrate Plant', address: 'Plot No. 1109-1110, Village Pirangut, Mulshi, Pune 412115', gstin: '27AAACB8573G1ZJ' },
      { code: 'INFO-SDB7', name: 'Infosys Phase-II, SDB 7, 2nd Floor', address: 'Infosys Campus, Hinjawadi, Pune', gstin: '' }
    ];

    for (const site of sampleSites) {
      await connection.query(
        `INSERT INTO sites (code, name, address, gstin, active) 
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), address = VALUES(address)`,
        [site.code, site.name, site.address, site.gstin]
      );
    }
    console.log('✅ Sites migrated.');

    // 2. Migrate Vendors
    const sampleVendors = [
      { name: 'Generic Building Supplies Co.', gstin: '', email: 'vendor1@example.com', address: 'MIDC, Pune', categories: ['Civil / Structural', 'Plaster & Masonry'] },
      { name: 'Sundeep & Company Server', gstin: '27ADAFS7037E1Z5', email: 'vendor2@example.com', address: '25 New Timber Market, Pune 411042', categories: ['Plaster & Masonry'] }
    ];

    for (const vendor of sampleVendors) {
      await connection.query(
        `INSERT INTO vendors (name, gstin, email, address, categories, active) 
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE address = VALUES(address)`,
        [vendor.name, vendor.gstin, vendor.email, vendor.address, JSON.stringify(vendor.categories)]
      );
    }
    console.log('✅ Vendors migrated.');

    // 3. Migrate Materials
    const sampleMaterials = [
      { description: 'OPC 53 Grade Cement, 50 Kg Bag', unit: 'Bag', category: 'Civil / Structural', refRate: 400.00 },
      { description: 'Ready-Mix Plaster — UltraTech READIPLAST PROJEKT, 40 Kg Bag', unit: 'Bag', category: 'Plaster & Masonry', refRate: 241.52 },
      { description: 'River Sand', unit: 'Brass', category: 'Civil / Structural', refRate: 4500.00 },
      { description: 'Asian Paints Exterior Emulsion', unit: 'Brass', category: 'Paint & Finishing', refRate: 4200.00 }
    ];

    for (const mat of sampleMaterials) {
      await connection.query(
        `INSERT INTO materials (description, unit, category, ref_rate, active) 
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE ref_rate = VALUES(ref_rate)`,
        [mat.description, mat.unit, mat.category, mat.refRate]
      );
    }
    console.log('✅ Materials migrated.');

    await connection.commit();
    console.log('🎉 Data Migration completed successfully!');
  } catch (error) {
    await connection.rollback();
    console.error('❌ Migration failed:', error.message);
  } finally {
    connection.release();
    process.exit(0);
  }
};

// Run if called directly
if (process.argv[1]?.endsWith('migrateGoogleSheet.js')) {
  migrateOldData();
}
