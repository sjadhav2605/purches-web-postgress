import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function viewDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'ddpl_procurement'
  });

  try {
    const client = await pool.connect();
    console.log('\n======================================================');
    console.log('📦 PostgreSQL Database: ddpl_procurement');
    console.log('======================================================\n');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('📋 Total Tables in Database: ' + res.rows.length + '\n');
    console.log('------------------------------------------------------');
    console.log('Table Name                 | Row Count');
    console.log('------------------------------------------------------');

    for (const row of res.rows) {
      const tName = row.table_name;
      const countRes = await client.query(`SELECT COUNT(*) AS c FROM "${tName}"`);
      const count = countRes.rows[0].c;
      console.log(`${tName.padEnd(26)} | ${String(count).padStart(9)} rows`);
    }

    console.log('------------------------------------------------------\n');
    console.log('💡 Quick View Examples:');
    console.log('1. pgAdmin 4: Start Menu -> "pgAdmin 4" -> Databases -> ddpl_procurement -> Schemas -> public -> Tables');
    console.log('2. psql CLI: psql -U postgres -d ddpl_procurement -c "\\dt"');
    console.log('======================================================\n');

    client.release();
  } catch (err) {
    console.error('Error connecting to database:', err.message);
  } finally {
    await pool.end();
  }
}

viewDatabase();
