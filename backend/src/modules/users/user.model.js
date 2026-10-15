import pool from '../../config/db.js';

export const userModel = {
  /**
   * Fetch all active directors ordered by ID
   */
  async findActiveDirectors() {
    const [rows] = await pool.query(
      `SELECT id, name, email, phone FROM users WHERE role = 'director' AND status = 'active' ORDER BY id ASC`
    );
    return rows;
  },

  /**
   * Fetch all portal users with joined site & vendor names
   */
  async findAllUsers() {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.phone, u.name, u.role, u.status, u.vendor_id, u.default_site_id, 
              s.name AS site_name, s.code AS site_code, v.name AS vendor_name, u.created_at
       FROM users u
       LEFT JOIN sites s ON u.default_site_id = s.id
       LEFT JOIN vendors v ON u.vendor_id = v.id
       ORDER BY u.id DESC`
    );
    return rows;
  },

  /**
   * Find a single user by ID with site details
   */
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.phone, u.name, u.role, u.status, u.default_site_id, s.name AS site_name, s.code AS site_code, u.created_at
       FROM users u
       LEFT JOIN sites s ON u.default_site_id = s.id
       WHERE u.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find user by exact email
   */
  async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Check for duplicate email excluding a specific user ID
   */
  async findDuplicateEmail(email, excludeId) {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = ? AND id <> ? LIMIT 1',
      [email.toLowerCase(), excludeId]
    );
    return rows[0] || null;
  },

  /**
   * Insert new user record
   */
  async createUser({ name, email, phone, role, default_site_id, password_hash }) {
    const [insertResult] = await pool.query(
      `INSERT INTO users (name, email, phone, role, status, default_site_id, password_hash)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      [name, email, phone, role, default_site_id, password_hash]
    );
    return insertResult.insertId;
  },

  /**
   * Dynamic update query
   */
  async updateUser(id, fields, params) {
    if (fields.length === 0) return;
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  }
};

export default userModel;
