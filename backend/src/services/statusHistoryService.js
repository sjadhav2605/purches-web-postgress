import pool from '../config/db.js';
import { formatWorkflowDateTime } from '../utils/dateFormatter.js';

export const StatusHistoryService = {
  /**
   * Records a status transition into both status_history and audit_logs
   */
  async recordTransition({
    connection = null,
    entity_type,
    entity_id,
    from_status = null,
    to_status,
    action_by,
    action_by_id = null,
    role,
    remark = null
  }) {
    const db = connection || pool;
    const now = new Date();
    const formattedTs = formatWorkflowDateTime(now);

    // 1. Insert into status_history
    await db.query(
      `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, action_by, action_by_id, role, remark, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entity_type,
        Number(entity_id),
        from_status || null,
        to_status,
        action_by,
        action_by_id || null,
        role,
        remark || null,
        now
      ]
    );

    // 2. Also write to audit_logs
    const auditAction = to_status;
    const noteText = remark 
      ? `[${role.toUpperCase()}] ${action_by}: Changed status to ${to_status} at ${formattedTs}. Remark: ${remark}`
      : `[${role.toUpperCase()}] ${action_by}: Changed status to ${to_status} at ${formattedTs}`;

    await db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entity_type.toUpperCase(),
        String(entity_id),
        auditAction,
        action_by_id || null,
        action_by,
        noteText,
        now
      ]
    );
  },

  /**
   * Retrieves status history records for an entity
   */
  async getHistory(entity_type, entity_id) {
    const [rows] = await pool.query(
      `SELECT * FROM status_history 
       WHERE entity_type = ? AND entity_id = ? 
       ORDER BY id ASC`,
      [entity_type, Number(entity_id)]
    );
    return rows;
  }
};
