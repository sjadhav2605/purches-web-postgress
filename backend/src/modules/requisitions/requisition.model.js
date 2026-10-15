import pool from '../../config/db.js';
import { generateQuoteSignature } from '../../utils/security.js';

/**
 * Requisition Model:
 * Pure database layer. All database queries for Requisitions (PR) reside here.
 * Strictly uses Parameterized Queries ('?') with connection pooling.
 */
export const RequisitionModel = {
  /**
   * Search and Paginate Requisitions
   */
  async findAll({ page = 1, limit = 10, search = '', status = '', tab = '', site_id = null, userRole = '', userId = null, defaultSiteId = null, my_requests = false, director_id = null, sort_by = 'created_at', order = 'DESC' } = {}) {
    const offset = (page - 1) * limit;
    const baseConditions = [];
    const baseParams = [];

    // Filter by search keyword (pr_no, category, remarks, or site name)
    if (search && search.trim() !== '') {
      baseConditions.push(
        `(r.pr_no LIKE ? OR r.category LIKE ? OR r.remarks LIKE ? OR s.name LIKE ?)`
      );
      const searchPattern = `%${search.trim()}%`;
      baseParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Filter by site_id explicitly passed or scoped by user default_site_id
    if (site_id) {
      baseConditions.push('r.site_id = ?');
      baseParams.push(site_id);
    } else if (['supervisor', 'pc'].includes(userRole) && defaultSiteId) {
      baseConditions.push('(r.site_id = ? OR r.requested_by_id = ? OR r.approved_by_id = ?)');
      baseParams.push(defaultSiteId, userId, userId);
    }

    // Role-based visibility: Purchase Department ONLY sees requests that have been accepted/approved by Project Coordinator
    if (userRole === 'purchase' && !(my_requests === 'true' || my_requests === true)) {
      baseConditions.push("r.status NOT IN ('Draft', 'Raised', 'PR Raised', 'Pending PC Approval', 'Coordinator Declined')");
    }

    // Role-based visibility: Directors see requests routed or assigned to them (matches ID and name)
    if (userRole === 'director') {
      const uId = Number(userId || director_id || 0);
      const isD2 = (uId === 10 || uId === 6);
      const isD3 = (uId === 11 || uId === 7);
      const isD1 = (uId === 5);

      if (isD2) {
        baseConditions.push('(r.target_director_id IN (10, 6) OR r.approved_by_id IN (10, 6) OR LOWER(r.target_director_name) LIKE \'%director 2%\')');
      } else if (isD3) {
        baseConditions.push('(r.target_director_id IN (11, 7) OR r.approved_by_id IN (11, 7) OR LOWER(r.target_director_name) LIKE \'%director 3%\')');
      } else if (isD1) {
        baseConditions.push('(r.target_director_id = 5 OR r.approved_by_id = 5 OR r.target_director_id IS NULL OR LOWER(r.target_director_name) LIKE \'%director 1%\')');
      } else if (uId) {
        baseConditions.push('(r.target_director_id = ? OR r.approved_by_id = ? OR r.target_director_id IS NULL)');
        baseParams.push(uId, uId);
      }
    } else if (director_id) {
      const dId = Number(director_id);
      if (dId === 10 || dId === 6) {
        baseConditions.push('(r.target_director_id IN (10, 6) OR r.approved_by_id IN (10, 6) OR LOWER(r.target_director_name) LIKE \'%director 2%\')');
      } else if (dId === 11 || dId === 7) {
        baseConditions.push('(r.target_director_id IN (11, 7) OR r.approved_by_id IN (11, 7) OR LOWER(r.target_director_name) LIKE \'%director 3%\')');
      } else {
        baseConditions.push('(r.target_director_id = ? OR r.approved_by_id = ?)');
        baseParams.push(dId, dId);
      }
    }

    // Explicit filter: Only show user's own requests if explicitly requested
    if ((my_requests === 'true' || my_requests === true) && userId) {
      baseConditions.push('r.requested_by_id = ?');
      baseParams.push(userId);
    }

    // Tab-based status categorization
    const approvedStatuses = ['Approved', 'Coordinator Approved', 'Purchase Approved', 'Director Approved', 'Vendor Shortlisted', 'Dispatched', 'Received', 'PO Issued', 'Site Verified'];
    const declinedStatuses = ['Coordinator Declined', 'Purchase Declined', 'Director Declined', 'Rejected'];
    const pendingStatuses = ['Draft', 'Raised', 'PR Raised', 'Pending PC Approval', 'Sent to Purchase', 'RFQ Sent', 'Bids In', 'Vendor Quotes / Revision', 'Pending Director Approval', 'Shortlisted', 'Under_Review'];

    const whereConditions = [...baseConditions];
    const params = [...baseParams];

    if (tab === 'approved') {
      whereConditions.push(`r.status IN (${approvedStatuses.map(() => '?').join(', ')})`);
      params.push(...approvedStatuses);
    } else if (tab === 'declined') {
      whereConditions.push(`r.status IN (${declinedStatuses.map(() => '?').join(', ')})`);
      params.push(...declinedStatuses);
    } else if (tab === 'pending') {
      whereConditions.push(`r.status IN (${pendingStatuses.map(() => '?').join(', ')})`);
      params.push(...pendingStatuses);
    } else if (status && status.trim() !== '') {
      whereConditions.push('r.status = ?');
      params.push(status.trim());
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const baseWhereClause = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';

    // 1. Get total records count for current filter
    const countSql = `
      SELECT COUNT(DISTINCT r.id) AS total 
      FROM requisitions r
      JOIN sites s ON r.site_id = s.id
      ${whereClause}
    `;

    // 2. Compute tab counts
    const tabCountsSql = `
      SELECT 
        COUNT(DISTINCT r.id) AS all_count,
        COUNT(DISTINCT CASE WHEN r.status IN (${approvedStatuses.map(() => '?').join(', ')}) THEN r.id END) AS approved_count,
        COUNT(DISTINCT CASE WHEN r.status IN (${declinedStatuses.map(() => '?').join(', ')}) THEN r.id END) AS declined_count,
        COUNT(DISTINCT CASE WHEN r.status IN (${pendingStatuses.map(() => '?').join(', ')}) THEN r.id END) AS pending_count
      FROM requisitions r
      JOIN sites s ON r.site_id = s.id
      ${baseWhereClause}
    `;

    const safeSort = ['created_at', 'pr_no', 'status', 'category'].includes(sort_by) ? sort_by : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataSql = `
      SELECT 
        r.id, 
        r.pr_no, 
        r.site_id, 
        s.code AS site_code, 
        s.name AS site_name,
        r.requested_by_id, 
        u.name AS requested_by_name,
        u.role AS requested_by_role,
        r.category, 
        r.status, 
        r.required_by_date, 
        r.remarks, 
        r.decline_reason,
        r.approved_by,
        r.approved_at,
        r.declined_by,
        r.declined_at,
        r.shortlisted_vendor_id,
        sv.name AS shortlisted_vendor_name,
        r.target_director_id,
        r.target_director_name,
        r.dispatch_date,
        r.vehicle_no,
        r.transport_name,
        r.challan_no,
        r.dispatched_qty,
        r.dispatch_remarks,
        r.payment_terms,
        r.advance_pct,
        r.credit_days,
        r.payment_terms_notes,
        r.history, 
        r.created_at, 
        r.updated_at,
        COUNT(DISTINCT ri.id) AS total_items,
        STRING_AGG(DISTINCT ri.description, ', ') AS material_items_summary,
        SUM(CASE WHEN ri.is_custom = 1 THEN 1 ELSE 0 END) AS custom_items_count,
        MAX(po.po_no) AS po_no,
        MAX(po.status) AS po_status,
        MAX(po.invoice_no) AS po_challan_no,
        MAX(po.expected_delivery_date) AS expected_delivery_date,
        MAX(v.name) AS vendor_name,
        MAX(rfq.id) AS linked_rfq_id,
        MAX(rfq.rfq_no) AS linked_rfq_no,
        MAX(rfq.status) AS linked_rfq_status,
        MAX(rfq.deadline) AS linked_rfq_deadline,
        MAX(rfq.payment_terms) AS rfq_payment_terms,
        MAX(rfq.advance_pct) AS rfq_advance_pct,
        MAX(rfq.credit_days) AS rfq_credit_days
      FROM requisitions r
      JOIN sites s ON r.site_id = s.id
      JOIN users u ON r.requested_by_id = u.id
      LEFT JOIN vendors sv ON r.shortlisted_vendor_id = sv.id
      LEFT JOIN requisition_items ri ON r.id = ri.requisition_id
      LEFT JOIN purchase_orders po ON r.id = po.requisition_id
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN rfqs rfq ON r.id = rfq.requisition_id
      ${whereClause}
      GROUP BY r.id, s.code, s.name, u.name, u.role, sv.name
      ORDER BY r.${safeSort} ${safeOrder}
      LIMIT ? OFFSET ?
    `;

    const tabCountParams = [...approvedStatuses, ...declinedStatuses, ...pendingStatuses, ...baseParams];
    const dataParams = [...params, Number(limit), Number(offset)];

    // Execute count, tab counts, and paginated data queries concurrently
    const [[countRows], [tabCountRows], [rows]] = await Promise.all([
      pool.query(countSql, params),
      pool.query(tabCountsSql, tabCountParams),
      pool.query(dataSql, dataParams)
    ]);

    const totalItems = countRows[0]?.total || 0;
    const tabCounts = {
      all: tabCountRows[0]?.all_count || 0,
      approved: tabCountRows[0]?.approved_count || 0,
      declined: tabCountRows[0]?.declined_count || 0,
      pending: tabCountRows[0]?.pending_count || 0
    };

    return {
      items: rows,
      tabCounts,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit)
      }
    };
  },

  /**
   * Find single requisition by ID with all details, items, edits, and status history
   */
  async findById(id) {
    // 1. Fetch PR details
    const [prRows] = await pool.query(
      `SELECT 
        r.id, r.pr_no, r.site_id, s.code AS site_code, s.name AS site_name, s.address AS site_address,
        r.requested_by_id, u.name AS requested_by_name, u.email AS requested_by_email, u.role AS requested_by_role,
        r.category, r.status, r.required_by_date, r.remarks, 
        r.payment_terms, r.advance_pct, r.credit_days, r.payment_terms_notes,
        r.decline_reason, r.approved_by, r.approved_by_id, r.approved_at,
        r.declined_by, r.declined_by_id, r.declined_at,
        r.shortlisted_vendor_id, sv.name AS shortlisted_vendor_name,
        r.target_director_id, r.target_director_name,
        r.dispatch_date, r.vehicle_no, r.transport_name, r.challan_no, r.dispatched_qty, r.dispatch_remarks,
        r.dispatch_link_reopened,
        r.history, r.created_at, r.updated_at
       FROM requisitions r
       JOIN sites s ON r.site_id = s.id
       JOIN users u ON r.requested_by_id = u.id
       LEFT JOIN vendors sv ON r.shortlisted_vendor_id = sv.id
       WHERE r.id = ? LIMIT 1`,
      [id]
    );

    if (prRows.length === 0) return null;
    const requisition = prRows[0];

    // 2. Fetch linked PO & Delivery details early so items can match against PO items
    const [poRows] = await pool.query(
      `SELECT 
        po.id AS po_id, po.po_no, po.status AS po_status,
        po.vendor_id, v.name AS vendor_name, v.phone AS vendor_phone,
        po.invoice_no AS challan_no, po.dispatch_date, po.expected_delivery_date, po.dispatch_notes,
        po.subtotal, po.cgst, po.sgst, po.total_amount, po.items
       FROM purchase_orders po
       JOIN vendors v ON po.vendor_id = v.id
       WHERE po.requisition_id = ?
       ORDER BY po.id DESC LIMIT 1`,
      [id]
    );
    requisition.linked_po = poRows[0] || null;

    let poItems = [];
    if (requisition.linked_po?.items) {
      try {
        poItems = typeof requisition.linked_po.items === 'string'
          ? JSON.parse(requisition.linked_po.items)
          : requisition.linked_po.items;
      } catch (e) {
        poItems = [];
      }
    }

    // 3. Fetch line items
    const [items] = await pool.query(
      `SELECT 
        ri.id, ri.requisition_id, ri.material_id, ri.description, ri.spec, 
        ri.unit, ri.quantity, ri.est_rate, ri.approved_rate, ri.is_custom, ri.justification, ri.photos, ri.created_at,
        m.category AS material_category, m.hsn
       FROM requisition_items ri
       LEFT JOIN materials m ON ri.material_id = m.id
       WHERE ri.requisition_id = ?
       ORDER BY ri.id ASC`,
      [id]
    );

    if (typeof requisition.history === 'string') {
      try {
        requisition.history = JSON.parse(requisition.history);
      } catch (e) {
        requisition.history = {};
      }
    }

    if (items && Array.isArray(items)) {
      items.forEach((item, idx) => {
        if (typeof item.photos === 'string') {
          try {
            item.photos = JSON.parse(item.photos);
          } catch (e) {
            item.photos = [];
          }
        }
        if (item.quantity !== null && item.quantity !== undefined) {
          item.quantity = Number(parseFloat(item.quantity));
        }
        if (item.est_rate !== null && item.est_rate !== undefined) {
          item.est_rate = Number(parseFloat(item.est_rate));
        }
        if (item.approved_rate !== null && item.approved_rate !== undefined) {
          item.approved_rate = Number(parseFloat(item.approved_rate));
        } else {
          item.approved_rate = null;
        }

        // Match with PO item if approved_rate is not set or 0
        if (!item.approved_rate || item.approved_rate === 0) {
          const matched = poItems.find(pi => 
            pi.description && item.description && 
            pi.description.trim().toLowerCase() === item.description.trim().toLowerCase()
          ) || poItems[idx];
          if (matched && matched.rate && Number(matched.rate) > 0) {
            item.approved_rate = Number(matched.rate);
          }
        }

        // If approved_rate exists and est_rate was 0 or null, set est_rate as approved_rate
        if (item.approved_rate && item.approved_rate > 0 && (!item.est_rate || item.est_rate === 0)) {
          item.est_rate = item.approved_rate;
        }
      });
    }

    requisition.items = items;

    // Financial totals for approved requisition
    let computedBasicSubtotal = 0;
    if (items && Array.isArray(items)) {
      items.forEach((item) => {
        const rate = Number(item.approved_rate || item.est_rate || 0);
        computedBasicSubtotal += Number(item.quantity || 0) * rate;
      });
    }
    requisition.approved_subtotal = requisition.linked_po?.subtotal ? Number(requisition.linked_po.subtotal) : Math.round(computedBasicSubtotal * 100) / 100;
    requisition.approved_gst = requisition.linked_po ? (Number(requisition.linked_po.cgst || 0) + Number(requisition.linked_po.sgst || 0)) : Math.round(requisition.approved_subtotal * 0.18 * 100) / 100;
    requisition.approved_total = requisition.linked_po?.total_amount ? Number(requisition.linked_po.total_amount) : Math.round((requisition.approved_subtotal + requisition.approved_gst) * 100) / 100;

    // 4. Fetch linked RFQ if any
    const [rfqRows] = await pool.query(
      `SELECT id AS rfq_id, rfq_no, status AS rfq_status, deadline, winner_vendor_id, payment_terms, advance_pct, credit_days, payment_terms_notes 
       FROM rfqs WHERE requisition_id = ? ORDER BY id DESC LIMIT 1`,
      [id]
    );
    requisition.linked_rfq = rfqRows[0] || null;
    if (requisition.linked_rfq) {
      const [bidRows] = await pool.query(
        `SELECT b.id AS bid_id, b.vendor_id, v.name AS vendor_name, v.phone AS vendor_phone, v.email AS vendor_email
         FROM rfq_bids b
         JOIN vendors v ON b.vendor_id = v.id
         WHERE b.rfq_id = ?`,
        [requisition.linked_rfq.rfq_id]
      );
      requisition.linked_rfq.invited_vendors = bidRows.map(b => ({
        ...b,
        quote_sig: generateQuoteSignature(requisition.linked_rfq.rfq_id, b.vendor_id)
      }));
    }

    // 5. Fetch status history
    const [historyRows] = await pool.query(
      `SELECT id, entity_type, entity_id, from_status, to_status, action_by, action_by_id, role, remark, created_at
       FROM status_history
       WHERE entity_type = 'requisition' AND entity_id = ?
       ORDER BY id ASC`,
      [id]
    );
    requisition.status_history = historyRows || [];

    // 6. Fetch coordinator edits history
    const [editRows] = await pool.query(
      `SELECT id, requisition_id, field, old_value, new_value, edited_by, edited_by_id, created_at
       FROM requisition_edits
       WHERE requisition_id = ?
       ORDER BY id ASC`,
      [id]
    );
    requisition.requisition_edits = editRows || [];

    // 7. Fetch delivery receipt if received (checks deliveries or delivery_receipts)
    const [delRows] = await pool.query(
      `SELECT d.*, u.name AS recorded_by_name, d.created_at AS received_at, d.remarks AS remark,
              dr.proof_file AS legacy_proof_file, dr.received_qty AS legacy_received_qty
       FROM deliveries d
       LEFT JOIN users u ON d.recorded_by_id = u.id
       LEFT JOIN delivery_receipts dr ON dr.delivery_id = d.id
       WHERE d.requisition_id = ? OR d.po_id IN (SELECT id FROM purchase_orders WHERE requisition_id = ?)
       ORDER BY d.id DESC LIMIT 1`,
      [id, id]
    );

    if (delRows[0]) {
      const d = delRows[0];
      const parseJsonSafe = (val) => {
        if (!val) return [];
        if (typeof val === 'object') return val;
        try { return JSON.parse(val); } catch (e) { return []; }
      };
      const chPhotos = parseJsonSafe(d.challan_photos);
      const matPhotos = parseJsonSafe(d.material_photos);
      const dmgPhotos = parseJsonSafe(d.damage_photos);
      const recItems = parseJsonSafe(d.received_items);
      const dmgItems = parseJsonSafe(d.damaged_items);
      const totalRec = recItems.reduce((acc, it) => acc + (Number(it.received_qty) || 0), 0);
      const totalDmg = dmgItems.reduce((acc, it) => acc + (Number(it.damaged_qty) || 0), 0);

      requisition.delivery_receipt = {
        id: d.id,
        challan_no: d.challan_no,
        received_date: d.received_date,
        received_by: d.recorded_by_name || 'Site Supervisor',
        received_at: d.received_at,
        received_qty: d.legacy_received_qty || `${totalRec || 'All'} Items Received${totalDmg > 0 ? ` (${totalDmg} Damaged)` : ''}`,
        proof_file: d.legacy_proof_file || (chPhotos[0]?.dataUrl || matPhotos[0]?.dataUrl || dmgPhotos[0]?.dataUrl || null),
        remark: d.remarks || d.damage_remarks || 'Physical inspection verified',
        damage_remarks: d.damage_remarks,
        challan_photos: chPhotos,
        material_photos: matPhotos,
        damage_photos: dmgPhotos,
        received_items: recItems,
        damaged_items: dmgItems
      };
    } else {
      const [drRows] = await pool.query(
        'SELECT * FROM delivery_receipts WHERE requisition_id = ? ORDER BY id DESC LIMIT 1',
        [id]
      );
      requisition.delivery_receipt = drRows[0] || null;
    }

    return requisition;
  },

  /**
   * Generates the next sequential PR number (e.g. PR-26-27-0001)
   */
  async generateNextPrNumber(connection = null) {
    const db = connection || pool;
    // Current financial year in YY-YY format (e.g. 26-27)
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const nextYear = currentYear + 1;
    const fyPrefix = `PR-${currentYear}-${nextYear}-`;

    const [rows] = await db.query(
      `SELECT pr_no FROM requisitions 
       WHERE pr_no LIKE ? 
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [`${fyPrefix}%`]
    );

    let nextSeq = 1;
    if (rows.length > 0) {
      const lastPrNo = rows[0].pr_no;
      const parts = lastPrNo.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${fyPrefix}${String(nextSeq).padStart(4, '0')}`;
  },

  /**
   * Create Requisition and Items in an atomic transaction
   */
  async create(requisitionData, itemsData, connection) {
    const { pr_no, site_id, requested_by_id, category, status, required_by_date, remarks, history } = requisitionData;

    // 1. Insert header
    const [prResult] = await connection.query(
      `INSERT INTO requisitions 
        (pr_no, site_id, requested_by_id, category, status, required_by_date, remarks, history)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [pr_no, site_id, requested_by_id, category, status, required_by_date || null, remarks || null, JSON.stringify(history || {})]
    );

    const requisitionId = prResult.insertId;

    // 2. Insert line items
    if (itemsData && itemsData.length > 0) {
      const itemValues = itemsData.map((item) => [
        requisitionId,
        item.material_id || null,
        item.description,
        item.spec || null,
        item.unit,
        item.quantity,
        item.est_rate || 0.00,
        item.is_custom ? 1 : 0,
        item.justification || null,
        JSON.stringify(item.photos || [])
      ]);

      await connection.query(
        `INSERT INTO requisition_items 
          (requisition_id, material_id, description, spec, unit, quantity, est_rate, is_custom, justification, photos)
         VALUES ?`,
        [itemValues]
      );
    }

    return requisitionId;
  },

  /**
   * Update Requisition details
   */
  async update(id, updateData, connection = null) {
    const db = connection || pool;
    const fields = [];
    const params = [];

    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`"${key}" = ?`);
      params.push(value);
    }

    if (fields.length === 0) return false;

    params.push(id);
    const [result] = await db.query(
      `UPDATE requisitions SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  },

  /**
   * Update PR Status and append to status history
   */
  async updateStatus(id, newStatus, historyObject, connection = null) {
    const db = connection || pool;
    const [result] = await db.query(
      `UPDATE requisitions 
       SET status = ?, history = ? 
       WHERE id = ?`,
      [newStatus, JSON.stringify(historyObject), id]
    );
    return result.affectedRows > 0;
  },

  /**
   * Replace / Update line items for a requisition (Atomic update)
   */
  async updateItems(requisitionId, items, connection = null) {
    const db = connection || pool;
    // 1. Delete previous items
    await db.query('DELETE FROM requisition_items WHERE requisition_id = ?', [requisitionId]);

    // 2. Insert updated items
    if (items && items.length > 0) {
      const itemValues = items.map((item) => [
        requisitionId,
        item.material_id || null,
        item.description,
        item.spec || null,
        item.unit,
        Number(item.quantity),
        item.est_rate || 0.00,
        item.is_custom ? 1 : 0,
        item.justification || null,
        typeof item.photos === 'string' ? item.photos : JSON.stringify(item.photos || [])
      ]);

      await db.query(
        `INSERT INTO requisition_items 
          (requisition_id, material_id, description, spec, unit, quantity, est_rate, is_custom, justification, photos)
         VALUES ?`,
        [itemValues]
      );
    }
    return true;
  },

  /**
   * Delete draft PR
   */
  async delete(id) {
    const [result] = await pool.query('DELETE FROM requisitions WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};
