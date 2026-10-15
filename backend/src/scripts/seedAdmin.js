import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

/**
 * Seeds initial Administrator and sample master data if not already present
 */
export const seedInitialData = async () => {
  try {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;
    if (!defaultPassword) {
      throw new Error('ADMIN_DEFAULT_PASSWORD environment variable is required for seeding');
    }

    // 1. Check if admin exists
    const [users] = await pool.query("SELECT id FROM users WHERE email = 'admin@ddpl.com' LIMIT 1");
    if (users.length === 0) {
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, status) 
         VALUES (?, ?, ?, 'admin', 'active')`,
        ['admin@ddpl.com', passwordHash, 'DDPL Administrator']
      );
      console.log('👤 Default Admin created: admin@ddpl.com (password from ADMIN_DEFAULT_PASSWORD)');
    }

    // 1b. Ensure Director 1, Director 2, Director 3 exist with generic designations
    const defaultDirectors = [
      { email: 'director1@ddpl.com', altEmail: 'director@ddpl.com', name: 'Director 1', id: 5 },
      { email: 'director2@ddpl.com', altEmail: 'director.patil@ddpl.com', name: 'Director 2', id: 10 },
      { email: 'director3@ddpl.com', altEmail: 'director.deshmukh@ddpl.com', name: 'Director 3', id: 11 }
    ];

    for (const d of defaultDirectors) {
      const [existing] = await pool.query(
        "SELECT id, name FROM users WHERE email = ? OR email = ? OR id = ? LIMIT 1",
        [d.email, d.altEmail, d.id]
      );
      if (existing.length === 0) {
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        await pool.query(
          `INSERT INTO users (id, email, password_hash, name, role, status) 
           VALUES (?, ?, ?, ?, 'director', 'active')`,
          [d.id, d.email, passwordHash, d.name]
        );
        console.log(`🏛️ Seeded ${d.name} (${d.email})`);
      } else if (existing[0].name !== d.name) {
        await pool.query(
          "UPDATE users SET name = ?, email = ? WHERE id = ?",
          [d.name, d.email, existing[0].id]
        );
        console.log(`🏛️ Synchronized ${d.name} for user id ${existing[0].id}`);
      }
    }

    // 2. Check if default site exists
    const [sites] = await pool.query("SELECT id FROM sites WHERE code = 'CC-PIRANGUT' LIMIT 1");
    if (sites.length === 0) {
      await pool.query(
        `INSERT INTO sites (code, name, address, gstin, active) VALUES 
         ('CC-PIRANGUT', 'Coca-Cola India Pvt Ltd, Pune Concentrate Plant', 'Plot No. 1109-1110, Village Pirangut, Mulshi, Pune 412115', '27AAACB8573G1ZJ', 1),
         ('INFO-SDB7', 'Infosys Phase-II, SDB 7, 2nd Floor', 'Infosys Campus, Hinjawadi Phase 2, Pune', '27AAECD7921Q1Z2', 1)
         ON CONFLICT DO NOTHING`
      );
      console.log('📍 Initial Sites seeded: CC-PIRANGUT, INFO-SDB7');
    }

    // 3. Check if default materials exist
    const [materials] = await pool.query("SELECT id FROM materials LIMIT 1");
    if (materials.length === 0) {
      await pool.query(
        `INSERT INTO materials (description, spec, unit, category, ref_rate, active) VALUES 
         ('OPC 53 Grade Cement, 50 Kg Bag', 'IS 12269', 'Bag', 'Civil / Structural', 400.00, 1),
         ('Ready-Mix Plaster UltraTech READIPLAST, 40 Kg Bag', 'Ready-to-use', 'Bag', 'Plaster & Masonry', 241.52, 1),
         ('River Sand', 'Washed coarse sand', 'Brass', 'Civil / Structural', 4500.00, 1),
         ('Apex Ultima Exterior Emulsion', 'Asian Paints White', 'Liter', 'Paint & Finishing', 450.00, 1)`
      );
      console.log('🧱 Initial Materials seeded.');
    }

    // 4. Check if default vendors exist
    const [vendors] = await pool.query("SELECT id FROM vendors LIMIT 1");
    if (vendors.length === 0) {
      await pool.query(
        `INSERT INTO vendors (name, gstin, email, phone, address, categories, advance_pct, credit_days, active) 
         VALUES 
         ('Generic Building Supplies Co.', '27AAACG0000A1Z5', 'contact@genericbuilding.in', '+91 98220 12345', 'MIDC Industrial Area, Pune 411018', '["Civil / Structural", "Plaster & Masonry"]', 0, 30, 1),
         ('Sundeep & Company Server', '27ADAFS7037E1Z5', 'sales@sundeepcompany.com', '+91 98224 56789', '25 New Timber Market, Pune 411042', '["Plaster & Masonry", "Paint & Finishing"]', 50, 15, 1)`
      );
      console.log('🏢 Initial Vendors seeded.');
    }
  } catch (error) {
    console.error('⚠️ Seeding error:', error.message);
  }
};
