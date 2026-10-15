import pool from '../../config/db.js';

/**
 * Auth Model:
 * Pure database layer for user authentication.
 * Uses parameterized queries to prevent SQL injection.
 */
export const AuthModel = {
  /**
   * Find user by email (including password_hash for authentication)
   */
  async findByEmail(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const emailsToMatch = [cleanEmail];
    if (cleanEmail === 'director1@ddpl.com') emailsToMatch.push('director@ddpl.com');
    if (cleanEmail === 'director@ddpl.com') emailsToMatch.push('director1@ddpl.com');
    if (cleanEmail === 'director2@ddpl.com') emailsToMatch.push('director.patil@ddpl.com');
    if (cleanEmail === 'director.patil@ddpl.com') emailsToMatch.push('director2@ddpl.com');
    if (cleanEmail === 'director3@ddpl.com') emailsToMatch.push('director.deshmukh@ddpl.com');
    if (cleanEmail === 'director.deshmukh@ddpl.com') emailsToMatch.push('director3@ddpl.com');

    const [rows] = await pool.query(
      `SELECT id, email, password_hash, name, role, status, vendor_id, default_site_id, created_at 
       FROM users 
       WHERE email IN (?) 
       LIMIT 1`,
      [emailsToMatch]
    );
    return rows[0] || null;
  },

  /**
   * Find user by ID (excluding password_hash)
   */
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.vendor_id, u.default_site_id, 
              s.name AS default_site_name, v.name AS vendor_name, u.created_at 
       FROM users u
       LEFT JOIN sites s ON u.default_site_id = s.id
       LEFT JOIN vendors v ON u.vendor_id = v.id
       WHERE u.id = ? 
       LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create new user
   */
  async create({ email, password_hash, name, role, vendor_id = null, default_site_id = null }) {
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, vendor_id, default_site_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, password_hash, name, role, vendor_id, default_site_id]
    );
    return result.insertId;
  }
};
