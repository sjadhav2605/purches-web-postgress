import pool from '../../config/db.js';

export const PaymentModel = {
  async findAll() {
    const [rows] = await pool.query(
      `SELECT p.*, po.po_no, v.name AS vendor_name, u.name AS recorded_by_name
       FROM payments p
       JOIN purchase_orders po ON p.po_id = po.id
       JOIN vendors v ON p.vendor_id = v.id
       JOIN users u ON p.recorded_by_id = u.id
       ORDER BY p.id DESC`
    );
    return rows;
  },

  async findByPoId(poId) {
    const [rows] = await pool.query(
      `SELECT p.*, po.po_no, v.name AS vendor_name, u.name AS recorded_by_name
       FROM payments p
       JOIN purchase_orders po ON p.po_id = po.id
       JOIN vendors v ON p.vendor_id = v.id
       JOIN users u ON p.recorded_by_id = u.id
       WHERE p.po_id = ?
       ORDER BY p.id DESC`,
      [poId]
    );
    return rows;
  },

  async getPoSummary() {
    const [rows] = await pool.query(
      `SELECT 
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
        po.total_amount,
        po.payment_terms,
        po.status AS po_status,
        po.invoice_no,
        po.created_at,
        COALESCE(SUM(p.amount), 0) AS total_paid,
        GREATEST(0, po.total_amount - COALESCE(SUM(p.amount), 0)) AS balance_due,
        COUNT(p.id) AS payments_count,
        CASE 
          WHEN COALESCE(SUM(p.amount), 0) >= po.total_amount THEN 'Paid'
          WHEN COALESCE(SUM(p.amount), 0) > 0 THEN 'Partially Paid'
          ELSE 'Unpaid'
        END AS payment_status
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      JOIN sites s ON po.site_id = s.id
      LEFT JOIN requisitions r ON po.requisition_id = r.id
      LEFT JOIN payments p ON po.id = p.po_id
      GROUP BY po.id, v.id, s.id, r.id
      ORDER BY po.id DESC`
    );
    return rows.map((r) => {
      let terms = {};
      if (typeof r.payment_terms === 'string') {
        try {
          terms = JSON.parse(r.payment_terms || '{}');
        } catch {
          terms = {};
        }
      } else if (r.payment_terms && typeof r.payment_terms === 'object') {
        terms = r.payment_terms;
      }
      return {
        ...r,
        payment_terms: terms
      };
    });
  },

  async create({ po_id, vendor_id, amount, payment_date, mode, reference_no, note, recorded_by_id }) {
    const [res] = await pool.query(
      `INSERT INTO payments (po_id, vendor_id, amount, payment_date, mode, reference_no, note, recorded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [po_id, vendor_id, amount, payment_date, mode, reference_no, note || null, recorded_by_id]
    );
    return res.insertId;
  }
};
