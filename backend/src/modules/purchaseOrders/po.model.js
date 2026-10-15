import pool from '../../config/db.js';

/**
 * Purchase Order Model:
 * Pure database layer for POs. Parameterized queries only.
 */
export const PurchaseOrderModel = {
  /**
   * Search and Paginate POs
   */
  async findAll({ page = 1, limit = 10, search = '', status = '', vendor_id = null, site_id = null, exclude_unissued = false, sort_by = 'created_at', order = 'DESC', scope = null } = {}) {
    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params = [];

    if (search && search.trim() !== '') {
      whereConditions.push(
        `(po.po_no LIKE ? OR v.name LIKE ? OR s.name LIKE ? OR po.invoice_no LIKE ?)`
      );
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (status && status.trim() !== '') {
      whereConditions.push('po.status = ?');
      params.push(status.trim());
    }

    if (exclude_unissued) {
      whereConditions.push("po.status NOT IN ('Approved', 'Draft')");
    }

    if (vendor_id) {
      whereConditions.push('po.vendor_id = ?');
      params.push(vendor_id);
    }

    if (site_id) {
      whereConditions.push('po.site_id = ?');
      params.push(site_id);
    }

    // Role-based record scope from utils/dataScope (applies to both count and data queries)
    if (scope?.sql) {
      whereConditions.push(scope.sql);
      params.push(...scope.params);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count
    const countSql = `
      SELECT COUNT(po.id) AS total
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      JOIN sites s ON po.site_id = s.id
      ${whereClause}
    `;
    const [countRows] = await pool.query(countSql, params);
    const totalItems = countRows[0]?.total || 0;

    // Fetch data
    const safeSort = ['created_at', 'po_no', 'status', 'total_amount'].includes(sort_by) ? sort_by : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataSql = `
      SELECT 
        po.id,
        po.po_no,
        po.requisition_id,
        r.pr_no,
        po.vendor_id,
        v.name AS vendor_name,
        v.gstin AS vendor_gstin,
        po.site_id,
        s.code AS site_code,
        s.name AS site_name,
        po.subtotal,
        po.cgst,
        po.sgst,
        po.total_amount,
        po.payment_terms,
        po.extra_charges,
        po.items,
        po.status,
        po.invoice_no,
        po.dispatch_date,
        po.expected_delivery_date,
        po.dispatch_notes,
        po.approved_by_id,
        u.name AS approved_by_name,
        po.created_at,
        po.updated_at
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      JOIN sites s ON po.site_id = s.id
      JOIN requisitions r ON po.requisition_id = r.id
      LEFT JOIN users u ON po.approved_by_id = u.id
      ${whereClause}
      ORDER BY po.${safeSort} ${safeOrder}
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, Number(limit), Number(offset)];
    const [rows] = await pool.query(dataSql, dataParams);

    return {
      items: rows,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit)
      }
    };
  },

  /**
   * Find single PO by ID
   */
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT 
        po.id, po.po_no, po.requisition_id, r.pr_no, r.category AS pr_category,
        po.vendor_id, v.name AS vendor_name, v.gstin AS vendor_gstin, v.phone AS vendor_phone, v.email AS vendor_email, v.address AS vendor_address,
        po.site_id, s.code AS site_code, s.name AS site_name, s.address AS site_address, s.gstin AS site_gstin,
        po.subtotal, po.cgst, po.sgst, po.total_amount, po.payment_terms, po.extra_charges, po.items, po.status,
        po.approved_by_id, u.name AS approved_by_name,
        po.verified_by_id, v_user.name AS verified_by_name,
        po.invoice_no, po.dispatch_date, po.expected_delivery_date, po.dispatch_notes,
        po.declaration_text, po.terms_updated_by_id, po.terms_updated_by_name, po.terms_updated_at,
        po.created_at, po.updated_at
       FROM purchase_orders po
       JOIN vendors v ON po.vendor_id = v.id
       JOIN sites s ON po.site_id = s.id
       JOIN requisitions r ON po.requisition_id = r.id
       LEFT JOIN users u ON po.approved_by_id = u.id
       LEFT JOIN users v_user ON po.verified_by_id = v_user.id
       WHERE po.id = ? LIMIT 1`,
      [id]
    );

    if (!rows[0]) return null;
    const po = rows[0];
    if (typeof po.items === 'string') {
      try { po.items = JSON.parse(po.items); } catch (e) { po.items = []; }
    }
    if (Array.isArray(po.items)) {
      po.items = po.items.map(it => ({
        ...it,
        qty: it.qty !== null && it.qty !== undefined ? Number(parseFloat(it.qty)) : 0,
        rate: it.rate !== null && it.rate !== undefined ? Number(parseFloat(it.rate)) : 0
      }));
    }
    if (typeof po.payment_terms === 'string') {
      try { po.payment_terms = JSON.parse(po.payment_terms); } catch (e) { po.payment_terms = {}; }
    }
    if (typeof po.extra_charges === 'string') {
      try { po.extra_charges = JSON.parse(po.extra_charges); } catch (e) { po.extra_charges = {}; }
    }
    if (!po.extra_charges || typeof po.extra_charges !== 'object') {
      po.extra_charges = {};
    }
    const DEFAULT_DECLARATION = 'We declare that this Purchase Order shows the actual price of the goods described and that all particulars are true and correct. Materials must be supplied per specified brands and certified delivery challan.';
    if (!po.declaration_text) {
      po.declaration_text = DEFAULT_DECLARATION;
    }

    // Fetch delivery record if exists
    const [delRows] = await pool.query(
      `SELECT d.*, u.name AS recorded_by_name
       FROM deliveries d
       LEFT JOIN users u ON d.recorded_by_id = u.id
       WHERE d.po_id = ?
       ORDER BY d.id DESC LIMIT 1`,
      [id]
    );
    if (delRows[0]) {
      const d = delRows[0];
      const parseJsonSafe = (val) => {
        if (!val) return [];
        if (typeof val === 'object') return val;
        try { return JSON.parse(val); } catch (e) { return []; }
      };
      d.challan_photos = parseJsonSafe(d.challan_photos);
      d.material_photos = parseJsonSafe(d.material_photos);
      d.damage_photos = parseJsonSafe(d.damage_photos);
      d.received_items = parseJsonSafe(d.received_items);
      d.damaged_items = parseJsonSafe(d.damaged_items);
      po.delivery_record = d;
    } else {
      po.delivery_record = null;
    }

    return po;
  },

  /**
   * Generate next sequential PO Number (e.g. DDPL/PO/26-27/001)
   */
  async generateNextPoNumber(connection = null) {
    const db = connection || pool;
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const nextYear = currentYear + 1;
    const fyPrefix = `DDPL/PO/${currentYear}-${nextYear}/`;

    const [rows] = await db.query(
      `SELECT po_no FROM purchase_orders 
       WHERE po_no LIKE ? 
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [`${fyPrefix}%`]
    );

    let nextSeq = 1;
    if (rows.length > 0) {
      const lastPoNo = rows[0].po_no;
      const parts = lastPoNo.split('/');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${fyPrefix}${String(nextSeq).padStart(3, '0')}`;
  },

  /**
   * Create PO record
   */
  async create(poData, connection) {
    const {
      po_no,
      requisition_id,
      rfq_id,
      vendor_id,
      site_id,
      subtotal,
      cgst,
      sgst,
      total_amount,
      payment_terms,
      items,
      status,
      approved_by_id,
      extra_charges
    } = poData;

    const [result] = await connection.query(
      `INSERT INTO purchase_orders 
        (po_no, requisition_id, rfq_id, vendor_id, site_id, subtotal, cgst, sgst, total_amount, payment_terms, items, status, approved_by_id, extra_charges)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        po_no,
        requisition_id,
        rfq_id || null,
        vendor_id,
        site_id,
        subtotal,
        cgst,
        sgst,
        total_amount,
        JSON.stringify(payment_terms || {}),
        JSON.stringify(items || []),
        status || 'Issued',
        approved_by_id || null,
        JSON.stringify(extra_charges || {})
      ]
    );

    return result.insertId;
  },

  /**
   * Update PO status and invoice
   */
  async updateStatus(
    id, 
    status, 
    invoice_no = null, 
    verified_by_id = null, 
    connection = null,
    dispatch_date = null,
    expected_delivery_date = null,
    dispatch_notes = null
  ) {
    const db = connection || pool;
    const fields = ['status = ?'];
    const params = [status];

    if (invoice_no !== undefined && invoice_no !== null) {
      fields.push('invoice_no = ?');
      params.push(invoice_no);
    }

    if (verified_by_id !== undefined && verified_by_id !== null) {
      fields.push('verified_by_id = ?');
      params.push(verified_by_id);
    }

    if (dispatch_date !== undefined && dispatch_date !== null) {
      fields.push('dispatch_date = ?');
      params.push(dispatch_date);
    }

    if (expected_delivery_date !== undefined && expected_delivery_date !== null) {
      fields.push('expected_delivery_date = ?');
      params.push(expected_delivery_date);
    }

    if (dispatch_notes !== undefined && dispatch_notes !== null) {
      fields.push('dispatch_notes = ?');
      params.push(dispatch_notes);
    }

    params.push(id);
    const [result] = await db.query(
      `UPDATE purchase_orders SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  },

  /**
   * Update Commercial Terms & Declaration for a specific PO
   * Safely updates only commercial terms fields, preserving all other fields.
   */
  async updateCommercialTerms(id, termsData) {
    const {
      payment_terms,
      declaration_text,
      terms_updated_by_id,
      terms_updated_by_name,
      terms_updated_at,
      extra_charges,
      total_amount
    } = termsData;

    const [result] = await pool.query(
      `UPDATE purchase_orders 
       SET payment_terms = ?,
           declaration_text = ?,
           terms_updated_by_id = ?,
           terms_updated_by_name = ?,
           terms_updated_at = ?,
           extra_charges = ?,
           total_amount = COALESCE(?, total_amount)
       WHERE id = ?`,
      [
        JSON.stringify(payment_terms || {}),
        declaration_text || null,
        terms_updated_by_id || null,
        terms_updated_by_name || null,
        terms_updated_at || null,
        JSON.stringify(extra_charges || {}),
        total_amount !== undefined ? total_amount : null,
        id
      ]
    );

    return result.affectedRows > 0;
  }
};
