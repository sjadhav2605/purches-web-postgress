import pool from './src/config/db.js';

async function main() {
  const [rows] = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deliveries'");
  console.log('deliveries types:', rows);

  // Add damage_photos if not exists
  await pool.query("ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS damage_photos JSONB DEFAULT '[]'::jsonb");
  await pool.query("ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS damaged_items JSONB DEFAULT '[]'::jsonb");
  await pool.query("ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS damage_remarks TEXT");

  // Ensure challan_photos and material_photos are JSONB or TEXT
  console.log('Added damage_photos, damaged_items, damage_remarks columns to deliveries');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
