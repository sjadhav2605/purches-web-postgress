import pool from '../../config/db.js';
import { generateQuoteSignature } from '../../utils/security.js';

export const RfqModel = {
  async findAll({ search = '', status = '', vendorId = null, userRole = null, userId = null, directorId = null } = {}) {
    let sql = `
      SELECT rfq.*, r.pr_no, r.status AS pr_status, r.category AS pr_category, s.name AS site_name, s.code AS site_code, 
             v.name AS winner_vendor_name,
             r.shortlisted_vendor_id AS requisition_shortlisted_vendor_id,
             COALESCE(rfq.payment_terms, r.payment_terms) AS payment_terms,
             COALESCE(rfq.advance_pct, r.advance_pct) AS advance_pct,
             COALESCE(rfq.credit_days, r.credit_days) AS credit_days,
             COALESCE(rfq.payment_terms_notes, r.payment_terms_notes) AS payment_terms_notes,
             r.dispatch_date, r.vehicle_no, r.transport_name, r.challan_no, r.dispatched_qty, r.dispatch_remarks,
             COALESCE(bids.bids_count, 0) AS bids_count,
             bids.invited_vendor_ids,
             bids.submitted_vendor_ids,
             bids.revision_requested_vendor_ids,
             bids.revised_submitted_vendor_ids,
             bids.approved_vendor_ids,
             bids.rejected_vendor_ids
      FROM rfqs rfq
      JOIN requisitions r ON rfq.requisition_id = r.id
      JOIN sites s ON rfq.site_id = s.id
      LEFT JOIN vendors v ON rfq.winner_vendor_id = v.id
      LEFT JOIN (
        SELECT 
          b.rfq_id,
          COUNT(DISTINCT CASE WHEN b.items IS NOT NULL AND b.items::text != '[]' THEN b.id END) AS bids_count,
          STRING_AGG(DISTINCT b.vendor_id::text, ',') AS invited_vendor_ids,
          STRING_AGG(DISTINCT CASE WHEN b.items IS NOT NULL AND b.items::text != '[]' THEN b.vendor_id::text END, ',') AS submitted_vendor_ids,
          STRING_AGG(DISTINCT CASE WHEN b.status = 'Revision Requested' THEN b.vendor_id::text END, ',') AS revision_requested_vendor_ids,
          STRING_AGG(DISTINCT CASE WHEN b.status = 'Revised Bid Submitted' THEN b.vendor_id::text END, ',') AS revised_submitted_vendor_ids,
          STRING_AGG(DISTINCT CASE WHEN b.status = 'Approved' THEN b.vendor_id::text END, ',') AS approved_vendor_ids,
          STRING_AGG(DISTINCT CASE WHEN b.status = 'Rejected' THEN b.vendor_id::text END, ',') AS rejected_vendor_ids
        FROM rfq_bids b
        GROUP BY b.rfq_id
      ) bids ON rfq.id = bids.rfq_id
    `;
    const params = [];
    const where = [];

    if (vendorId) {
      where.push('rfq.id IN (SELECT rfq_id FROM rfq_bids WHERE vendor_id = ?)');
      params.push(vendorId);
    }

    // Role-based scoping: Directors see RFQs routed/assigned to them (matches both ID and name)
    if (userRole === 'director') {
      const uId = Number(userId || directorId || 0);
      const isD2 = (uId === 10 || uId === 6);
      const isD3 = (uId === 11 || uId === 7);
      const isD1 = (uId === 5);

      if (isD2) {
        where.push('(rfq.target_director_id IN (10, 6) OR LOWER(rfq.target_director_name) LIKE \'%director 2%\')');
      } else if (isD3) {
        where.push('(rfq.target_director_id IN (11, 7) OR LOWER(rfq.target_director_name) LIKE \'%director 3%\')');
      } else if (isD1) {
        where.push('(rfq.target_director_id = 5 OR rfq.target_director_id IS NULL OR LOWER(rfq.target_director_name) LIKE \'%director 1%\')');
      } else if (uId) {
        where.push('(rfq.target_director_id = ? OR rfq.target_director_id IS NULL)');
        params.push(uId);
      }
    } else if (directorId) {
      const dId = Number(directorId);
      if (dId === 10 || dId === 6) {
        where.push('(rfq.target_director_id IN (10, 6) OR LOWER(rfq.target_director_name) LIKE \'%director 2%\')');
      } else if (dId === 11 || dId === 7) {
        where.push('(rfq.target_director_id IN (11, 7) OR LOWER(rfq.target_director_name) LIKE \'%director 3%\')');
      } else {
        where.push('(rfq.target_director_id = ? OR rfq.target_director_id IS NULL)');
        params.push(dId);
      }
    }

    if (search && search.trim()) {
      where.push('(rfq.rfq_no LIKE ? OR r.pr_no LIKE ? OR s.name LIKE ?)');
      const p = `%${search.trim()}%`;
      params.push(p, p, p);
    }

    if (status && status.trim()) {
      const s = status.trim();
      if (s === 'Open' || s === 'RFQ Sent') {
        where.push("rfq.status IN ('RFQ Sent', 'Open')");
      } else if (s === 'Bids In') {
        where.push("rfq.status = 'Bids In'");
      } else if (s === 'Under_Review' || s === 'Shortlisted') {
        where.push("rfq.status IN ('Under_Review', 'Shortlisted', 'Vendor Shortlisted', 'Pending Director Approval')");
      } else if (s === 'Awarded' || s === 'Approved') {
        where.push("rfq.status IN ('Approved', 'Awarded', 'Director Approved')");
      } else if (s === 'Closed') {
        where.push("rfq.status IN ('Closed', 'PO Issued', 'Completed')");
      } else {
        where.push('rfq.status = ?');
        params.push(s);
      }
    }

    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }

    sql += ' ORDER BY rfq.id DESC';

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findById(id, vendorId = null) {
    const [rfqRows] = await pool.query(
      `SELECT rfq.*, r.pr_no, r.status AS pr_status, r.category AS pr_category, r.remarks AS pr_remarks,
              r.shortlisted_vendor_id AS requisition_shortlisted_vendor_id,
              COALESCE(rfq.payment_terms, r.payment_terms) AS payment_terms,
              COALESCE(rfq.advance_pct, r.advance_pct) AS advance_pct,
              COALESCE(rfq.credit_days, r.credit_days) AS credit_days,
              COALESCE(rfq.payment_terms_notes, r.payment_terms_notes) AS payment_terms_notes,
              r.dispatch_date, r.vehicle_no, r.transport_name, r.challan_no, r.dispatched_qty, r.dispatch_remarks,
              s.name AS site_name, s.code AS site_code, s.address AS site_address,
              v.name AS winner_vendor_name
       FROM rfqs rfq
       JOIN requisitions r ON rfq.requisition_id = r.id
       JOIN sites s ON rfq.site_id = s.id
       LEFT JOIN vendors v ON rfq.winner_vendor_id = v.id
       WHERE rfq.id = ? LIMIT 1`,
      [id]
    );

    if (rfqRows.length === 0) return null;
    const rfq = rfqRows[0];

    // Fetch line items from linked requisition
    const [items] = await pool.query(
      `SELECT id, description, spec, unit, quantity, est_rate, is_custom 
       FROM requisition_items 
       WHERE requisition_id = ?`,
      [rfq.requisition_id]
    );
    rfq.items = (items || []).map(it => ({
      ...it,
      quantity: it.quantity !== null && it.quantity !== undefined ? Number(parseFloat(it.quantity)) : 0,
      est_rate: it.est_rate !== null && it.est_rate !== undefined ? Number(parseFloat(it.est_rate)) : 0
    }));

    // Fetch submitted bids (scoped strictly to vendorId if vendor user)
    let bidsQuery = `
      SELECT b.*, v.name AS vendor_name, v.gstin AS vendor_gstin, v.phone AS vendor_phone, v.email AS vendor_email 
      FROM rfq_bids b
      JOIN vendors v ON b.vendor_id = v.id
      WHERE b.rfq_id = ?
    `;
    const bidsParams = [id];
    if (vendorId) {
      bidsQuery += ' AND b.vendor_id = ?';
      bidsParams.push(vendorId);
    }
    bidsQuery += ' ORDER BY b.id ASC';

    const [bids] = await pool.query(bidsQuery, bidsParams);

    // Fetch bid revisions (scoped strictly to vendorId if vendor user)
    let revQuery = `
      SELECT br.*, u.name AS requested_by_name, v.name AS vendor_name 
      FROM bid_revisions br
      LEFT JOIN users u ON br.requested_by_id = u.id
      LEFT JOIN vendors v ON br.vendor_id = v.id
      WHERE br.rfq_id = ?
    `;
    const revParams = [id];
    if (vendorId) {
      revQuery += ' AND br.vendor_id = ?';
      revParams.push(vendorId);
    }
    revQuery += ' ORDER BY br.round ASC, br.id ASC';

    const [revisions] = await pool.query(revQuery, revParams);

    let revisionItems = [];
    if (revisions.length > 0) {
      const revIds = revisions.map(r => r.id);
      const [itemsRows] = await pool.query(
        `SELECT * FROM bid_revision_items WHERE revision_id IN (?) ORDER BY id ASC`,
        [revIds]
      );
      revisionItems = itemsRows;
    }

    // Attach items to each revision
    const revisionsWithItems = revisions.map(r => ({
      ...r,
      items: revisionItems.filter(ri => ri.revision_id === r.id)
    }));

    rfq.bids = bids.map((b) => {
      const parsedItems = typeof b.items === 'string' ? JSON.parse(b.items || '[]') : (b.items || []);
      const bidRevs = revisionsWithItems.filter(r => r.bid_id === b.id);
      const latestRev = bidRevs.length > 0 ? bidRevs[bidRevs.length - 1] : null;

      // Enhance items with revision details
      const enhancedItems = parsedItems.map((it, idx) => {
        let originalRate = it.original_rate !== undefined ? Number(it.original_rate) : Number(it.rate || 0);
        let revisedRate = it.revised_rate !== undefined ? Number(it.revised_rate) : Number(it.rate || 0);
        let finalRate = it.final_rate !== undefined ? it.final_rate : null;

        if (latestRev && latestRev.items) {
          const matchedRevItem = latestRev.items.find(ri => 
            ri.item_index === idx || 
            (ri.description && it.description && ri.description.trim().toLowerCase() === it.description.trim().toLowerCase())
          );
          if (matchedRevItem) {
            originalRate = Number(matchedRevItem.original_rate);
            revisedRate = Number(matchedRevItem.revised_rate);
            if (matchedRevItem.final_rate !== null && matchedRevItem.final_rate !== undefined) {
              finalRate = Number(matchedRevItem.final_rate);
            }
          }
        }

        // Active rate for calculations & display: final_rate takes highest precedence, then current rate
        const activeRate = finalRate !== null && finalRate !== undefined ? Number(finalRate) : Number(it.rate || 0);

        return {
          ...it,
          original_rate: originalRate,
          revised_rate: revisedRate,
          final_rate: finalRate,
          rate: activeRate,
          is_revised: latestRev ? true : false
        };
      });

      const totalAmount = enhancedItems.reduce(
        (sum, it) => {
          if (it.availability === 'Not Available') return sum;
          return sum + ((Number(it.qty) || Number(it.quantity) || 0) * (Number(it.rate) || 0));
        },
        0
      );

      const hasSubmitted = enhancedItems.length > 0 && enhancedItems.some(it => Number(it.rate) > 0 || it.availability === 'Not Available');
      const bidStatus = b.status || (latestRev ? latestRev.status : 'Submitted');

      return {
        ...b,
        status: bidStatus,
        bid_status: bidStatus,
        quote_sig: generateQuoteSignature(rfq.id, b.vendor_id),
        current_round: latestRev ? latestRev.round : (b.current_round || 0),
        items: enhancedItems,
        quote_amount: totalAmount,
        has_submitted: hasSubmitted,
        revisions: bidRevs,
        latest_revision: latestRev,
        lead_from: b.lead_from || enhancedItems.find(it => it.lead_from)?.lead_from || null,
        lead_to: b.lead_to || enhancedItems.find(it => it.lead_to)?.lead_to || null
      };
    });

    return rfq;
  },

  async generateNextRfqNumber(connection = null) {
    const db = connection || pool;
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const nextYear = currentYear + 1;
    const fyPrefix = `RFQ-${currentYear}-${nextYear}-`;

    const [rows] = await db.query(
      `SELECT rfq_no FROM rfqs WHERE rfq_no LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [`${fyPrefix}%`]
    );

    let nextSeq = 1;
    if (rows.length > 0) {
      const parts = rows[0].rfq_no.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    return `${fyPrefix}${String(nextSeq).padStart(4, '0')}`;
  },

  async create(data, connection) {
    const { 
      rfq_no, 
      requisition_id, 
      site_id, 
      deadline, 
      status = 'RFQ Sent',
      payment_terms = 'Net 30 Days Credit',
      advance_pct = 0,
      credit_days = 30,
      payment_terms_notes = null,
      created_by_id = null,
      created_by_name = null,
      created_by_role = null
    } = data;
    const [res] = await connection.query(
      `INSERT INTO rfqs (rfq_no, requisition_id, site_id, deadline, status, payment_terms, advance_pct, credit_days, payment_terms_notes, created_by_id, created_by_name, created_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rfq_no, 
        requisition_id, 
        site_id, 
        deadline || null, 
        status,
        payment_terms,
        Number(advance_pct || 0),
        Number(credit_days || 30),
        payment_terms_notes,
        created_by_id,
        created_by_name,
        created_by_role
      ]
    );
    return res.insertId;
  },

  async saveBid({ rfq_id, revision_no = 0, vendor_id, items, lead_from, lead_to, delivery_days, entered_by = 'vendor', status = 'Submitted' }) {
    const [res] = await pool.query(
      `INSERT INTO rfq_bids (rfq_id, revision_no, vendor_id, items, lead_from, lead_to, delivery_days, entered_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (rfq_id, revision_no, vendor_id) DO UPDATE SET 
       items = EXCLUDED.items, lead_from = EXCLUDED.lead_from, lead_to = EXCLUDED.lead_to, delivery_days = EXCLUDED.delivery_days, entered_by = EXCLUDED.entered_by, status = EXCLUDED.status, submitted_at = CURRENT_TIMESTAMP`,
      [rfq_id, revision_no || 0, vendor_id, JSON.stringify(items || []), lead_from || null, lead_to || null, delivery_days || null, entered_by, status]
    );
    return res.insertId;
  },

  async setWinner(rfqId, winnerVendorId, connection = null) {
    const db = connection || pool;
    const [res] = await db.query(
      `UPDATE rfqs SET winner_vendor_id = ?, status = 'Approved' WHERE id = ?`,
      [winnerVendorId, rfqId]
    );
    return res.affectedRows > 0;
  },

  async getBidById(bidId) {
    const [rows] = await pool.query(
      `SELECT b.*, v.name AS vendor_name, v.email AS vendor_email, v.phone AS vendor_phone, rfqs.rfq_no 
       FROM rfq_bids b
       JOIN vendors v ON b.vendor_id = v.id
       JOIN rfqs ON b.rfq_id = rfqs.id
       WHERE b.id = ? LIMIT 1`,
      [bidId]
    );
    return rows[0] || null;
  },

  async createBidRevision(revisionData, connection = null) {
    const db = connection || pool;
    const { rfq_id, bid_id, vendor_id, round, requested_by_id, request_remarks, subtotal, cgst, sgst, total_amount, items } = revisionData;

    const [res] = await db.query(
      `INSERT INTO bid_revisions (rfq_id, bid_id, vendor_id, round, status, requested_by_id, request_remarks, subtotal, cgst, sgst, total_amount)
       VALUES (?, ?, ?, ?, 'Revision Requested', ?, ?, ?, ?, ?, ?)`,
      [rfq_id, bid_id, vendor_id, round, requested_by_id, request_remarks || null, subtotal || 0, cgst || 0, sgst || 0, total_amount || 0]
    );
    const revisionId = res.insertId;

    if (Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await db.query(
          `INSERT INTO bid_revision_items (revision_id, item_index, description, spec, unit, quantity, original_rate, revised_rate, availability)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            revisionId,
            i,
            it.description,
            it.spec || null,
            it.unit || 'Nos',
            it.qty || it.quantity || 1,
            it.original_rate !== undefined ? it.original_rate : (it.rate || 0),
            it.revised_rate !== undefined ? it.revised_rate : (it.rate || 0),
            it.availability || 'Available'
          ]
        );
      }
    }

    // Update rfq_bids status and current_round
    await db.query(
      `UPDATE rfq_bids SET status = 'Revision Requested', current_round = ? WHERE id = ?`,
      [round, bid_id]
    );

    return revisionId;
  },

  async getLatestRevisionForBid(bidId) {
    const [rows] = await pool.query(
      `SELECT br.*, u.name AS requested_by_name, v.name AS vendor_name, v.email AS vendor_email 
       FROM bid_revisions br
       LEFT JOIN users u ON br.requested_by_id = u.id
       LEFT JOIN vendors v ON br.vendor_id = v.id
       WHERE br.bid_id = ? 
       ORDER BY br.round DESC, br.id DESC LIMIT 1`,
      [bidId]
    );
    if (rows.length === 0) return null;
    const rev = rows[0];

    const [items] = await pool.query(
      `SELECT * FROM bid_revision_items WHERE revision_id = ? ORDER BY item_index ASC, id ASC`,
      [rev.id]
    );
    rev.items = items;
    return rev;
  },

  async submitVendorRevisionResponse(responseData, connection = null) {
    const db = connection || pool;
    const { revision_id, bid_id, response_type, vendor_remarks, items, subtotal, cgst, sgst, total_amount } = responseData;

    await db.query(
      `UPDATE bid_revisions 
       SET status = 'Revised Bid Submitted', response_type = ?, vendor_remarks = ?, subtotal = ?, cgst = ?, sgst = ?, total_amount = ?, responded_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [response_type, vendor_remarks || null, subtotal || 0, cgst || 0, sgst || 0, total_amount || 0, revision_id]
    );

    if (Array.isArray(items)) {
      for (const it of items) {
        await db.query(
          `UPDATE bid_revision_items 
           SET final_rate = ? 
           WHERE revision_id = ? AND (id = ? OR item_index = ? OR description = ?)`,
          [it.final_rate !== undefined ? it.final_rate : it.rate, revision_id, it.id || -1, it.item_index !== undefined ? it.item_index : -1, it.description || '']
        );
      }
    }

    // Update rfq_bids
    await db.query(
      `UPDATE rfq_bids SET status = 'Revised Bid Submitted', items = ? WHERE id = ?`,
      [JSON.stringify(items || []), bid_id]
    );

    return true;
  }
};
