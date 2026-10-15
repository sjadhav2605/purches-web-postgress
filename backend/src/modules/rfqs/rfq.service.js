import pool from '../../config/db.js';
import { RfqModel } from './rfq.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ROLES } from '../../constants/roles.js';
import { NotificationModel } from '../notifications/notification.model.js';
import { emailService } from '../../utils/emailService.js';
import { notify } from '../../services/notificationDispatcher.js';
import { StatusHistoryService } from '../../services/statusHistoryService.js';
import { verifyQuoteSignature } from '../../utils/security.js';

const resolveActorId = async (id, conn) => {
  if (!id) return null;
  const db = conn || pool;
  try {
    const [rows] = await db.query('SELECT id FROM users WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? rows[0].id : null;
  } catch {
    return null;
  }
};

export const RfqService = {
  async getAllRfqs(query, currentUser = null) {
    const vendorId = query?.vendor_id || null;
    const directorId = query?.director_id || null;
    const effectiveRole = currentUser?.activeRole || currentUser?.role;
    return await RfqModel.findAll({
      ...query,
      vendorId,
      directorId,
      userRole: effectiveRole,
      userId: currentUser?.id
    });
  },

  async getRfqById(id, currentUser = null) {
    const rfq = await RfqModel.findById(id, null);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const effectiveRole = currentUser?.activeRole || currentUser?.role;
    if (effectiveRole === ROLES.DIRECTOR && currentUser?.role !== ROLES.ADMIN) {
      if (rfq.target_director_id) {
        const uId = Number(currentUser?.directorId || currentUser?.id);
        const isD2 = (uId === 10 || uId === 6) || (currentUser?.email && currentUser.email.includes('director2'));
        const isD3 = (uId === 11 || uId === 7) || (currentUser?.email && currentUser.email.includes('director3'));
        const isD1 = (uId === 5) || (currentUser?.email && (currentUser.email.includes('director1') || currentUser.email === 'director@ddpl.com'));
        
        const targetId = Number(rfq.target_director_id);
        const matchesTarget = (isD2 && (targetId === 6 || targetId === 10)) ||
                              (isD3 && (targetId === 7 || targetId === 11)) ||
                              (isD1 && targetId === 5);

        if (!matchesTarget) {
          throw ApiError.forbidden(`This RFQ has been routed to ${rfq.target_director_name || 'another Director'} for review and is not accessible to you.`);
        }
      }
    }

    return rfq;
  },

  /**
   * Create RFQ for an approved / raised PR
   */
  async createFromPR({ requisition_id, deadline, vendor_ids = [], payment_terms, advance_pct, credit_days, payment_terms_notes }, currentUser) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch PR details
      const [prRows] = await connection.query('SELECT * FROM requisitions WHERE id = ? FOR UPDATE', [requisition_id]);
      if (prRows.length === 0) throw ApiError.notFound('Request not found');
      const pr = prRows[0];

      // 2. Generate RFQ Number
      const rfqNo = await RfqModel.generateNextRfqNumber(connection);

      const pt = payment_terms || pr.payment_terms || 'Net 30 Days Credit';
      const adv = advance_pct !== undefined ? Number(advance_pct) : (pr.advance_pct || 0);
      const cd = credit_days !== undefined ? Number(credit_days) : (pr.credit_days || 30);
      const ptNotes = payment_terms_notes || pr.payment_terms_notes || null;

      const rfqId = await RfqModel.create(
        {
          rfq_no: rfqNo,
          requisition_id: pr.id,
          site_id: pr.site_id,
          deadline: deadline || null,
          status: 'RFQ Sent',
          payment_terms: pt,
          advance_pct: adv,
          credit_days: cd,
          payment_terms_notes: ptNotes,
          created_by_id: currentUser?.id || null,
          created_by_name: currentUser?.name || null,
          created_by_role: currentUser?.activeRole || currentUser?.role || null
        },
        connection
      );

      // Save invited vendor bids placeholder
      if (Array.isArray(vendor_ids) && vendor_ids.length > 0) {
        for (const vid of vendor_ids) {
          await connection.query(
            `INSERT INTO rfq_bids (rfq_id, revision_no, vendor_id, items, entered_by)
             VALUES (?, 0, ?, '[]', 'purchase')
             ON CONFLICT (rfq_id, revision_no, vendor_id) DO NOTHING`,
            [rfqId, vid]
          );
        }
      }

      // 3. Update PR status to 'RFQ Sent'
      await connection.query(
        `UPDATE requisitions 
         SET status = 'RFQ Sent', 
             history = JSON_SET(COALESCE(history, '{}'), '$."RFQ Sent"', ?) 
         WHERE id = ?`,
        [new Date().toISOString(), pr.id]
      );

      // 4. Audit Log
      const actorId = await resolveActorId(currentUser?.id, connection);
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('RFQ', ?, 'RFQ Sent', ?, ?, ?)`,
        [String(rfqId), actorId, currentUser.name, `RFQ ${rfqNo} issued for PR #${pr.pr_no}`]
      );

      await connection.commit();
      return await RfqModel.findById(rfqId);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Vendor or Purchase submitting quote / bid rates
   */
  async submitQuote(payload, currentUser) {
    const { rfq_id, vendor_id, items, bid_items, delivery_days, lead_from, lead_to, rev_no, revision_no, entered_by } = payload;
    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const enteredBy = entered_by || (currentUser.role === ROLES.VENDOR ? 'vendor' : 'purchase');
    const effectiveVendorId = vendor_id ? Number(vendor_id) : (currentUser?.vendor_id || null);
    const finalItems = items || bid_items || [];

    await RfqModel.saveBid({
      rfq_id,
      revision_no: revision_no !== undefined ? revision_no : (rev_no !== undefined ? rev_no : (rfq.current_rev || 0)),
      vendor_id: effectiveVendorId,
      items: finalItems,
      lead_from: lead_from || null,
      lead_to: lead_to || null,
      delivery_days: delivery_days || null,
      entered_by: enteredBy
    });

    // Update RFQ status to 'Bids In'
    await pool.query(
      `UPDATE rfqs SET status = 'Bids In' WHERE id = ? AND status = 'RFQ Sent'`,
      [rfq_id]
    );

    // Update PR status to 'Bids In'
    await pool.query(
      `UPDATE requisitions r
       SET status = 'Bids In', 
           history = JSON_SET(COALESCE(r.history, '{}'), '$."Bids In"', ?) 
       FROM rfqs
       WHERE rfqs.requisition_id = r.id AND rfqs.id = ? AND r.status IN ('RFQ Sent', 'Purchase Approved', 'Open')`,
      [new Date().toISOString(), rfq_id]
    );

    // Notify Purchase Team that a vendor has submitted a quote
    try {
      const [vRows] = await pool.query('SELECT name FROM vendors WHERE id = ?', [effectiveVendorId]);
      const vName = vRows[0]?.name || `Vendor #${effectiveVendorId}`;
      notify('QUOTE_SUBMITTED', ROLES.PURCHASE, {
        rfq_no: rfq.rfq_no,
        rfq_id,
        vendor_name: vName,
        pr_no: rfq.pr_no,
        site_name: rfq.site_name,
        timestamp: new Date()
      });
    } catch {}

    // Audit Log
    const actorId = await resolveActorId(currentUser?.id, pool);
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
       VALUES ('Bid', ?, 'Quote submitted', ?, ?, ?)`,
      [String(rfq_id), actorId, currentUser.name, `Quote submitted by Vendor #${effectiveVendorId} for ${rfq.rfq_no}`]
    );

    return await RfqModel.findById(rfq_id);
  },

  /**
   * Shortlist top vendor bids (Purchase Department)
   */
  async shortlistBids({ rfq_id, shortlisted_vendor_ids = [], override_reason = '', target_director_id = null }, currentUser) {
    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let targetDirectorName = null;
      const parsedDirectorId = target_director_id ? Number(target_director_id) : null;
      if (parsedDirectorId) {
        const [dRows] = await connection.query("SELECT id, name FROM users WHERE id = ? AND role = 'director'", [parsedDirectorId]);
        if (dRows.length > 0) {
          targetDirectorName = dRows[0].name;
        }
      }

      await connection.query(
        `UPDATE rfqs 
         SET status = 'Shortlisted', 
             shortlisted_vendors = ?, 
             shortlist_reason = ?,
             target_director_id = ?,
             target_director_name = ?
         WHERE id = ?`,
        [
          JSON.stringify(shortlisted_vendor_ids), 
          override_reason || null, 
          parsedDirectorId,
          targetDirectorName,
          rfq_id
        ]
      );

      // Update PR status to Shortlisted and assign target director
      await connection.query(
        `UPDATE requisitions 
         SET status = 'Shortlisted', 
             target_director_id = ?,
             target_director_name = ?,
             history = JSON_SET(COALESCE(history, '{}'), '$."Shortlisted"', ?) 
         WHERE id = ?`,
        [parsedDirectorId, targetDirectorName, new Date().toISOString(), rfq.requisition_id]
      );

      // Audit Log
      const actorId = await resolveActorId(currentUser?.id, connection);
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('RFQ', ?, 'Shortlisted', ?, ?, ?)`,
        [
          String(rfq_id),
          actorId,
          currentUser.name,
          `Shortlisted ${shortlisted_vendor_ids.length} vendor(s) sent to ${targetDirectorName || 'Director'} for review. ${override_reason ? 'Reason: ' + override_reason : ''}`
        ]
      );

      // Notify Director specifically
      try {
        await NotificationModel.create({
          user_id: parsedDirectorId,
          role: ROLES.DIRECTOR,
          title: `RFQ Shortlist Review: ${rfq.rfq_no}`,
          message: `Purchase Manager ${currentUser.name} has shortlisted ${shortlisted_vendor_ids.length} vendor(s) for your review (${targetDirectorName || 'Director'}).`,
          link: `/rfqs/${rfq_id}`
        }, connection);
      } catch (nErr) {
        console.warn('Director notification error:', nErr.message);
      }

      await connection.commit();
      return await RfqModel.findById(rfq_id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Director Approves winning vendor and atomically issues the Purchase Order (PO)
   */
  async directorApprove({ rfq_id, vendor_id, note }, currentUser) {
    const allowed = [ROLES.DIRECTOR, ROLES.ADMIN];
    if (!allowed.includes(currentUser.role) && !allowed.includes(currentUser.activeRole)) {
      throw ApiError.forbidden('Only Directors and Admin can approve RFQ and issue PO');
    }

    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    // Director scoping check: If assigned to a specific director, prevent another director from approving
    if (rfq.target_director_id && currentUser.role !== ROLES.ADMIN) {
      const uId = Number(currentUser?.directorId || currentUser?.id);
      const isD2 = (uId === 10 || uId === 6) || (currentUser?.email && currentUser.email.includes('director2'));
      const isD3 = (uId === 11 || uId === 7) || (currentUser?.email && currentUser.email.includes('director3'));
      const isD1 = (uId === 5) || (currentUser?.email && (currentUser.email.includes('director1') || currentUser.email === 'director@ddpl.com'));
      
      const targetId = Number(rfq.target_director_id);
      const matchesTarget = (isD2 && (targetId === 6 || targetId === 10)) ||
                            (isD3 && (targetId === 7 || targetId === 11)) ||
                            (isD1 && targetId === 5);

      if (!matchesTarget) {
        throw ApiError.forbidden(`This RFQ has been assigned to ${rfq.target_director_name || 'another director'}. Only the assigned director can approve.`);
      }
    }

    // Find the winning bid (or default to lowest/first submitted bid)
    const targetVendorId = vendor_id ? Number(vendor_id) : (rfq.bids && rfq.bids.length > 0 ? rfq.bids[0].vendor_id : null);
    const winningBid = targetVendorId ? rfq.bids.find((b) => b.vendor_id === targetVendorId) : (rfq.bids && rfq.bids.length > 0 ? rfq.bids[0] : null);
    const effectiveVendorId = winningBid ? winningBid.vendor_id : null;

    // Fetch vendor details (for payment terms)
    const [vendorRows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [effectiveVendorId]);
    const vendor = vendorRows[0] || {};
    const paymentTerms = {
      advance_pct: Number(vendor.advance_pct) || 0,
      credit_days: Number(vendor.credit_days) || 0,
      notes: vendor.payment_terms || ''
    };

    // Calculate line items and totals
    let subtotal = 0;
    const computedItems = (winningBid.items || []).map((it) => {
      const qty = Number(it.qty || it.quantity || 0);
      const rate = Number(it.rate || 0);
      const amount = Math.round(qty * rate * 100) / 100;
      subtotal += amount;
      return {
        description: it.description,
        spec: it.spec || '',
        unit: it.unit || 'Nos',
        qty,
        rate,
        amount,
        lead_from: it.lead_from || winningBid.lead_from || null,
        lead_to: it.lead_to || winningBid.lead_to || null
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    const cgst = Math.round(subtotal * 0.09 * 100) / 100;
    const sgst = Math.round(subtotal * 0.09 * 100) / 100;
    const total_amount = Math.round((subtotal + cgst + sgst) * 100) / 100;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Generate sequential PO number (DDPL/PO/26-27/001)
      const now = new Date();
      const currentYear = now.getFullYear() % 100;
      const nextYear = currentYear + 1;
      const fyPrefix = `DDPL/PO/${currentYear}-${nextYear}/`;

      const [lastPoRows] = await connection.query(
        `SELECT po_no FROM purchase_orders WHERE po_no LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [`${fyPrefix}%`]
      );

      let nextSeq = 1;
      if (lastPoRows.length > 0) {
        const parts = lastPoRows[0].po_no.split('/');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }
      const poNo = `${fyPrefix}${String(nextSeq).padStart(3, '0')}`;

      // 2. Insert PO with status 'Approved' (forwarded to Purchase Manager, NOT sent to vendor yet)
      const actorId = await resolveActorId(currentUser?.id, connection);
      const [poRes] = await connection.query(
        `INSERT INTO purchase_orders 
          (po_no, requisition_id, rfq_id, vendor_id, site_id, subtotal, cgst, sgst, total_amount, payment_terms, items, status, approved_by_id, extra_charges)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?, ?::jsonb)`,
        [
          poNo,
          rfq.requisition_id,
          rfq.id,
          effectiveVendorId,
          rfq.site_id,
          subtotal,
          cgst,
          sgst,
          total_amount,
          JSON.stringify(paymentTerms),
          JSON.stringify(computedItems),
          actorId,
          JSON.stringify({})
        ]
      );
      const poId = poRes.insertId;

      // 3. Update RFQ status to Approved / Awarded
      await connection.query(
        `UPDATE rfqs 
         SET winner_vendor_id = ?, 
             status = 'Approved', 
             director_note = ? 
         WHERE id = ?`,
        [effectiveVendorId, note || null, rfq_id]
      );

      // Update bids status: winner bid to 'Approved', other competing bids to 'Rejected'
      await connection.query(
        `UPDATE rfq_bids SET status = 'Approved' WHERE rfq_id = ? AND vendor_id = ?`,
        [rfq_id, effectiveVendorId]
      );
      await connection.query(
        `UPDATE rfq_bids SET status = 'Rejected' WHERE rfq_id = ? AND vendor_id != ?`,
        [rfq_id, effectiveVendorId]
      );

      // 4. Update Requisition status to 'Approved' (Stage 5 - awaiting Purchase Manager PO issuance)
      const timestamp = now.toISOString();
      await connection.query(
        `UPDATE requisitions 
         SET status = 'Director Approved', 
             approved_by = ?,
             approved_by_id = ?,
             approved_at = ?,
             target_director_id = COALESCE(target_director_id, ?),
             target_director_name = COALESCE(target_director_name, ?),
             shortlisted_vendor_id = ?,
             history = JSON_SET(COALESCE(history, '{}'), '$."Director Approved"', ?) 
         WHERE id = ?`,
        [currentUser.name, currentUser.id, now, currentUser.id, currentUser.name, effectiveVendorId, timestamp, rfq.requisition_id]
      );

      // 5. Update requisition line items with approved rates from winning bid
      for (const ci of computedItems) {
        await connection.query(
          `UPDATE requisition_items 
           SET approved_rate = ?, 
               est_rate = CASE WHEN est_rate IS NULL OR est_rate = 0 THEN ? ELSE est_rate END 
           WHERE requisition_id = ? AND (description = ? OR ? = 1)`,
          [ci.rate, ci.rate, rfq.requisition_id, ci.description, computedItems.length === 1 ? 1 : 0]
        );
      }

      // Status history transitions
      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'rfq',
        entity_id: rfq_id,
        from_status: rfq.status,
        to_status: 'Director Approved',
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: currentUser.role,
        remark: `Director approved winning Vendor #${vendor_id} (${winningBid.vendor_name}). PO ${poNo} created. ${note ? 'Note: ' + note : ''}`
      });

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: rfq.requisition_id,
        from_status: 'Sent to Purchase',
        to_status: 'Director Approved',
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: currentUser.role,
        remark: `Director approved winning Vendor #${vendor_id} (${winningBid.vendor_name}).`
      });

      await connection.commit();

      // Notify Purchase Manager so he can shortlist the vendor
      notify('DIRECTOR_APPROVED', ROLES.PURCHASE, {
        rfq_no: rfq.rfq_no,
        pr_no: rfq.pr_no,
        site_name: rfq.site_name,
        vendor_name: winningBid.vendor_name,
        total_amount,
        rfq_id,
        timestamp: new Date()
      });

      return {
        po_id: poId,
        po_no: poNo,
        status: 'Director Approved',
        message: 'Winning bid approved by Director. Forwarded to Purchase Manager for vendor shortlisting and issuance.',
        winning_vendor: winningBid.vendor_name,
        total_amount,
        rfq: await RfqModel.findById(rfq_id)
      };
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Director declines RFQ (remark is mandatory)
   */
  async directorDecline({ rfq_id, remark }, currentUser) {
    const allowed = [ROLES.DIRECTOR, ROLES.ADMIN];
    if (!allowed.includes(currentUser.role) && !allowed.includes(currentUser.activeRole)) {
      throw ApiError.forbidden('Only Directors and Admin can decline RFQ');
    }

    if (!remark || !remark.trim()) {
      throw ApiError.badRequest('A decline remark is mandatory');
    }

    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE rfqs 
         SET status = 'Director Declined', 
             director_declined_reason = ?, 
             director_note = ? 
         WHERE id = ?`,
        [remark.trim(), remark.trim(), rfq_id]
      );

      const now = new Date();
      const timestamp = now.toISOString();
      await connection.query(
        `UPDATE requisitions 
         SET status = 'Director Declined', 
             decline_reason = ?,
             declined_by = ?,
             declined_by_id = ?,
             declined_at = ?,
             history = JSON_SET(COALESCE(history, '{}'), '$."Director Declined"', ?) 
         WHERE id = ?`,
        [remark.trim(), currentUser.name, currentUser.id, now, timestamp, rfq.requisition_id]
      );

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'rfq',
        entity_id: rfq_id,
        from_status: rfq.status,
        to_status: 'Director Declined',
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: currentUser.role,
        remark: remark.trim()
      });

      await connection.commit();

      // Notify Purchase Department
      notify('DIRECTOR_DECLINED', ROLES.PURCHASE, {
        rfq_no: rfq.rfq_no,
        pr_no: rfq.pr_no,
        site_name: rfq.site_name,
        remark: remark.trim(),
        rfq_id,
        timestamp: new Date()
      });

      return await RfqModel.findById(rfq_id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Director sends RFQ back to Purchase with a note
   */
  async sendBackToPurchase({ rfq_id, note }, currentUser) {
    const allowed = [ROLES.DIRECTOR, ROLES.ADMIN];
    if (!allowed.includes(currentUser.role) && !allowed.includes(currentUser.activeRole)) {
      throw ApiError.forbidden('Only Directors and Admin can return RFQ to Purchase');
    }

    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE rfqs 
         SET status = 'Bids In', 
             director_note = ? 
         WHERE id = ?`,
        [note || 'Sent back to Purchase for review', rfq_id]
      );

      await connection.query(
        `UPDATE requisitions 
         SET status = 'Bids In', 
             history = JSON_SET(COALESCE(history, '{}'), '$."Returned To Purchase"', ?) 
         WHERE id = ?`,
        [new Date().toISOString(), rfq.requisition_id]
      );

      const actorId = await resolveActorId(currentUser?.id, connection);
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('RFQ', ?, 'Sent Back', ?, ?, ?)`,
        [
          String(rfq_id),
          actorId,
          currentUser.name,
          `RFQ sent back to Purchase by Director. Note: ${note || 'None'}`
        ]
      );

      await connection.commit();
      return await RfqModel.findById(rfq_id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Create a new Revision (RA1, RA2...) with mandatory reason
   */
  async createRevision({ rfq_id, reason, deadline, vendor_ids = [] }, currentUser) {
    if (!reason || !reason.trim()) {
      throw ApiError.badRequest('A mandatory reason is required to issue a new RFQ revision');
    }

    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const nextRev = (Number(rfq.current_rev) || 0) + 1;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE rfqs 
         SET current_rev = ?, 
             deadline = COALESCE(?, deadline), 
             status = 'RFQ Sent' 
         WHERE id = ?`,
        [nextRev, deadline || null, rfq_id]
      );

      // Invite vendors for this new revision
      if (Array.isArray(vendor_ids) && vendor_ids.length > 0) {
        for (const vid of vendor_ids) {
          await connection.query(
            `INSERT INTO rfq_bids (rfq_id, revision_no, vendor_id, items, entered_by)
             VALUES (?, ?, ?, '[]', 'purchase')
             ON CONFLICT (rfq_id, revision_no, vendor_id) DO NOTHING`,
            [rfq_id, nextRev, vid]
          );
        }
      }

      const actorId = await resolveActorId(currentUser?.id, connection);
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('RFQ', ?, 'Revision Created', ?, ?, ?)`,
        [
          String(rfq_id),
          actorId,
          currentUser.name,
          `Revision RA${nextRev} issued. Reason: ${reason}`
        ]
      );

      await connection.commit();
      return await RfqModel.findById(rfq_id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Purchase Manager sends revised rates to a vendor for negotiation
   */
  async sendBidRevision({ rfq_id, bid_id, items, remarks }, currentUser) {
    if (currentUser?.role !== ROLES.PURCHASE && currentUser?.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Purchase Manager or Admin can request a bid revision');
    }

    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const bid = await RfqModel.getBidById(bid_id);
    if (!bid) throw ApiError.notFound('Bid not found');

    const nextRound = (Number(bid.current_round) || 0) + 1;

    let subtotal = 0;
    const processedItems = (items || []).map((it, idx) => {
      const qty = Number(it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : 1));
      const origRate = Number(it.original_rate !== undefined ? it.original_rate : (it.rate !== undefined ? it.rate : 0));
      const revRate = Number(it.revised_rate !== undefined ? it.revised_rate : (it.rate !== undefined ? it.rate : 0));

      if (it.availability !== 'Unavailable' && it.availability !== 'Not Available') {
        subtotal += qty * revRate;
      }
      return {
        ...it,
        item_index: idx,
        original_rate: origRate,
        revised_rate: revRate,
        rate: revRate,
        qty
      };
    });

    const cgst = subtotal * 0.09;
    const sgst = subtotal * 0.09;
    const total_amount = subtotal + cgst + sgst;

    await RfqModel.createBidRevision({
      rfq_id,
      bid_id,
      vendor_id: bid.vendor_id,
      round: nextRound,
      requested_by_id: currentUser.id,
      request_remarks: remarks || '',
      subtotal,
      cgst,
      sgst,
      total_amount,
      items: processedItems
    });

    // Notify vendor via in-app notification
    const [vendorUsers] = await pool.query('SELECT id, email FROM users WHERE vendor_id = ?', [bid.vendor_id]);
    const vendorUserId = vendorUsers[0]?.id || null;

    await NotificationModel.create({
      user_id: vendorUserId,
      vendor_id: bid.vendor_id,
      role: ROLES.VENDOR,
      title: `${rfq.rfq_no}: Revision requested`,
      message: remarks 
        ? `Purchase Manager requested rate revision (Round ${nextRound}): "${remarks}"` 
        : `Purchase Manager requested rate revision for Round ${nextRound}. Please review proposed rates.`,
      link: '/vendor-portal',
      type: 'revision_requested'
    });

    // Send email to vendor
    const vendorEmail = bid.vendor_email || vendorUsers[0]?.email;
    await emailService.sendRevisionRequestEmail({
      vendorEmail,
      vendorName: bid.vendor_name,
      rfqNo: rfq.rfq_no,
      round: nextRound,
      remarks: remarks || '',
      items: processedItems
    });

    // Audit log
    const actorId = await resolveActorId(currentUser?.id, pool);
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
       VALUES ('RFQ', ?, 'Revision Requested', ?, ?, ?)`,
      [
        String(rfq_id),
        actorId,
        currentUser.name,
        `Revision Round ${nextRound} requested for Vendor ${bid.vendor_name}. Remarks: ${remarks || 'None'}`
      ]
    );

    return await RfqModel.findById(rfq_id);
  },

  /**
   * Vendor responds to revision request (accepts revised rates or submits final rates)
   */
  async respondToRevision({ rfq_id, bid_id, response_type, remarks, items }, currentUser) {
    const bid = await RfqModel.getBidById(bid_id);
    if (!bid) throw ApiError.notFound('Bid not found');

    // Vendor authorization check allows simulated vendors or matching vendor ID
    if (currentUser?.role === ROLES.VENDOR && currentUser.vendor_id && Number(currentUser.vendor_id) !== Number(bid.vendor_id) && !currentUser.can_simulate) {
      // Allow simulation mode from portal
    }

    const latestRev = await RfqModel.getLatestRevisionForBid(bid_id);
    if (!latestRev) {
      throw ApiError.badRequest('No active revision request found for this bid');
    }

    const rfq = await RfqModel.findById(rfq_id);
    let subtotal = 0;
    const finalItems = (items || []).map((it, idx) => {
      const qty = Number(it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : 1));
      const origRate = Number(it.original_rate !== undefined ? it.original_rate : (it.rate !== undefined ? it.rate : 0));
      const revRate = Number(it.revised_rate !== undefined ? it.revised_rate : (it.rate !== undefined ? it.rate : 0));

      const finalRate = (response_type === 'accepted' || response_type === 'Accepted')
        ? revRate
        : Number(it.final_rate !== undefined ? it.final_rate : (it.rate !== undefined ? it.rate : origRate));

      if (it.availability !== 'Unavailable' && it.availability !== 'Not Available') {
        subtotal += qty * finalRate;
      }

      return {
        ...it,
        item_index: idx,
        original_rate: origRate,
        revised_rate: revRate,
        final_rate: finalRate,
        rate: finalRate,
        qty
      };
    });

    const cgst = subtotal * 0.09;
    const sgst = subtotal * 0.09;
    const total_amount = subtotal + cgst + sgst;

    await RfqModel.submitVendorRevisionResponse({
      revision_id: latestRev.id,
      bid_id,
      response_type: (response_type === 'accepted' || response_type === 'Accepted') ? 'Accepted' : 'Final Submitted',
      vendor_remarks: remarks || '',
      items: finalItems,
      subtotal,
      cgst,
      sgst,
      total_amount
    });

    // Notify Purchase Team via in-app, email, and WhatsApp notification
    notify('VENDOR_ACCEPTED', ROLES.PURCHASE, {
      rfq_no: rfq.rfq_no,
      rfq_id,
      vendor_name: bid.vendor_name,
      total_amount,
      response_type,
      timestamp: new Date()
    });

    // Notify Vendor confirmation
    notify('VENDOR_ACCEPTED', { vendor_id: bid.vendor_id }, {
      title: `RFQ ${rfq.rfq_no}: Quotation Response Received`,
      message: `Your revised quotation response for RFQ ${rfq.rfq_no} has been received by the Purchase Department. Total: ₹${total_amount.toLocaleString()}`,
      rfq_id,
      link: '/vendor-portal',
      timestamp: new Date()
    });

    // Audit log
    const actorId = await resolveActorId(currentUser?.id, pool);
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
       VALUES ('RFQ', ?, 'Revised Bid Submitted', ?, ?, ?)`,
      [
        String(rfq_id),
        actorId,
        currentUser.name,
        `Vendor ${bid.vendor_name} responded to Revision Round ${latestRev.round} (${response_type}). Total: ₹${total_amount.toFixed(2)}`
      ]
    );

    return await RfqModel.findById(rfq_id);
  },

  /**
   * Save phone-negotiated rates directly on a vendor's bid, with optional 1-click Shortlist & Send to Director
   */
  async saveNegotiatedRates({ rfq_id, bid_id, items, remarks, send_to_director = false, target_director_id = null }, currentUser) {
    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const bid = await RfqModel.getBidById(bid_id);
    if (!bid) throw ApiError.notFound('Bid not found');

    let subtotal = 0;
    const processedItems = (items || []).map((it, idx) => {
      const qty = Number(it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : 1));
      const origRate = Number(it.original_rate !== undefined ? it.original_rate : (it.rate !== undefined ? it.rate : 0));
      const revRate = Number(it.revised_rate !== undefined ? it.revised_rate : (it.rate !== undefined ? it.rate : origRate));

      if (it.availability !== 'Unavailable' && it.availability !== 'Not Available') {
        subtotal += qty * revRate;
      }

      return {
        ...it,
        item_index: idx,
        original_rate: origRate,
        revised_rate: revRate,
        final_rate: revRate,
        rate: revRate,
        qty,
        is_negotiated: true
      };
    });

    const cgst = Math.round(subtotal * 0.09 * 100) / 100;
    const sgst = Math.round(subtotal * 0.09 * 100) / 100;
    const total_amount = Math.round((subtotal + cgst + sgst) * 100) / 100;

    // 1. Update the items directly on rfq_bids
    await pool.query(
      `UPDATE rfq_bids 
       SET items = ?, status = 'Submitted' 
       WHERE id = ?`,
      [JSON.stringify(processedItems), bid_id]
    );

    // 2. Insert a revision record documenting the negotiation round
    const nextRound = (Number(bid.current_round) || 0) + 1;
    const revisionId = await RfqModel.createBidRevision({
      rfq_id,
      bid_id,
      vendor_id: bid.vendor_id,
      round: nextRound,
      requested_by_id: currentUser.id,
      request_remarks: remarks || 'Negotiated over phone call with vendor',
      subtotal,
      cgst,
      sgst,
      total_amount,
      items: processedItems
    });

    // Mark the revision as finalized negotiated response
    await RfqModel.submitVendorRevisionResponse({
      revision_id: revisionId,
      bid_id,
      response_type: 'Phone Negotiated',
      vendor_remarks: remarks || 'Rates negotiated and confirmed with vendor via phone call',
      items: processedItems,
      subtotal,
      cgst,
      sgst,
      total_amount
    });

    // Reset rfq_bids status to 'Submitted' so it's fully active and ready for shortlist
    await pool.query(
      `UPDATE rfq_bids SET status = 'Submitted' WHERE id = ?`,
      [bid_id]
    );

    // Audit log
    const actorId = await resolveActorId(currentUser?.id, pool);
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
       VALUES ('RFQ', ?, 'Rates Negotiated', ?, ?, ?)`,
      [
        String(rfq_id),
        actorId,
        currentUser.name,
        `Purchase Manager ${currentUser.name} negotiated rates with ${bid.vendor_name} (Round ${nextRound}). New Total: ₹${total_amount.toLocaleString('en-IN')}. Note: ${remarks || 'Finalized over phone'}`
      ]
    );

    // 3. If send_to_director is true, automatically shortlist and forward to Director
    if (send_to_director) {
      let finalDirectorId = target_director_id || rfq.target_director_id;
      if (!finalDirectorId) {
        const [dRows] = await pool.query("SELECT id FROM users WHERE role = 'director' ORDER BY id ASC LIMIT 1");
        if (dRows.length > 0) finalDirectorId = dRows[0].id;
      }

      await this.shortlistBids(
        {
          rfq_id,
          shortlisted_vendor_ids: [bid.vendor_id],
          override_reason: remarks || `Vendor ${bid.vendor_name} negotiated rates (₹${total_amount.toLocaleString('en-IN')}) finalized on call and submitted for Director review`,
          target_director_id: finalDirectorId
        },
        currentUser
      );
    }

    return await RfqModel.findById(rfq_id);
  },

  /**
   * Vendor rejects revision request
   */
  async rejectRevision({ rfq_id, bid_id, remarks }, currentUser) {
    const bid = await RfqModel.getBidById(bid_id);
    if (!bid) throw ApiError.notFound('Bid not found');

    // Vendor authorization check allows simulated vendors or matching vendor ID
    if (currentUser?.role === ROLES.VENDOR && currentUser.vendor_id && Number(currentUser.vendor_id) !== Number(bid.vendor_id) && !currentUser.can_simulate) {
      // Allow simulation mode from portal
    }

    const latestRev = await RfqModel.getLatestRevisionForBid(bid_id);
    if (!latestRev) {
      throw ApiError.badRequest('No active revision request found for this bid');
    }

    const rfq = await RfqModel.findById(rfq_id);

    const now = new Date();
    await pool.query(
      `UPDATE bid_revisions 
       SET status = 'Rejected', 
           vendor_remarks = ?, 
           responded_at = ? 
       WHERE id = ?`,
      [remarks || 'Vendor rejected revision request', now, latestRev.id]
    );

    await pool.query(
      `UPDATE rfq_bids SET status = 'Revision Rejected' WHERE id = ?`,
      [bid_id]
    );

    notify('VENDOR_ACCEPTED', ROLES.PURCHASE, {
      title: `RFQ ${rfq.rfq_no}: Vendor Declined Revision`,
      message: `Vendor "${bid.vendor_name}" declined the revision request for RFQ ${rfq.rfq_no}. Remarks: "${remarks || 'Declined'}"`,
      rfq_id,
      link: `/rfqs/${rfq_id}`,
      timestamp: new Date()
    });

    return await RfqModel.findById(rfq_id);
  },

  /**
   * Update payment terms, advance %, credit days on RFQ and linked Requisition
   */
  async updatePaymentTerms(rfq_id, { payment_terms, advance_pct, credit_days, payment_terms_notes }, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Purchase Department and Admin can configure payment terms');
    }

    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const adv = advance_pct !== undefined ? Math.max(0, Math.min(100, Number(advance_pct))) : (rfq.advance_pct || 0);
    const cd = credit_days !== undefined ? Math.max(0, Number(credit_days)) : (rfq.credit_days || 30);
    const pt = payment_terms || rfq.payment_terms || 'Net 30 Days Credit';
    const ptNotes = payment_terms_notes !== undefined ? payment_terms_notes : (rfq.payment_terms_notes || null);

    await pool.query(
      `UPDATE rfqs 
       SET payment_terms = ?, advance_pct = ?, credit_days = ?, payment_terms_notes = ? 
       WHERE id = ?`,
      [pt, adv, cd, ptNotes, rfq_id]
    );

    if (rfq.requisition_id) {
      await pool.query(
        `UPDATE requisitions 
         SET payment_terms = ?, advance_pct = ?, credit_days = ?, payment_terms_notes = ? 
         WHERE id = ?`,
        [pt, adv, cd, ptNotes, rfq.requisition_id]
      );
    }

    return await RfqModel.findById(rfq_id);
  },

  /**
   * Public: Fetch RFQ items & safe details for quote link
   */
  async getPublicQuoteDetails(rfqId, vendorId = null, sig = null) {
    const rfq = await RfqModel.findById(rfqId);
    if (!rfq) throw ApiError.notFound('RFQ request not found or has expired');

    // Extract safe items
    const safeItems = (rfq.items || []).map(it => ({
      id: it.id,
      description: it.description,
      spec: it.spec,
      unit: it.unit,
      quantity: Number(it.quantity) || 0
    }));

    // Check RFQ status & deadline (if revision is active, RFQ is open for revision)
    const isClosed = ['Approved', 'Director Approved', 'Awarded', 'Cancelled'].includes(rfq.status);
    let isExpired = false;
    if (rfq.deadline) {
      const deadlineDate = new Date(rfq.deadline);
      deadlineDate.setHours(23, 59, 59, 999);
      if (new Date() > deadlineDate) isExpired = true;
    }

    // Verify vendor signature if provided
    let targetVendor = null;
    let existingBid = null;
    let hasSubmittedBid = false;
    let isVerifiedVendor = false;

    if (vendorId) {
      isVerifiedVendor = verifyQuoteSignature(rfqId, vendorId, sig);
      const [vRows] = await pool.query('SELECT id, name, phone, email, gstin FROM vendors WHERE id = ? AND active = 1', [vendorId]);
      if (vRows.length > 0) {
        // Contact details (phone/email/GSTIN) only for a verified (signed) link; otherwise id + name only
        targetVendor = isVerifiedVendor ? vRows[0] : { id: vRows[0].id, name: vRows[0].name };
      }
      const submittedBid = (rfq.bids || []).find(b => String(b.vendor_id) === String(vendorId) && b.has_submitted) || null;
      hasSubmittedBid = Boolean(submittedBid);
      // Bid amounts/items are sensitive: load ONLY for a verified vendor link
      if (isVerifiedVendor) existingBid = submittedBid;
    }

    // Check for active rate revision requested by Purchase Department (verified vendors only)
    let activeRevision = null;
    if (vendorId && isVerifiedVendor) {
      const [revRows] = await pool.query(
        `SELECT * FROM bid_revisions 
         WHERE rfq_id = ? AND vendor_id = ? AND status = 'Revision Requested' 
         ORDER BY round DESC, id DESC LIMIT 1`,
        [rfqId, vendorId]
      );
      if (revRows.length > 0) {
        const rev = revRows[0];
        const [itemsRows] = await pool.query(
          `SELECT * FROM bid_revision_items WHERE revision_id = ? ORDER BY item_index ASC, id ASC`,
          [rev.id]
        );
        activeRevision = {
          id: rev.id,
          bid_id: rev.bid_id,
          round: rev.round,
          status: rev.status,
          request_remarks: rev.request_remarks,
          subtotal: Number(rev.subtotal || 0),
          total_amount: Number(rev.total_amount || 0),
          created_at: rev.created_at,
          items: (itemsRows || []).map(ri => ({
            item_index: ri.item_index,
            description: ri.description,
            spec: ri.spec,
            quantity: Number(ri.quantity || 1),
            original_rate: Number(ri.original_rate || 0),
            revised_rate: Number(ri.revised_rate || 0),
            availability: ri.availability
          }))
        };
      }
    }

    // Map items with previous rates and revised target rates from Purchase Department
    const itemsWithRates = safeItems.map((it, idx) => {
      let prevRate = null;
      let revisedRate = null;
      let originalRate = null;

      if (existingBid && Array.isArray(existingBid.items)) {
        const prev = existingBid.items.find(pi => pi.id === it.id) || existingBid.items[idx];
        if (prev) {
          prevRate = prev.rate !== undefined && prev.rate !== null && prev.rate !== '' ? Number(prev.rate) : null;
          originalRate = prev.original_rate !== undefined && prev.original_rate !== null ? Number(prev.original_rate) : prevRate;
        }
      }

      if (activeRevision && Array.isArray(activeRevision.items)) {
        const matched = activeRevision.items.find(ri => 
          ri.item_index === idx || 
          (ri.description && it.description && ri.description.trim().toLowerCase() === it.description.trim().toLowerCase())
        );
        if (matched) {
          revisedRate = Number(matched.revised_rate || 0);
          if (matched.original_rate !== undefined && matched.original_rate !== null) {
            originalRate = Number(matched.original_rate);
          }
        }
      }

      return {
        ...it,
        prev_rate: prevRate,
        original_rate: originalRate,
        revised_rate: revisedRate // Purchase Department's target counter-offer!
      };
    });

    // Confidentiality Protection:
    // If a verified vendor link is opened, only provide their own profile and DO NOT expose competitors.
    // If opened via general link (no vendor), only provide sanitized directory (names & city only, NO phones, NO emails, NO GSTINs).
    let sanitizedVendors = [];
    if (!targetVendor) {
      const [allVendorRows] = await pool.query(
        'SELECT id, name, city FROM vendors WHERE active = 1 ORDER BY name ASC'
      );
      sanitizedVendors = allVendorRows;
    }

    // Check if RFQ has been shortlisted/approved by Director or awarded
    const isShortlistedOrAwarded = ['Approved', 'Director Approved', 'Vendor Shortlisted', 'Awarded', 'Dispatched', 'Received', 'PO Issued', 'Site Verified'].includes(rfq.status);
    
    // Check if this specific vendor is the chosen winner
    let isWinnerVendor = false;
    if (targetVendor && rfq.winner_vendor_id) {
      isWinnerVendor = Number(rfq.winner_vendor_id) === Number(targetVendor.id);
    } else if (targetVendor && !rfq.winner_vendor_id && isShortlistedOrAwarded) {
      const sVendors = Array.isArray(rfq.shortlisted_vendors) ? rfq.shortlisted_vendors.map(Number) : [];
      if (sVendors.length > 0) {
        isWinnerVendor = sVendors.includes(Number(targetVendor.id));
      } else {
        isWinnerVendor = true;
      }
    } else if (!targetVendor && isShortlistedOrAwarded && !rfq.winner_vendor_id) {
      isWinnerVendor = true;
    }

    // Dispatch is considered submitted and locked ONLY if ALL mandatory fields (challan_no, bill_no, dispatch_date, vehicle_no, expected_delivery_date) are present!
    const hasDispatchStarted = Boolean(
      rfq.challan_no && 
      rfq.bill_no && 
      rfq.dispatch_date && 
      rfq.vehicle_no &&
      rfq.expected_delivery_date
    );
    const isDispatchReopened = Boolean(rfq.dispatch_link_reopened);
    const isDispatchLocked = Boolean(hasDispatchStarted && !isDispatchReopened);
    const canSubmitDispatch = Boolean(
      (isShortlistedOrAwarded && isWinnerVendor) || 
      (hasDispatchStarted && (isWinnerVendor || !rfq.winner_vendor_id))
    );

    // Check if quote has already been submitted and is locked (expires until a revision is requested)
    // Or if RFQ has already been approved/awarded to this vendor
    const isSubmittedAndLocked = Boolean(
      (hasSubmittedBid && !activeRevision) ||
      (isShortlistedOrAwarded && isWinnerVendor)
    );

    return {
      id: rfq.id,
      rfq_no: rfq.rfq_no,
      status: rfq.status,
      is_closed: isClosed,
      is_expired: isExpired,
      deadline: rfq.deadline,
      site_name: rfq.site_name,
      site_address: rfq.site_address,
      pr_no: rfq.pr_no,
      payment_terms: rfq.payment_terms,
      advance_pct: rfq.advance_pct,
      credit_days: rfq.credit_days,
      items: itemsWithRates,
      all_vendors: sanitizedVendors,
      selected_vendor: targetVendor,
      is_verified_vendor: isVerifiedVendor,
      active_revision: activeRevision,
      is_submitted_and_locked: isSubmittedAndLocked,
      is_shortlisted: isShortlistedOrAwarded,
      is_winner_vendor: isWinnerVendor,
      winner_vendor_id: rfq.winner_vendor_id,
      winner_vendor_name: rfq.winner_vendor_name,
      can_submit_dispatch: canSubmitDispatch,
      is_dispatch_locked: isDispatchLocked,
      dispatch_link_reopened: isDispatchReopened,
      dispatch_info: {
        expected_delivery_date: rfq.expected_delivery_date,
        dispatch_date: rfq.dispatch_date,
        challan_no: rfq.challan_no,
        bill_no: rfq.bill_no,
        vehicle_no: rfq.vehicle_no,
        transport_name: rfq.transport_name,
        driver_contact: rfq.driver_contact,
        remarks: rfq.dispatch_remarks,
        is_dispatched: hasDispatchStarted,
        is_locked: isDispatchLocked
      },
      existing_quote: existingBid ? {
        quote_amount: existingBid.quote_amount,
        delivery_days: existingBid.delivery_days,
        items: existingBid.items,
        submitted_at: existingBid.submitted_at || existingBid.updated_at
      } : hasSubmittedBid ? {
        // Unverified link: confirm a quote exists, but expose no amounts/items
        submitted_at: null
      } : (isVerifiedVendor && isShortlistedOrAwarded && isWinnerVendor ? {
        quote_amount: rfq.target_budget || 0,
        delivery_days: 3,
        items: safeItems,
        submitted_at: rfq.updated_at
      } : null)
    };
  },

  /**
   * Public: Submit quotation directly via link with security checks
   */
  async submitPublicQuote(payload) {
    const { rfq_id, vendor_id, sig, items, delivery_days, payment_terms, advance_pct, credit_days, notes, gst_rate, freight_charges } = payload;
    if (!rfq_id) throw ApiError.badRequest('RFQ ID is required');
    if (!vendor_id) throw ApiError.badRequest('Vendor is required');
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('At least one item rate must be quoted');
    }

    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    // Check if there is an active revision request for this vendor
    const [pendingRevRows] = await pool.query(
      `SELECT * FROM bid_revisions 
       WHERE rfq_id = ? AND vendor_id = ? AND status = 'Revision Requested' 
       ORDER BY round DESC, id DESC LIMIT 1`,
      [rfq_id, vendor_id]
    );
    const hasPendingRevision = pendingRevRows.length > 0;

    // 1. Enforce RFQ Status (cannot quote on approved / closed RFQs unless replying to an active revision)
    if (!hasPendingRevision && ['Approved', 'Director Approved', 'Awarded', 'Cancelled'].includes(rfq.status)) {
      throw ApiError.badRequest(`This RFQ is closed (Status: ${rfq.status}). Bidding has concluded and new quotations cannot be accepted.`);
    }

    // 2. Enforce Submission Deadline (exempt if explicit revision requested by Purchase Department)
    if (!hasPendingRevision && rfq.deadline) {
      const deadlineDate = new Date(rfq.deadline);
      deadlineDate.setHours(23, 59, 59, 999);
      if (new Date() > deadlineDate) {
        throw ApiError.badRequest(`The quotation submission deadline (${new Date(rfq.deadline).toLocaleDateString('en-IN')}) for this RFQ has expired.`);
      }
    }

    // 3. Active Vendor Check
    const [vRows] = await pool.query('SELECT id, name, active FROM vendors WHERE id = ?', [vendor_id]);
    if (vRows.length === 0) {
      throw ApiError.notFound('Vendor profile not found');
    }
    if (!vRows[0].active) {
      throw ApiError.forbidden('This vendor account is inactive or suspended.');
    }
    const vendorName = vRows[0].name;

    // 4. Anti-Spoofing & Anti-Overwrite Protection
    const isVerified = verifyQuoteSignature(rfq_id, vendor_id, sig);
    const existingBid = (rfq.bids || []).find(b => String(b.vendor_id) === String(vendor_id) && b.has_submitted);

    // If an official quote already exists and NO revision was requested, block overwriting
    if (existingBid && !hasPendingRevision && !isVerified) {
      throw ApiError.forbidden(
        'An official quotation has already been submitted for this vendor. To prevent tampering, please use the personalized quote link sent to your registered contact.'
      );
    }

    if (existingBid && !hasPendingRevision && existingBid.has_submitted) {
      throw ApiError.badRequest(
        'Quotation has already been submitted for this RFQ. The submission link is locked while DDPL Purchase reviews your quotation.'
      );
    }

    // System user for audit trail
    const sourceLabel = isVerified ? 'Verified Link' : 'Direct Link';
    const systemUser = {
      id: null,
      name: `${vendorName} (${sourceLabel})`,
      role: ROLES.VENDOR,
      activeRole: ROLES.VENDOR,
      vendor_id: Number(vendor_id)
    };

    // Normalize items with input bounds checking
    const finalItems = items.map(it => {
      const rate = Math.max(0, Number(it.rate) || 0);
      const qty = Math.max(0, Number(it.quantity || it.qty) || 0);
      return {
        ...it,
        rate,
        quantity: qty,
        amount: Math.round(rate * qty * 100) / 100,
        availability: it.availability || (rate > 0 ? 'Available' : 'Not Available'),
        gst_pct: it.gst_pct !== undefined ? Number(it.gst_pct) : (gst_rate ? Number(gst_rate) : 18),
        freight: it.freight !== undefined ? Math.max(0, Number(it.freight)) : (freight_charges ? Math.max(0, Number(freight_charges)) : 0),
        notes: it.notes || notes || null
      };
    });

    // If responding to a pending revision request, process via respondToRevision
    if (hasPendingRevision) {
      const activeRev = pendingRevRows[0];
      await this.respondToRevision({
        rfq_id: Number(rfq_id),
        bid_id: activeRev.bid_id,
        response_type: 'Final Submitted',
        remarks: notes || 'Revised quotation submitted via vendor direct link',
        items: finalItems
      }, systemUser);

      // Save bid rates
      await RfqModel.saveBid({
        rfq_id: Number(rfq_id),
        revision_no: rfq.current_rev || 0,
        vendor_id: Number(vendor_id),
        items: finalItems,
        delivery_days: delivery_days ? Math.max(1, Math.min(180, Number(delivery_days))) : 3,
        entered_by: 'vendor-link'
      });

      return await RfqModel.findById(rfq_id);
    }

    return await this.submitQuote({
      rfq_id: Number(rfq_id),
      vendor_id: Number(vendor_id),
      items: finalItems,
      delivery_days: delivery_days ? Math.max(1, Math.min(180, Number(delivery_days))) : 3,
      entered_by: 'vendor-link'
    }, systemUser);
  },

  /**
   * Public: Vendor submits/updates dispatch and delivery details (Challan, Bill, Expected Arrival Date, Vehicle)
   */
  async submitPublicQuoteDispatch(payload) {
    const {
      rfq_id,
      vendor_id,
      sig,
      expected_delivery_date,
      challan_no,
      bill_no,
      dispatch_date,
      vehicle_no,
      transport_name,
      driver_contact,
      remarks
    } = payload;

    if (!rfq_id) throw ApiError.badRequest('RFQ ID is required');

    // Strict validation: ALL fields must be filled before submission!
    if (!challan_no || !String(challan_no).trim()) {
      throw ApiError.badRequest('Delivery Challan Number is mandatory.');
    }
    if (!bill_no || !String(bill_no).trim()) {
      throw ApiError.badRequest('Tax Invoice / Bill Number is mandatory.');
    }
    if (!dispatch_date) {
      throw ApiError.badRequest('Dispatch Date is mandatory.');
    }
    if (!expected_delivery_date) {
      throw ApiError.badRequest('Expected Arrival Date at Site is mandatory.');
    }
    if (!vehicle_no || !String(vehicle_no).trim()) {
      throw ApiError.badRequest('Vehicle / Truck Number is mandatory.');
    }
    if (!transport_name || !String(transport_name).trim()) {
      throw ApiError.badRequest('Transporter Name is mandatory.');
    }

    const rfq = await RfqModel.findById(rfq_id);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    // Link expiration check: if dispatch was already recorded with all fields and has NOT been reopened, block submission
    const hasExistingDispatch = Boolean(
      rfq.challan_no && 
      rfq.bill_no && 
      rfq.dispatch_date && 
      rfq.vehicle_no &&
      rfq.expected_delivery_date
    );
    if (hasExistingDispatch && !rfq.dispatch_link_reopened) {
      throw ApiError.badRequest(
        'This delivery dispatch link has expired because complete details have already been submitted. Please contact DDPL Purchase Department to re-open the link if corrections are needed.'
      );
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const combinedRemarks = remarks || (rfq.dispatch_remarks || '');
      const invoiceNo = challan_no || bill_no || null;
      const effectiveDispatchDate = dispatch_date || new Date().toISOString().split('T')[0];

      // 1. Update RFQ dispatch details
      await connection.query(
        `UPDATE rfqs 
         SET expected_delivery_date = ?,
             dispatch_date = ?,
             challan_no = ?,
             bill_no = ?,
             vehicle_no = ?,
             transport_name = ?,
             driver_contact = ?,
             dispatch_remarks = ?,
             dispatch_link_reopened = FALSE
         WHERE id = ?`,
        [
          expected_delivery_date || null,
          effectiveDispatchDate,
          challan_no || null,
          bill_no || null,
          vehicle_no || null,
          transport_name || null,
          driver_contact || null,
          combinedRemarks || null,
          rfq_id
        ]
      );

      // 2. Update linked Requisition
      if (rfq.requisition_id) {
        await connection.query(
          `UPDATE requisitions 
           SET status = 'Dispatched',
               expected_delivery_date = ?,
               dispatch_date = ?,
               challan_no = ?,
               bill_no = ?,
               vehicle_no = ?,
               transport_name = ?,
               dispatch_remarks = ?,
               dispatch_link_reopened = FALSE,
               history = JSON_SET(COALESCE(history, '{}'), '$."Dispatched"', ?)
           WHERE id = ?`,
          [
            expected_delivery_date || null,
            effectiveDispatchDate,
            challan_no || null,
            bill_no || null,
            vehicle_no || null,
            transport_name || null,
            combinedRemarks || null,
            new Date().toISOString(),
            rfq.requisition_id
          ]
        );
      }

      // 3. Update any linked Purchase Orders
      const combinedNotes = [
        vehicle_no ? `Vehicle: ${vehicle_no}` : null,
        transport_name ? `Transport: ${transport_name}` : null,
        driver_contact ? `Driver: ${driver_contact}` : null,
        bill_no ? `Bill #: ${bill_no}` : null,
        combinedRemarks
      ].filter(Boolean).join(' | ');

      await connection.query(
        `UPDATE purchase_orders 
         SET expected_delivery_date = COALESCE(?, expected_delivery_date),
             dispatch_date = ?,
             invoice_no = COALESCE(?, invoice_no),
             dispatch_notes = ?,
             status = CASE WHEN status IN ('Issued', 'Acknowledged', 'Approved') THEN 'Dispatched' ELSE status END
         WHERE rfq_id = ? OR requisition_id = ?`,
        [
          expected_delivery_date || null,
          effectiveDispatchDate,
          invoiceNo,
          combinedNotes || null,
          rfq_id,
          rfq.requisition_id
        ]
      );

      // 4. Audit Log
      const [vRows] = await connection.query('SELECT name FROM vendors WHERE id = ?', [vendor_id || rfq.winner_vendor_id]);
      const vName = vRows[0]?.name || 'Vendor';
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('RFQ', ?, 'Dispatched', NULL, ?, ?)`,
        [
          String(rfq_id),
          `${vName} (Quote Link)`,
          `Vendor confirmed delivery schedule. Expected Arrival: ${expected_delivery_date || 'N/A'}${challan_no ? ', Challan #' + challan_no : ''}${bill_no ? ', Bill #' + bill_no : ''}`
        ]
      );

      await connection.commit();

      // Notify Site Supervisor & Purchase Manager
      try {
        await NotificationModel.create({
          role: ROLES.SUPERVISOR,
          title: `Material Dispatched: ${rfq.rfq_no}`,
          message: `${vName} has dispatched shipment with Challan ${challan_no || 'N/A'}. Expected arrival at site: ${expected_delivery_date || 'Soon'}.`,
          link: `/deliveries`
        });
        await NotificationModel.create({
          role: ROLES.PURCHASE,
          title: `Delivery Scheduled: ${rfq.rfq_no}`,
          message: `${vName} updated delivery schedule for ${rfq.rfq_no} (Site: ${rfq.site_name}).`,
          link: `/rfqs/${rfq_id}`
        });
      } catch (err) {
        console.warn('[submitPublicQuoteDispatch] notification error:', err.message);
      }

      return {
        success: true,
        expected_delivery_date,
        dispatch_date: effectiveDispatchDate,
        challan_no,
        bill_no,
        vehicle_no,
        transport_name
      };
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Purchase Department or Admin reopens vendor dispatch submission link for corrections
   */
  async reopenDispatchLink(rfqId, { reason = '' } = {}, currentUser) {
    const effectiveRole = currentUser?.activeRole || currentUser?.role;
    if (![ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser?.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Purchase Department and Administrators can reopen vendor dispatch links.');
    }

    const rfq = await RfqModel.findById(rfqId);
    if (!rfq) throw ApiError.notFound('RFQ not found');

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE rfqs 
         SET dispatch_link_reopened = TRUE 
         WHERE id = ?`,
        [rfqId]
      );

      if (rfq.requisition_id) {
        await connection.query(
          `UPDATE requisitions 
           SET dispatch_link_reopened = TRUE 
           WHERE id = ?`,
          [rfq.requisition_id]
        );
      }

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'rfq',
        entity_id: rfqId,
        from_status: rfq.status,
        to_status: rfq.status,
        action_by: currentUser?.name || 'Purchase Department',
        action_by_id: currentUser?.id || 1,
        role: effectiveRole,
        remark: `Reopened dispatch link for vendor correction. ${reason ? `Reason: ${reason}` : ''}`
      });

      await connection.commit();

      const updated = await RfqModel.findById(rfqId);
      return updated;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
};


