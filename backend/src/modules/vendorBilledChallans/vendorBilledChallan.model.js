import pool from '../../config/db.js';

export const VendorBilledChallanModel = {
  // scope: { sql, params } from utils/dataScope (sql === null => no restriction)
  async findAll({ search = '', site_id = null, vendor_id = null, po_id = null, scope = null } = {}) {
    let sql = `
      SELECT vbc.*,
             s.name AS site_name, s.code AS site_code,
             v.name AS vendor_name, v.phone AS vendor_phone, v.gstin AS vendor_gstin,
             po.po_no, po.total_amount AS po_total_amount,
             r.pr_no
      FROM vendor_billed_challans vbc
      LEFT JOIN sites s ON vbc.site_id = s.id
      LEFT JOIN vendors v ON vbc.vendor_id = v.id
      LEFT JOIN purchase_orders po ON vbc.po_id = po.id
      LEFT JOIN requisitions r ON vbc.requisition_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (site_id) {
      sql += ' AND vbc.site_id = ?';
      params.push(site_id);
    }
    if (vendor_id) {
      sql += ' AND vbc.vendor_id = ?';
      params.push(vendor_id);
    }
    if (po_id) {
      sql += ' AND vbc.po_id = ?';
      params.push(po_id);
    }
    if (search && search.trim()) {
      sql += ` AND (
        vbc.challan_no ILIKE ? OR 
        v.name ILIKE ? OR 
        s.name ILIKE ? OR 
        s.code ILIKE ? OR 
        po.po_no ILIKE ? OR 
        vbc.vehicle_no ILIKE ?
      )`;
      const p = `%${search.trim()}%`;
      params.push(p, p, p, p, p, p);
    }

    if (scope?.sql) {
      sql += ` AND ${scope.sql}`;
      params.push(...scope.params);
    }

    sql += ' ORDER BY vbc.challan_date DESC, vbc.id DESC';

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findById(id) {
    const sql = `
      SELECT vbc.*,
             s.name AS site_name, s.code AS site_code, s.address AS site_address,
             v.name AS vendor_name, v.phone AS vendor_phone, v.gstin AS vendor_gstin, v.email AS vendor_email,
             po.po_no, po.total_amount AS po_total_amount,
             r.pr_no
      FROM vendor_billed_challans vbc
      LEFT JOIN sites s ON vbc.site_id = s.id
      LEFT JOIN vendors v ON vbc.vendor_id = v.id
      LEFT JOIN purchase_orders po ON vbc.po_id = po.id
      LEFT JOIN requisitions r ON vbc.requisition_id = r.id
      WHERE vbc.id = ?
      LIMIT 1
    `;
    const [rows] = await pool.query(sql, [id]);
    return rows[0] || null;
  },

  /**
   * Authoritative vendor / site / requisition for a Purchase Order (used to derive billed challan ownership)
   */
  async findPoRefs(poId) {
    const [rows] = await pool.query(
      'SELECT id, vendor_id, site_id, requisition_id FROM purchase_orders WHERE id = ? LIMIT 1',
      [poId]
    );
    return rows[0] || null;
  },

  async create(data) {
    const {
      challan_no,
      challan_date,
      po_id,
      requisition_id,
      vendor_id,
      site_id,
      basic_amount = 0,
      freight_charges = 0,
      loading_unloading_charges = 0,
      packaging_charges = 0,
      other_charges = 0,
      gst_percent = 18,
      gst_amount = 0,
      total_amount = 0,
      document_file = null,
      document_name = null,
      vehicle_no = null,
      notes = null,
      created_by_id = null,
      created_by_name = null,
      status = 'Submitted'
    } = data;

    const sql = `
      INSERT INTO vendor_billed_challans (
        challan_no, challan_date, po_id, requisition_id, vendor_id, site_id,
        basic_amount, freight_charges, loading_unloading_charges, packaging_charges, other_charges,
        gst_percent, gst_amount, total_amount,
        document_file, document_name, vehicle_no, notes,
        created_by_id, created_by_name, status
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `;

    const params = [
      challan_no,
      challan_date,
      po_id || null,
      requisition_id || null,
      vendor_id,
      site_id,
      basic_amount || 0,
      freight_charges || 0,
      loading_unloading_charges || 0,
      packaging_charges || 0,
      other_charges || 0,
      gst_percent || 0,
      gst_amount || 0,
      total_amount || 0,
      document_file || null,
      document_name || null,
      vehicle_no || null,
      notes || null,
      created_by_id || null,
      created_by_name || null,
      status || 'Submitted'
    ];

    const [res] = await pool.query(sql, params);
    return res.insertId;
  },

  async update(id, data) {
    const fields = [];
    const params = [];

    const allowed = [
      'challan_no', 'challan_date', 'po_id', 'requisition_id', 'vendor_id', 'site_id',
      'basic_amount', 'freight_charges', 'loading_unloading_charges', 'packaging_charges', 'other_charges',
      'gst_percent', 'gst_amount', 'total_amount', 'document_file', 'document_name',
      'vehicle_no', 'notes', 'status'
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]);
      }
    }

    if (fields.length === 0) return true;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE vendor_billed_challans SET ${fields.join(', ')} WHERE id = ?`;
    params.push(id);

    const [res] = await pool.query(sql, params);
    return res.affectedRows > 0;
  },

  async delete(id) {
    const [res] = await pool.query('DELETE FROM vendor_billed_challans WHERE id = ?', [id]);
    return res.affectedRows > 0;
  },

  async getFinancialSummary({ site_id = null, vendor_id = null, scope = null } = {}) {
    let sql = `
      SELECT 
        COUNT(vbc.id) AS total_challans,
        COALESCE(SUM(vbc.basic_amount), 0) AS total_basic_amount,
        COALESCE(SUM(vbc.freight_charges), 0) AS total_freight_charges,
        COALESCE(SUM(vbc.gst_amount), 0) AS total_gst_amount,
        COALESCE(SUM(vbc.total_amount), 0) AS grand_total_amount
      FROM vendor_billed_challans vbc
      LEFT JOIN purchase_orders po ON vbc.po_id = po.id
      WHERE 1=1
    `;
    const params = [];
    if (site_id) {
      sql += ' AND vbc.site_id = ?';
      params.push(site_id);
    }
    if (vendor_id) {
      sql += ' AND vbc.vendor_id = ?';
      params.push(vendor_id);
    }
    if (scope?.sql) {
      sql += ` AND ${scope.sql}`;
      params.push(...scope.params);
    }
    const [rows] = await pool.query(sql, params);
    return rows[0] || {
      total_challans: 0,
      total_basic_amount: 0,
      total_freight_charges: 0,
      total_gst_amount: 0,
      grand_total_amount: 0
    };
  }
};
