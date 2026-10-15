import pool from './src/config/db.js';

async function main() {
  const [rows] = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deliveries'");
  console.log('deliveries columns:', rows.map(r => r.column_name));
  const [r2] = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'delivery_receipts'");
  console.log('delivery_receipts columns:', r2.map(r => r.column_name));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
