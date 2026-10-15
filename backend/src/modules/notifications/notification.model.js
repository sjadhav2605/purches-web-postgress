import pool from '../../config/db.js';

export const NotificationModel = {
  async create({ user_id = null, vendor_id = null, role = null, title, message, link = null, type = 'info' }, connection = null) {
    const db = connection || pool;
    const [res] = await db.query(
      `INSERT INTO notifications (user_id, vendor_id, role, title, message, link, type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, vendor_id, role, title, message, link, type]
    );
    return res.insertId;
  },

  async findAllForUser({ userId, vendorId, role, isAdmin = false, limit = 50 }) {
    const conditions = [];
    const params = [];
    const channelCondition = "(channel = 'in_app' OR channel IS NULL)";

    // When role is explicitly 'admin', see all in-app notifications
    if (role === 'admin') {
      const [rows] = await pool.query(
        `SELECT * FROM notifications 
         WHERE ${channelCondition} 
         ORDER BY id DESC LIMIT ?`,
        [Number(limit)]
      );
      return rows;
    }

    if (vendorId) {
      conditions.push("(vendor_id = ? OR role = 'vendor')");
      params.push(vendorId);
    } else if (isAdmin && role) {
      // Administrator viewing as a specific role (e.g. 'pc', 'purchase', 'supervisor', 'director')
      conditions.push('role = ?');
      params.push(role);
    } else {
      // Specific user logged in (e.g. pc@ddpl.com, supervisor@ddpl.com)
      if (userId && role) {
        conditions.push('(user_id = ? OR role = ?)');
        params.push(userId, role);
      } else if (role) {
        conditions.push('role = ?');
        params.push(role);
      } else if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')} AND ${channelCondition}` 
      : `WHERE ${channelCondition}`;

    const [rows] = await pool.query(
      `SELECT * FROM notifications 
       ${whereClause} 
       ORDER BY id DESC LIMIT ?`,
      [...params, Number(limit)]
    );
    return rows;
  },

  async getUnreadCount({ userId, vendorId, role, isAdmin = false }) {
    const conditions = [];
    const params = [];
    const channelCondition = "(channel = 'in_app' OR channel IS NULL)";

    if (role === 'admin') {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0 AND ${channelCondition}`
      );
      return rows[0]?.count || 0;
    }

    if (vendorId) {
      conditions.push("(vendor_id = ? OR role = 'vendor')");
      params.push(vendorId);
    } else if (isAdmin && role) {
      conditions.push('role = ?');
      params.push(role);
    } else {
      if (userId && role) {
        conditions.push('(user_id = ? OR role = ?)');
        params.push(userId, role);
      } else if (role) {
        conditions.push('role = ?');
        params.push(role);
      } else if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')} AND is_read = 0 AND ${channelCondition}` 
      : `WHERE is_read = 0 AND ${channelCondition}`;

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications ${whereClause}`,
      params
    );
    return rows[0]?.count || 0;
  },

  async markAsRead(id) {
    const [res] = await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ?`,
      [id]
    );
    return res.affectedRows > 0;
  },

  async markAllAsRead({ userId }) {
    if (!userId) return 0;
    const channelCondition = "(channel = 'in_app' OR channel IS NULL)";
    const [res] = await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND ${channelCondition}`,
      [userId]
    );
    return res.affectedRows;
  }
};
