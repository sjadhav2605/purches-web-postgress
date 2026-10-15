import pool from '../../config/db.js';

export const auditService = {
  /**
   * Fetch recent audit trail entries
   */
  async getRecentAuditLogs(limit = 150) {
    const [rows] = await pool.query(
      `SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?`,
      [Number(limit) || 150]
    );
    return rows;
  }
};

export default auditService;
