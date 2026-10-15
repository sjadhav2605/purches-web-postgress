import pool from '../../config/db.js';
import { RequisitionModel } from './requisition.model.js';
import { RfqModel } from '../rfqs/rfq.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ROLES } from '../../constants/roles.js';
import { notify } from '../../services/notificationDispatcher.js';
import { StatusHistoryService } from '../../services/statusHistoryService.js';
import { formatWorkflowDateTime } from '../../utils/dateFormatter.js';
import { persistItemPhotos, persistDataUrlItem } from '../../utils/storageService.js';

let pipelineStatsCache = null;
let pipelineStatsCacheTime = 0;
const STATS_CACHE_TTL = 4000; // 4 seconds in-memory cache

export const invalidatePipelineStatsCache = () => {
  pipelineStatsCache = null;
  pipelineStatsCacheTime = 0;
};

export const RequisitionService = {
  /**
   * Create a new Requisition with line items (Atomic Transaction)
   */
  async createRequisition(requisitionPayload, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    const allowedRoles = [ROLES.SUPERVISOR, ROLES.PC, ROLES.PURCHASE, ROLES.ADMIN];
    if (!allowedRoles.includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Site Supervisors, Project Coordinators, and Admin can raise Purchase Requests');
    }

    // Verify site exists
    const [siteRows] = await pool.query('SELECT id, name, code FROM sites WHERE id = ? AND active = 1', [
      requisitionPayload.site_id
    ]);
    if (siteRows.length === 0) {
      throw ApiError.badRequest('Selected site does not exist or is inactive');
    }

    // Upload item photos to storage before opening the DB transaction
    const itemsWithPhotoUrls = await persistItemPhotos(requisitionPayload.items);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const prNo = await RequisitionModel.generateNextPrNumber(connection);
      const timestamp = new Date().toISOString();

      let initialStatus = 'Raised';
      if (requisitionPayload.status === 'Draft') {
        initialStatus = 'Draft';
      } else {
        initialStatus = 'Raised';
      }

      const initialHistory = {
        [initialStatus]: timestamp
      };

      const requisitionData = {
        pr_no: prNo,
        site_id: requisitionPayload.site_id,
        requested_by_id: currentUser.id,
        category: requisitionPayload.category || 'Civil',
        status: initialStatus,
        required_by_date: requisitionPayload.required_by_date,
        remarks: requisitionPayload.remarks,
        history: initialHistory
      };

      const requisitionId = await RequisitionModel.create(
        requisitionData,
        itemsWithPhotoUrls,
        connection
      );

      // Record in status_history and audit_logs
      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: requisitionId,
        from_status: null,
        to_status: initialStatus,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: initialStatus === 'Draft' ? 'Draft request saved' : 'Material request raised by Site Supervisor'
      });

      await connection.commit();

      // Notify Project Coordinator if raised
      if (initialStatus === 'Raised') {
        notify('PR_RAISED', ROLES.PC, {
          pr_no: prNo,
          site_name: siteRows[0].name,
          requester_name: currentUser.name,
          items_count: (requisitionPayload.items || []).length,
          requisition_id: requisitionId,
          timestamp: new Date()
        });
      }

      return await RequisitionModel.findById(requisitionId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Get paginated list of requisitions with search and filters
   */
  async getRequisitions(queryParams, currentUser) {
    const { page, limit, search, status, tab, site_id, sort_by, order, my_requests, director_id } = queryParams;
    const effectiveRole = currentUser.activeRole || currentUser.role;

    return await RequisitionModel.findAll({
      page,
      limit,
      search,
      status,
      tab,
      site_id,
      userRole: effectiveRole,
      userId: currentUser.id,
      defaultSiteId: currentUser.default_site_id,
      my_requests,
      director_id,
      sort_by,
      order
    });
  },

  /**
   * Get single requisition by ID
   */
  async getRequisitionById(id, currentUser) {
    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    const effectiveRole = currentUser.activeRole || currentUser.role;

    // Supervisor & PC never see pricing or rates
    if ([ROLES.PC, ROLES.SUPERVISOR].includes(effectiveRole)) {
      if (requisition.items && Array.isArray(requisition.items)) {
        requisition.items = requisition.items.map((item) => {
          const { est_rate, approved_rate, ...priceFreeItem } = item;
          return priceFreeItem;
        });
      }
      delete requisition.approved_subtotal;
      delete requisition.approved_gst;
      delete requisition.approved_total;
    }

    // Purchase Department can only view requests that have been accepted by Project Coordinator
    if (effectiveRole === 'purchase' && ['Draft', 'Raised', 'PR Raised', 'Pending PC Approval', 'Coordinator Declined'].includes(requisition.status)) {
      if (requisition.requested_by_id !== currentUser.id && currentUser.role !== ROLES.ADMIN) {
        throw ApiError.forbidden('This request has not yet been accepted by the Project Coordinator and is not accessible to Purchase Department.');
      }
    }

    // Director visibility: if request is assigned to a specific director, other directors cannot view it
    if (effectiveRole === ROLES.DIRECTOR && currentUser.role !== ROLES.ADMIN) {
      if (requisition.target_director_id) {
        const uId = Number(currentUser?.directorId || currentUser?.id);
        const isD2 = (uId === 10 || uId === 6) || (currentUser?.email && currentUser.email.includes('director2'));
        const isD3 = (uId === 11 || uId === 7) || (currentUser?.email && currentUser.email.includes('director3'));
        const isD1 = (uId === 5) || (currentUser?.email && (currentUser.email.includes('director1') || currentUser.email === 'director@ddpl.com'));
        
        const targetId = Number(requisition.target_director_id);
        const matchesTarget = (isD2 && (targetId === 6 || targetId === 10)) ||
                              (isD3 && (targetId === 7 || targetId === 11)) ||
                              (isD1 && targetId === 5);

        if (!matchesTarget) {
          throw ApiError.forbidden(`This request has been assigned to ${requisition.target_director_name || 'another Director'} and is not accessible to you.`);
        }
      }
    }

    return requisition;
  },

  /**
   * Coordinator edits request before approving (quantity, items, required-by date, remarks)
   * Tracks full diff history in requisition_edits table
   */
  async coordinatorEdit(id, payload, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PC, ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Project Coordinators, Purchase Department, and Admin can edit requests');
    }

    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    const allowedStatuses = ['Raised', 'PR Raised', 'Draft', 'Pending PC Approval', 'Sent to Purchase', 'Coordinator Approved'];
    if (!allowedStatuses.includes(requisition.status) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.badRequest(`Request cannot be edited while in "${requisition.status}" stage.`);
    }

    // Upload any new item photos to storage before opening the DB transaction
    if (Array.isArray(payload.items)) {
      payload = { ...payload, items: await persistItemPhotos(payload.items) };
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Detect and track changes in requisition_edits
      if (payload.required_by_date && payload.required_by_date !== requisition.required_by_date) {
        await connection.query(
          `INSERT INTO requisition_edits (requisition_id, field, old_value, new_value, edited_by, edited_by_id)
           VALUES (?, 'required_by_date', ?, ?, ?, ?)`,
          [id, String(requisition.required_by_date || 'None'), String(payload.required_by_date), currentUser.name, currentUser.id]
        );
      }

      if (payload.remarks !== undefined && payload.remarks !== requisition.remarks) {
        await connection.query(
          `INSERT INTO requisition_edits (requisition_id, field, old_value, new_value, edited_by, edited_by_id)
           VALUES (?, 'remarks', ?, ?, ?, ?)`,
          [id, String(requisition.remarks || ''), String(payload.remarks || ''), currentUser.name, currentUser.id]
        );
      }

      // Check items diffs
      if (Array.isArray(payload.items)) {
        const oldMap = new Map();
        (requisition.items || []).forEach((it) => {
          oldMap.set(it.id || it.description?.trim().toLowerCase(), it);
        });

        for (const newItem of payload.items) {
          const old = oldMap.get(newItem.id) || oldMap.get(newItem.description?.trim().toLowerCase());
          if (old) {
            if (Number(old.quantity) !== Number(newItem.quantity)) {
              await connection.query(
                `INSERT INTO requisition_edits (requisition_id, field, old_value, new_value, edited_by, edited_by_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  id,
                  `item_qty (${newItem.description})`,
                  `${old.quantity} ${old.unit}`,
                  `${newItem.quantity} ${newItem.unit}`,
                  currentUser.name,
                  currentUser.id
                ]
              );
            }
          } else {
            await connection.query(
              `INSERT INTO requisition_edits (requisition_id, field, old_value, new_value, edited_by, edited_by_id)
               VALUES (?, ?, 'None', ?, ?, ?)`,
              [
                id,
                `item_added (${newItem.description})`,
                `${newItem.quantity} ${newItem.unit}`,
                currentUser.name,
                currentUser.id
              ]
            );
          }
        }
      }

      // 2. Update line items
      if (Array.isArray(payload.items) && payload.items.length > 0) {
        await RequisitionModel.updateItems(id, payload.items, connection);
      }

      // 3. Update header fields
      const updateHeader = {};
      if (payload.required_by_date) updateHeader.required_by_date = payload.required_by_date;
      if (payload.remarks !== undefined) updateHeader.remarks = payload.remarks;
      if (Object.keys(updateHeader).length > 0) {
        await RequisitionModel.update(id, updateHeader, connection);
      }

      // 4. Audit Log
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('PR', ?, 'Coordinator Edit', ?, ?, ?)`,
        [
          String(id),
          currentUser.id,
          currentUser.name,
          `Project Coordinator ${currentUser.name} edited request items and fields.`
        ]
      );

      await connection.commit();
      return await RequisitionModel.findById(id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Project Coordinator approves request & sends to Purchase Department
   */
  async coordinatorApprove(id, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PC, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Project Coordinators and Admin can approve requests');
    }

    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    const now = new Date();
    const newStatus = 'Sent to Purchase';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let currentHistory = requisition.history || {};
      currentHistory[newStatus] = now.toISOString();

      await connection.query(
        `UPDATE requisitions 
         SET status = ?, 
             approved_by = ?, 
             approved_by_id = ?, 
             approved_at = ?, 
             history = ?
         WHERE id = ?`,
        [newStatus, currentUser.name, currentUser.id, now, JSON.stringify(currentHistory), id]
      );

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: id,
        from_status: requisition.status,
        to_status: newStatus,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: `Approved by Project Coordinator ${currentUser.name} and forwarded to Purchase Department`
      });

      await connection.commit();

      // Notifications:
      // (a) Notify Site Supervisor
      notify('COORDINATOR_APPROVED', requisition.requested_by_id, {
        pr_no: requisition.pr_no,
        site_name: requisition.site_name,
        actor_name: currentUser.name,
        requisition_id: id,
        timestamp: now
      });

      // (b) Notify Purchase Department
      notify('COORDINATOR_APPROVED', ROLES.PURCHASE, {
        pr_no: requisition.pr_no,
        site_name: requisition.site_name,
        actor_name: currentUser.name,
        requester_name: requisition.requested_by_name,
        requisition_id: id,
        timestamp: now
      });

      return await RequisitionModel.findById(id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Project Coordinator declines request (reason required)
   */
  async coordinatorDecline(id, { reason }, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PC, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Project Coordinators and Admin can decline requests');
    }

    if (!reason || !reason.trim()) {
      throw ApiError.badRequest('A decline reason is mandatory');
    }

    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    const now = new Date();
    const newStatus = 'Coordinator Declined';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let currentHistory = requisition.history || {};
      currentHistory[newStatus] = now.toISOString();

      await connection.query(
        `UPDATE requisitions 
         SET status = ?, 
             declined_by = ?, 
             declined_by_id = ?, 
             declined_at = ?, 
             decline_reason = ?, 
             history = ?
         WHERE id = ?`,
        [newStatus, currentUser.name, currentUser.id, now, reason.trim(), JSON.stringify(currentHistory), id]
      );

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: id,
        from_status: requisition.status,
        to_status: newStatus,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: reason.trim()
      });

      await connection.commit();

      // Notify Site Supervisor
      notify('COORDINATOR_DECLINED', requisition.requested_by_id, {
        pr_no: requisition.pr_no,
        site_name: requisition.site_name,
        actor_name: currentUser.name,
        reason: reason.trim(),
        requisition_id: id,
        timestamp: now
      });

      return await RequisitionModel.findById(id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Purchase Department approves request & sends RFQ to selected vendors with payment terms
   */
  async purchaseApprove(id, { vendor_ids, deadline, payment_terms, advance_pct, credit_days, payment_terms_notes, remarks }, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Purchase Department and Admin can approve requests and float RFQ');
    }

    if (!Array.isArray(vendor_ids) || vendor_ids.length === 0) {
      throw ApiError.badRequest('Please select at least one vendor to send the RFQ to');
    }

    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    // Must be approved by Project Coordinator first
    if (['Draft', 'Raised', 'Pending PC Approval', 'PR Raised', 'Coordinator Declined'].includes(requisition.status)) {
      throw ApiError.badRequest('Cannot process RFQ for this request. It must first be approved by the Project Coordinator.');
    }

    // 1st time floating RFQ: Terms & conditions are not added yet (only item rates quoted)
    const adv = advance_pct !== undefined && advance_pct !== null ? Math.max(0, Math.min(100, Number(advance_pct))) : null;
    const cd = credit_days !== undefined && credit_days !== null ? Math.max(0, Number(credit_days)) : null;
    const pt = payment_terms || null;
    const ptNotes = payment_terms_notes || null;

    const now = new Date();
    const newStatus = 'Purchase Approved';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let currentHistory = requisition.history || {};
      currentHistory[newStatus] = now.toISOString();

      await connection.query(
        `UPDATE requisitions 
         SET status = ?, 
             approved_by = ?, 
             approved_by_id = ?, 
             approved_at = ?, 
             history = ?,
             payment_terms = ?,
             advance_pct = ?,
             credit_days = ?,
             payment_terms_notes = ?
         WHERE id = ?`,
        [newStatus, currentUser.name, currentUser.id, now, JSON.stringify(currentHistory), pt, adv, cd, ptNotes, id]
      );

      // Generate RFQ
      const rfqNo = await RfqModel.generateNextRfqNumber(connection);
      const [rfqRes] = await connection.query(
        `INSERT INTO rfqs (rfq_no, requisition_id, site_id, deadline, status, created_by_id, created_by_name, created_by_role, payment_terms, advance_pct, credit_days, payment_terms_notes)
         VALUES (?, ?, ?, ?, 'RFQ Sent', ?, ?, ?, ?, ?, ?, ?)`,
        [rfqNo, id, requisition.site_id, deadline || null, currentUser.id, currentUser.name, effectiveRole, pt, adv, cd, ptNotes]
      );
      const rfqId = rfqRes.insertId;

      // Seed invited vendor bids placeholder
      for (const vid of vendor_ids) {
        await connection.query(
          `INSERT INTO rfq_bids (rfq_id, revision_no, vendor_id, items, status)
           VALUES (?, 0, ?, '[]', 'Pending Quote')
           ON CONFLICT (rfq_id, revision_no, vendor_id) DO NOTHING`,
          [rfqId, vid]
        );
      }

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: id,
        from_status: requisition.status,
        to_status: newStatus,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: `Approved by Purchase Department. Floated RFQ ${rfqNo} (${pt}, Adv: ${adv}%, Credit: ${cd}d) to ${vendor_ids.length} vendor(s)`
      });

      await connection.commit();

      // Notify selected vendors
      for (const vid of vendor_ids) {
        notify('PURCHASE_APPROVED', { vendor_id: vid }, {
          pr_no: requisition.pr_no,
          rfq_no: rfqNo,
          rfq_id: rfqId,
          site_name: requisition.site_name,
          deadline,
          payment_terms: pt,
          advance_pct: adv,
          credit_days: cd,
          timestamp: now
        });
      }

      const updatedPr = await RequisitionModel.findById(id);
      return {
        ...updatedPr,
        rfq_id: rfqId,
        rfq_no: rfqNo,
        payment_terms: pt,
        advance_pct: adv,
        credit_days: cd,
        payment_terms_notes: ptNotes
      };
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Update payment terms, advance %, credit days on Requisition and linked RFQs
   */
  async updatePaymentTerms(id, { payment_terms, advance_pct, credit_days, payment_terms_notes }, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Purchase Department and Admin can configure payment terms');
    }

    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    const adv = advance_pct !== undefined ? Math.max(0, Math.min(100, Number(advance_pct))) : (requisition.advance_pct || 0);
    const cd = credit_days !== undefined ? Math.max(0, Number(credit_days)) : (requisition.credit_days || 30);
    const pt = payment_terms || requisition.payment_terms || 'Net 30 Days Credit';
    const ptNotes = payment_terms_notes !== undefined ? payment_terms_notes : (requisition.payment_terms_notes || null);

    await pool.query(
      `UPDATE requisitions 
       SET payment_terms = ?, advance_pct = ?, credit_days = ?, payment_terms_notes = ? 
       WHERE id = ?`,
      [pt, adv, cd, ptNotes, id]
    );

    await pool.query(
      `UPDATE rfqs 
       SET payment_terms = ?, advance_pct = ?, credit_days = ?, payment_terms_notes = ? 
       WHERE requisition_id = ?`,
      [pt, adv, cd, ptNotes, id]
    );

    return await RequisitionModel.findById(id);
  },

  /**
   * Purchase Department declines request (reason required)
   */
  async purchaseDecline(id, { reason }, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Purchase Department and Admin can decline requests');
    }

    if (!reason || !reason.trim()) {
      throw ApiError.badRequest('A decline reason is mandatory');
    }

    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    // Cannot decline a request that has not yet reached Purchase Department
    if (['Draft', 'Raised', 'Pending PC Approval', 'PR Raised', 'Coordinator Declined'].includes(requisition.status)) {
      throw ApiError.badRequest('Cannot decline a request that has not yet been accepted by the Project Coordinator.');
    }

    const now = new Date();
    const newStatus = 'Purchase Declined';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let currentHistory = requisition.history || {};
      currentHistory[newStatus] = now.toISOString();

      await connection.query(
        `UPDATE requisitions 
         SET status = ?, 
             declined_by = ?, 
             declined_by_id = ?, 
             declined_at = ?, 
             decline_reason = ?, 
             history = ?
         WHERE id = ?`,
        [newStatus, currentUser.name, currentUser.id, now, reason.trim(), JSON.stringify(currentHistory), id]
      );

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: id,
        from_status: requisition.status,
        to_status: newStatus,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: reason.trim()
      });

      await connection.commit();

      // Notify Site Supervisor and Project Coordinator
      notify('PURCHASE_DECLINED', requisition.requested_by_id, {
        pr_no: requisition.pr_no,
        site_name: requisition.site_name,
        reason: reason.trim(),
        requisition_id: id,
        timestamp: now
      });

      notify('PURCHASE_DECLINED', ROLES.PC, {
        pr_no: requisition.pr_no,
        site_name: requisition.site_name,
        reason: reason.trim(),
        requisition_id: id,
        timestamp: now
      });

      return await RequisitionModel.findById(id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Purchase Manager shortlists one vendor after Director approval
   */
  async shortlistVendor(id, { vendor_id, payment_terms, advance_pct, credit_days, payment_terms_notes }, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Purchase Department and Admin can shortlist winning vendors');
    }

    if (!vendor_id) {
      throw ApiError.badRequest('Vendor ID is required');
    }

    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    const [vendorRows] = await pool.query('SELECT id, name FROM vendors WHERE id = ?', [vendor_id]);
    if (vendorRows.length === 0) {
      throw ApiError.notFound('Selected vendor does not exist');
    }
    const vendorName = vendorRows[0].name;

    const now = new Date();
    const newStatus = 'Vendor Shortlisted';

    const pt = payment_terms || requisition.payment_terms || 'Net 30 Days Credit';
    const adv = advance_pct !== undefined && advance_pct !== null ? Number(advance_pct) : (requisition.advance_pct || 0);
    const cd = credit_days !== undefined && credit_days !== null ? Number(credit_days) : (requisition.credit_days || 30);
    const ptNotes = payment_terms_notes !== undefined ? payment_terms_notes : requisition.payment_terms_notes;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let currentHistory = requisition.history || {};
      currentHistory[newStatus] = now.toISOString();

      await connection.query(
        `UPDATE requisitions 
         SET status = ?, 
             shortlisted_vendor_id = ?, 
             payment_terms = ?,
             advance_pct = ?,
             credit_days = ?,
             payment_terms_notes = ?,
             history = ?
         WHERE id = ?`,
        [newStatus, vendor_id, pt, adv, cd, ptNotes, JSON.stringify(currentHistory), id]
      );

      // Also update linked RFQ winner/shortlisted and terms by specific rfq.id
      const [linkedRfqs] = await connection.query(
        'SELECT id FROM rfqs WHERE requisition_id = ? ORDER BY id DESC LIMIT 1',
        [id]
      );
      if (linkedRfqs.length > 0) {
        await connection.query(
          `UPDATE rfqs 
           SET shortlisted_vendor_id = ?, 
               winner_vendor_id = COALESCE(winner_vendor_id, ?),
               payment_terms = ?,
               advance_pct = ?,
               credit_days = ?,
               payment_terms_notes = ?
           WHERE id = ?`,
          [vendor_id, vendor_id, pt, adv, cd, ptNotes, linkedRfqs[0].id]
        );
      }

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: id,
        from_status: requisition.status,
        to_status: newStatus,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: `Vendor "${vendorName}" shortlisted by Purchase Manager ${currentUser.name}`
      });

      await connection.commit();

      // Notify Vendor (dashboard + email + WhatsApp: "You are shortlisted")
      notify('VENDOR_SHORTLISTED', { vendor_id }, {
        pr_no: requisition.pr_no,
        rfq_no: requisition.linked_rfq?.rfq_no || `RFQ-${id}`,
        site_name: requisition.site_name,
        vendor_name: vendorName,
        timestamp: now
      });

      return await RequisitionModel.findById(id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Vendor adds delivery details (dispatch date, vehicle, transport, challan no, dispatched qty)
   * Sets status to 'Dispatched' and notifies Coordinator, Supervisor, and Purchase Dept
   */
  async dispatchDelivery(id, payload, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    const allowed = [ROLES.VENDOR, ROLES.PURCHASE, ROLES.ADMIN];
    if (!allowed.includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Vendors, Purchase Department, and Admin can record dispatch details');
    }

    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    // Role check for vendor: only dispatch if shortlisted or assigned
    if (currentUser.role === ROLES.VENDOR && currentUser.vendor_id) {
      if (requisition.shortlisted_vendor_id && requisition.shortlisted_vendor_id !== currentUser.vendor_id) {
        throw ApiError.forbidden('You are not authorized to dispatch for this request');
      }
    }

    const {
      dispatch_date = new Date().toISOString().split('T')[0],
      vehicle_no,
      transport_name,
      challan_no,
      dispatched_qty,
      dispatch_remarks
    } = payload;

    if (!challan_no || !challan_no.trim()) {
      throw ApiError.badRequest('Challan number is required');
    }

    const now = new Date();
    const newStatus = 'Dispatched';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let currentHistory = requisition.history || {};
      currentHistory[newStatus] = now.toISOString();

      await connection.query(
        `UPDATE requisitions 
         SET status = ?, 
             dispatch_date = ?, 
             vehicle_no = ?, 
             transport_name = ?, 
             challan_no = ?, 
             dispatched_qty = ?, 
             dispatch_remarks = ?, 
             history = ?
         WHERE id = ?`,
        [
          newStatus,
          dispatch_date,
          vehicle_no || null,
          transport_name || null,
          challan_no.trim(),
          dispatched_qty || null,
          dispatch_remarks || null,
          JSON.stringify(currentHistory),
          id
        ]
      );

      // If linked PO exists, update PO status to Dispatched
      await connection.query(
        `UPDATE purchase_orders 
         SET status = 'Dispatched', 
             dispatch_date = ?, 
             invoice_no = COALESCE(?, invoice_no), 
             dispatch_notes = COALESCE(?, dispatch_notes)
         WHERE requisition_id = ?`,
        [dispatch_date, challan_no.trim(), dispatch_remarks || null, id]
      );

      // If linked RFQ exists, update RFQ status to Dispatched
      await connection.query(
        `UPDATE rfqs SET status = 'Dispatched' WHERE requisition_id = ?`,
        [id]
      );

      const vendorDisplayName = currentUser.role === ROLES.VENDOR ? currentUser.name : (requisition.shortlisted_vendor_name || 'Vendor');

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: id,
        from_status: requisition.status,
        to_status: newStatus,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: `Materials dispatched under Challan ${challan_no.trim()} (Vehicle: ${vehicle_no || 'N/A'}, Qty: ${dispatched_qty || 'All'})`
      });

      await connection.commit();

      // Notifications:
      // Project Coordinator, Site Supervisor, and Purchase Department
      const dispatchPayload = {
        pr_no: requisition.pr_no,
        site_name: requisition.site_name,
        vendor_name: vendorDisplayName,
        challan_no: challan_no.trim(),
        vehicle_no: vehicle_no || 'N/A',
        dispatched_qty: dispatched_qty || 'Complete',
        dispatch_date,
        requisition_id: id,
        timestamp: now
      };

      notify('MATERIAL_DISPATCHED', requisition.requested_by_id, dispatchPayload);
      notify('MATERIAL_DISPATCHED', ROLES.PC, dispatchPayload);
      notify('MATERIAL_DISPATCHED', ROLES.PURCHASE, dispatchPayload);

      return await RequisitionModel.findById(id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Site Supervisor marks material as Received and uploads proof (challan photo/PDF, received qty, remarks)
   * Sets status to 'Received' and notifies Purchase Manager & Project Coordinator
   */
  async receiveDelivery(id, payload, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    const allowed = [ROLES.SUPERVISOR, ROLES.PC, ROLES.PURCHASE, ROLES.ADMIN];
    if (!allowed.includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Site Supervisors, Project Coordinators, and Admin can verify receipts');
    }

    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    const {
      received_qty,
      challan_no = requisition.challan_no || 'N/A',
      remarks = 'Material arrived and verified at site',
      received_date = new Date().toISOString().split('T')[0]
    } = payload;

    // Upload the proof file (challan photo/PDF) to storage before opening the DB transaction
    const proof_file = await persistDataUrlItem(payload.proof_file, 'delivery_proofs', 'proof');

    const now = new Date();
    const newStatus = 'Received';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let currentHistory = requisition.history || {};
      currentHistory[newStatus] = now.toISOString();

      // 1. Update Requisition
      await connection.query(
        `UPDATE requisitions 
         SET status = ?, 
             history = ?
         WHERE id = ?`,
        [newStatus, JSON.stringify(currentHistory), id]
      );

      // 2. Find linked PO if any
      const [poRows] = await connection.query(
        'SELECT id FROM purchase_orders WHERE requisition_id = ? ORDER BY id DESC LIMIT 1',
        [id]
      );
      const poId = poRows.length > 0 ? poRows[0].id : null;

      // 3. Create Delivery record if not already recorded
      let deliveryId = null;
      if (poId) {
        const [delRes] = await connection.query(
          `INSERT INTO deliveries (po_id, site_id, requisition_id, challan_no, received_date, recorded_by_id, received_items, challan_photos, remarks)
           VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)`,
          [
            poId,
            requisition.site_id,
            id,
            challan_no,
            received_date,
            currentUser.id,
            proof_file ? JSON.stringify([proof_file]) : '[]',
            remarks
          ]
        );
        deliveryId = delRes.insertId;

        // Update PO status to Site Verified
        await connection.query(
          `UPDATE purchase_orders 
           SET status = 'Site Verified', 
               verified_by_id = ?, 
               invoice_no = COALESCE(?, invoice_no) 
           WHERE id = ?`,
          [currentUser.id, challan_no, poId]
        );
      }

      // 4. Record in delivery_receipts table
      await connection.query(
        `INSERT INTO delivery_receipts (delivery_id, requisition_id, po_id, received_by, received_by_id, received_qty, proof_file, remark, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deliveryId,
          id,
          poId,
          currentUser.name,
          currentUser.id,
          received_qty || null,
          proof_file || null,
          remarks,
          now
        ]
      );

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: id,
        from_status: requisition.status,
        to_status: newStatus,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: `Received at site by ${currentUser.name}. Qty: ${received_qty || 'Complete'}, Challan: ${challan_no}. ${remarks}`
      });

      await connection.commit();

      // Notifications:
      // On "Received", Purchase Manager and Project Coordinator are notified
      const receivePayload = {
        pr_no: requisition.pr_no,
        site_name: requisition.site_name,
        actor_name: currentUser.name,
        received_qty: received_qty || 'All items',
        challan_no,
        requisition_id: id,
        timestamp: now
      };

      notify('MATERIAL_RECEIVED', ROLES.PURCHASE, receivePayload);
      notify('MATERIAL_RECEIVED', ROLES.PC, receivePayload);

      return await RequisitionModel.findById(id);
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  /**
   * Generic Status Transition
   */
  async updateStatus(id, newStatus, remarks, currentUser) {
    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    const effectiveRole = currentUser.activeRole || currentUser.role;
    const now = new Date();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let currentHistory = requisition.history || {};
      currentHistory[newStatus] = now.toISOString();

      await connection.query(
        `UPDATE requisitions 
         SET status = ?, history = ? 
         WHERE id = ?`,
        [newStatus, JSON.stringify(currentHistory), id]
      );

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: id,
        from_status: requisition.status,
        to_status: newStatus,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: remarks || `Status changed to ${newStatus}`
      });

      await connection.commit();
      return await RequisitionModel.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Update Estimated Rates for items in a PR (Purchase Department / Admin only)
   */
  async updateEstimatedRates(requisitionId, itemRates, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Purchase Department and Admin can set estimated rates');
    }

    const requisition = await RequisitionModel.findById(requisitionId);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${requisitionId} not found`);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of itemRates) {
        await connection.query(
          'UPDATE requisition_items SET est_rate = ? WHERE id = ? AND requisition_id = ?',
          [item.est_rate, item.id, requisitionId]
        );
      }

      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('PR', ?, 'Rates Updated', ?, ?, ?)`,
        [
          String(requisitionId),
          currentUser.id,
          currentUser.name,
          `Purchase Department updated estimated rates for ${itemRates.length} line items`
        ]
      );

      await connection.commit();
      return await RequisitionModel.findById(requisitionId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Update Requisition Line Items & Quantities
   */
  async updateItems(id, newItems, currentUser) {
    return await this.coordinatorEdit(id, { items: newItems }, currentUser);
  },

  /**
   * Delete Draft Requisition
   */
  async deleteRequisition(id, currentUser) {
    const requisition = await RequisitionModel.findById(id);
    if (!requisition) {
      throw ApiError.notFound(`Request with ID ${id} not found`);
    }

    if (requisition.status !== 'Draft' && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.badRequest('Only Draft requests can be deleted. Active PRs must be Rejected instead.');
    }

    await RequisitionModel.delete(id);
    return { id, message: 'Request deleted successfully' };
  },

  /**
   * Get 7-stage procurement pipeline counts (Cached & Parallelized)
   */
  async getPipelineStats() {
    const now = Date.now();
    if (pipelineStatsCache && (now - pipelineStatsCacheTime) < STATS_CACHE_TTL) {
      return pipelineStatsCache;
    }

    try {
      const [
        [prs],
        [rfqs],
        [bids],
        [shortlisted],
        [approved],
        [pos],
        [deliveries]
      ] = await Promise.all([
        // Stage 1: PR Raised (Requisitions pending Purchase review)
        pool.query("SELECT COUNT(id) AS c FROM requisitions WHERE status IN ('Draft', 'Raised', 'Pending PC Approval', 'PR Raised', 'Sent to Purchase')"),
        // Stage 2: RFQ Sent (Open for quoting)
        pool.query("SELECT COUNT(id) AS c FROM rfqs WHERE status IN ('Open', 'RFQ Sent')"),
        // Stage 3: Bids In (Quotes received, awaiting shortlist)
        pool.query("SELECT COUNT(id) AS c FROM rfqs WHERE status = 'Bids In'"),
        // Stage 4: Shortlisted (Shortlisted by Purchase, awaiting Director approval)
        pool.query("SELECT COUNT(id) AS c FROM rfqs WHERE status IN ('Shortlisted', 'Under_Review', 'Vendor Shortlisted')"),
        // Stage 5: Approved (Approved by Director, awaiting formal PO issuance)
        pool.query("SELECT COUNT(id) AS c FROM rfqs WHERE status IN ('Approved', 'Director Approved') AND id NOT IN (SELECT rfq_id FROM purchase_orders WHERE rfq_id IS NOT NULL AND status NOT IN ('Draft', 'Cancelled'))"),
        // Stage 6: PO Issued (Formal PO issued to vendor, awaiting shipment)
        pool.query("SELECT COUNT(id) AS c FROM purchase_orders WHERE status IN ('Issued', 'Acknowledged')"),
        // Stage 7: Delivered & Verified (Shipment dispatched, site verified, or delivery receipt recorded)
        pool.query("SELECT COUNT(id) AS c FROM purchase_orders WHERE status IN ('Dispatched', 'Site Verified', 'Partially Received', 'Received')")
      ]);

      pipelineStatsCache = {
        pr_raised: prs[0]?.c || 0,
        rfq_sent: rfqs[0]?.c || 0,
        bids_in: bids[0]?.c || 0,
        shortlisted: shortlisted[0]?.c || 0,
        approved: approved[0]?.c || 0,
        po_issued: pos[0]?.c || 0,
        delivered_verified: deliveries[0]?.c || 0
      };
      pipelineStatsCacheTime = now;

      return pipelineStatsCache;
    } catch (err) {
      console.error('Error fetching pipeline stats:', err);
      return {
        pr_raised: 0,
        rfq_sent: 0,
        bids_in: 0,
        shortlisted: 0,
        approved: 0,
        po_issued: 0,
        delivered_verified: 0
      };
    }
  },

  /**
   * Reopen vendor dispatch link for corrections
   */
  async reopenDispatchLink(requisitionId, { reason = '' } = {}, currentUser) {
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (![ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only Purchase Department and Administrators can reopen vendor dispatch links.');
    }

    const pr = await RequisitionModel.findById(requisitionId);
    if (!pr) throw ApiError.notFound('Requisition not found');

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE requisitions 
         SET dispatch_link_reopened = TRUE 
         WHERE id = ?`,
        [requisitionId]
      );

      // Also update linked RFQ if any
      await connection.query(
        `UPDATE rfqs 
         SET dispatch_link_reopened = TRUE 
         WHERE requisition_id = ?`,
        [requisitionId]
      );

      await StatusHistoryService.recordTransition({
        connection,
        entity_type: 'requisition',
        entity_id: requisitionId,
        from_status: pr.status,
        to_status: pr.status,
        action_by: currentUser.name,
        action_by_id: currentUser.id,
        role: effectiveRole,
        remark: `Reopened dispatch link for vendor correction. ${reason ? `Reason: ${reason}` : ''}`
      });

      await connection.commit();
      return await RequisitionModel.findById(requisitionId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
};
