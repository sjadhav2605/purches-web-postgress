import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

async function test() {
  try {
    const [rows] = await pool.query("SELECT id, name, email, password_hash FROM users WHERE email LIKE '%director%'");
    for (const r of rows) {
      const matchAdminUpper = await bcrypt.compare('Admin@123', r.password_hash);
      const matchAdminLower = await bcrypt.compare('admin@123', r.password_hash);
      console.log(r.id, r.name, r.email, 'Admin@123:', matchAdminUpper, 'admin@123:', matchAdminLower);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

test();
