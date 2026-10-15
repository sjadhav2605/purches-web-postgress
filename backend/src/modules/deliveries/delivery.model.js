import pool from '../../config/db.js';

export const DeliveryModel = {
  // scope: { sql, params } from utils/dataScope (sql === null => no restriction)
  async findAll({ scope = null } = {}) {
    const [rows] = await pool.query(
      `SELECT d.*, po.po_no, s.name AS site_name, s.code AS site_code, u.name AS recorded_by_name, v.name AS vendor_name, v.phone AS vendor_phone, v.email AS vendor_email
       FROM deliveries d
       JOIN purchase_orders po ON d.po_id = po.id
       JOIN sites s ON d.site_id = s.id
       JOIN users u ON d.recorded_by_id = u.id
       JOIN vendors v ON po.vendor_id = v.id
       ${scope?.sql ? `WHERE ${scope.sql}` : ''}
       ORDER BY d.id DESC`,
      scope?.sql ? scope.params : []
    );
    const parseJsonSafe = (val) => {
      if (!val) return [];
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch (e) { return []; }
    };
    return rows.map(r => ({
      ...r,
      challan_photos: parseJsonSafe(r.challan_photos),
      material_photos: parseJsonSafe(r.material_photos),
      damage_photos: parseJsonSafe(r.damage_photos),
      received_items: parseJsonSafe(r.received_items),
      damaged_items: parseJsonSafe(r.damaged_items)
    }));
  },

  async create({ po_id, requisition_id, site_id, challan_no, received_date, recorded_by_id, received_items, challan_photos, material_photos, damage_photos, remarks, damage_remarks, damaged_items }, connection = pool) {
    const [res] = await connection.query(
      `INSERT INTO deliveries (po_id, requisition_id, site_id, challan_no, received_date, recorded_by_id, received_items, challan_photos, material_photos, damage_photos, remarks, damage_remarks, damaged_items)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        po_id,
        requisition_id || null,
        site_id,
        challan_no || null,
        received_date,
        recorded_by_id,
        JSON.stringify(received_items || []),
        JSON.stringify(challan_photos || []),
        JSON.stringify(material_photos || []),
        JSON.stringify(damage_photos || []),
        remarks || null,
        damage_remarks || null,
        JSON.stringify(damaged_items || [])
      ]
    );
    return res.insertId;
  }
};
