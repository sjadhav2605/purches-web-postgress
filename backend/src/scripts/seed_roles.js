import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

async function seedRoles() {
  const hash = await bcrypt.hash('Admin@123', 10);

  // 1. Add accounts user if not present
  const [acc] = await pool.query("SELECT id FROM users WHERE email = 'accounts@ddpl.com'");
  if (acc.length === 0) {
    await pool.query(
      "INSERT INTO users (email, password_hash, name, role, status) VALUES ('accounts@ddpl.com', ?, 'Senior Accountant Kulkarni', 'accounts', 'active')",
      [hash]
    );
    console.log('Created accounts@ddpl.com');
  }

  // 2. Link vendor user to vendor_id 1
  await pool.query("UPDATE users SET vendor_id = 1 WHERE email = 'vendor@ddpl.com'");
  console.log('Linked vendor@ddpl.com to vendor_id 1');

  // 3. Update PR 10 to requested_by_id = 2 (Site Supervisor)
  await pool.query("UPDATE requisitions SET requested_by_id = 2 WHERE id = 10");
  console.log('Updated PR 10 requested_by_id to 2');

  const [users] = await pool.query("SELECT id, email, name, role, vendor_id FROM users");
  console.log('Current Users:', users);

  process.exit(0);
}

seedRoles().catch((err) => {
  console.error('Error seeding roles:', err);
  process.exit(1);
});
