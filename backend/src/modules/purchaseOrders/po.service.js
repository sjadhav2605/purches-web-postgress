import pool from '../../config/db.js';
import { PurchaseOrderModel } from './po.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ROLES } from '../../constants/roles.js';
import notificationDispatcher from '../../services/notificationDispatcher.js';
import { verifyPoSignature, generatePoSignature } from '../../utils/security.js';
import { scopeFor, assertPoVisible, PO_COLS } from '../../utils/dataScope.js';

// Roles allowed to receive the signed vendor delivery-link signature (they issue/share links)
const DELIVERY_LINK_ROLES = [ROLES.PURCHASE, ROLES.DIRECTOR, ROLES.ADMIN];

/**
 * Strictly enforce that a public delivery link is signed for this exact (PO, vendor) pair.
 * Throws 403 on missing/invalid/tampered signature or vendor mismatch.
 */
const assertValidPoLink = (po, vendorId, sig) => {
  if (
    !vendorId ||
    !sig ||
    String(vendorId) !== String(po.vendor_id) ||
    !verifyPoSignature(po.id, po.vendor_id, sig)
  ) {
    throw ApiError.forbidden('Invalid or tampered delivery link signature');
  }
};

export const PurchaseOrderService = {
  /**
   * Create new Purchase Order with automatic tax calculation and atomic transaction
   */
  async createPO(payload, currentUser) {
    // 1. Role validation: Director, Purchase, Admin
    const allowed = [ROLES.DIRECTOR, ROLES.PURCHASE, ROLES.ADMIN];
    if (!allowed.includes(currentUser.role)) {
      throw ApiError.forbidden('Only Purchase Department, Directors, and Admin can issue Purchase Orders');
    }

    // 2. Calculate line amounts and totals
    let subtotal = 0;
    const computedItems = payload.items.map((item) => {
      const amount = Number(item.qty) * Number(item.rate);
      subtotal += amount;
      return {
        description: item.description,
        spec: item.spec || '',
        unit: item.unit,
        qty: Number(item.qty),
        rate: Number(item.rate),
        amount: Math.round(amount * 100) / 100
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    // 18% GST (9% CGST + 9% SGST)
    const cgst = Math.round((subtotal * 0.09) * 100) / 100;
    const sgst = Math.round((subtotal * 0.09) * 100) / 100;

    // Extra charges calculation (Delivery, Labour, Other, Extra GST)
    const extraCharges = payload.extra_charges || {};
    const delivery_charges = Number(extraCharges.delivery_charges || 0);
    const labour_charges = Number(extraCharges.labour_charges || 0);
    const other_charges = Number(extraCharges.other_charges || 0);
    const extra_gst_pct = Number(extraCharges.gst_pct || 0);
    const extra_subtotal = Math.round((delivery_charges + labour_charges + other_charges) * 100) / 100;
    const extra_gst = Math.round((extra_subtotal * (extra_gst_pct / 100)) * 100) / 100;
    const total_extra = Math.round((extra_subtotal + extra_gst) * 100) / 100;

    const materialsTotal = Math.round((subtotal + cgst + sgst) * 100) / 100;
    const total_amount = Math.round((materialsTotal + total_extra) * 100) / 100;

    const computedExtraCharges = {
      delivery_charges,
      labour_charges,
      other_charges,
      gst_pct: extra_gst_pct,
      gst_amount: extra_gst,
      total_extra,
      notes: extraCharges.notes || ''
    };

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 3. Auto-generate sequential PO Number (e.g. DDPL/PO/26-27/001)
      const poNo = await PurchaseOrderModel.generateNextPoNumber(connection);

      const poData = {
        po_no: poNo,
        requisition_id: payload.requisition_id,
        rfq_id: payload.rfq_id || null,
        vendor_id: payload.vendor_id,
        site_id: payload.site_id,
        subtotal,
        cgst,
        sgst,
        total_amount,
        payment_terms: payload.payment_terms || { advance_pct: 0, credit_days: 0, notes: '' },
        items: computedItems,
        status: 'Issued',
        approved_by_id: currentUser.id,
        extra_charges: computedExtraCharges
      };

      const poId = await PurchaseOrderModel.create(poData, connection);

      // 4. Update Requisition and RFQ status to 'PO Issued'
      if (payload.requisition_id) {
        await connection.query(
          `UPDATE requisitions 
           SET status = 'PO Issued', 
               history = JSON_SET(COALESCE(history, '{}'), '$."PO Issued"', ?) 
           WHERE id = ?`,
          [new Date().toISOString(), payload.requisition_id]
        );
      }
      if (payload.rfq_id) {
        await connection.query(
          `UPDATE rfqs SET status = 'PO Issued' WHERE id = ?`,
          [payload.rfq_id]
        );
      }

      // 5. Audit Log
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('PO', ?, 'PO Issued', ?, ?, ?)`,
        [
          String(poId),
          currentUser.id,
          currentUser.name,
          `PO ${poNo} issued for ₹${total_amount.toLocaleString()} to Vendor #${payload.vendor_id}`
        ]
      );

      await connection.commit();

      return await PurchaseOrderModel.findById(poId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Get paginated POs with search and filter
   */
  async getPOs(queryParams, currentUser) {
    const { page, limit, search, status, vendor_id, site_id, sort_by, order } = queryParams;

    const isVendor = currentUser.role === ROLES.VENDOR;

    // Vendor users are hard-scoped to their own vendor_id; any client-supplied vendor_id is ignored
    let effectiveVendorId = vendor_id || null;
    if (isVendor) {
      if (!currentUser.vendor_id) {
        throw ApiError.forbidden('Your account is not linked to a vendor profile');
      }
      effectiveVendorId = currentUser.vendor_id;
    }

    // Record-level scope: director -> routed to them, supervisor/pc -> their site, vendor -> own, admin/purchase/accounts -> all
    const scope = scopeFor(currentUser, PO_COLS);

    const result = await PurchaseOrderModel.findAll({
      page,
      limit,
      search,
      status,
      vendor_id: effectiveVendorId,
      site_id,
      exclude_unissued: isVendor,
      sort_by,
      order,
      scope
    });

    if ([ROLES.PC, ROLES.SUPERVISOR].includes(currentUser.role)) {
      result.items = result.items.map((po) => {
        const { total_amount, subtotal, cgst, sgst, ...priceFreePo } = po;
        return priceFreePo;
      });
    }

    // Attach signed vendor delivery-link signature for roles that issue/share links
    if (DELIVERY_LINK_ROLES.includes(currentUser.role)) {
      result.items = result.items.map((po) => ({
        ...po,
        delivery_sig: generatePoSignature(po.id, po.vendor_id)
      }));
    }

    return result;
  },

  /**
   * Get single PO details by ID
   */
  async getPOById(id, currentUser) {
    const po = await PurchaseOrderModel.findById(id);
    if (!po) {
      throw ApiError.notFound(`Purchase Order with ID ${id} not found`);
    }

    // Role check for vendor: can only see their OWN POs, and never unissued ones
    if (currentUser.role === ROLES.VENDOR) {
      if (!currentUser.vendor_id || Number(po.vendor_id) !== Number(currentUser.vendor_id)) {
        throw ApiError.forbidden('You do not have access to this Purchase Order');
      }
      if (['Approved', 'Draft'].includes(po.status)) {
        throw ApiError.forbidden('This Purchase Order has not yet been issued by the Purchase Department');
      }
    }

    // Record-level scope (director / supervisor / pc / vendor); 403 when outside the user's scope
    await assertPoVisible(po.id, currentUser);

    // SERVER-ENFORCED ACCESS MATRIX
    // 1. PC and Supervisor: NEVER see any price or rate, including on POs
    if ([ROLES.PC, ROLES.SUPERVISOR].includes(currentUser.role)) {
      po.subtotal = null;
      po.cgst = null;
      po.sgst = null;
      po.total_amount = null;
      if (Array.isArray(po.items)) {
        po.items = po.items.map((item) => {
          const { rate, amount, ...priceFreeItem } = item;
          return priceFreeItem;
        });
      }
    }

    // 2. Accounts: Sees PO totals and taxes but NOT per-line rates
    if (currentUser.role === ROLES.ACCOUNTS) {
      if (Array.isArray(po.items)) {
        po.items = po.items.map((item) => {
          const { rate, ...rateFreeItem } = item;
          return rateFreeItem;
        });
      }
    }

    // Attach signed vendor delivery-link signature for roles that issue/share links
    if (DELIVERY_LINK_ROLES.includes(currentUser.role)) {
      po.delivery_sig = generatePoSignature(po.id, po.vendor_id);
    }

    return po;
  },

  /**
   * Update PO Status (Issued, Acknowledged, Dispatched, Site Verified, Cancelled)
   */
  async updateStatus(id, newStatus, invoice_no, note, currentUser, dispatch_date = null, expected_delivery_date = null, dispatch_notes = null) {
    const po = await PurchaseOrderModel.findById(id);
    if (!po) {
      throw ApiError.notFound(`Purchase Order with ID ${id} not found`);
    }

    // Validate PO status transition
    const ALLOWED_PO_TRANSITIONS = {
      'Draft': ['Approved', 'Cancelled'],
      'Approved': ['Issued', 'Cancelled'],
      'Issued': ['Acknowledged', 'Dispatched', 'Cancelled'],
      'Acknowledged': ['Dispatched', 'Cancelled'],
      'Dispatched': ['Partially Received', 'Site Verified', 'Cancelled'],
      'Partially Received': ['Site Verified', 'Cancelled'],
      'Site Verified': [],
      'Cancelled': []
    };

    if (po.status !== newStatus) {
      const allowedNext = ALLOWED_PO_TRANSITIONS[po.status];
      if (allowedNext && !allowedNext.includes(newStatus)) {
        throw ApiError.badRequest(
          `Invalid status transition: cannot change Purchase Order from '${po.status}' to '${newStatus}'`
        );
      }
    }

    const effectiveRole = currentUser.activeRole || currentUser.role;

    // Only Purchase Department and Admin can formally issue PO to vendor
    if (newStatus === 'Issued') {
      if (![ROLES.PURCHASE, ROLES.ADMIN].includes(effectiveRole) && currentUser.role !== ROLES.ADMIN) {
        throw ApiError.forbidden('Only Purchase Department and Admin can issue Purchase Orders to vendors');
      }
    }

    const verifiedById = newStatus === 'Site Verified' ? currentUser.id : null;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await PurchaseOrderModel.updateStatus(
        id, 
        newStatus, 
        invoice_no, 
        verifiedById, 
        connection,
        dispatch_date,
        expected_delivery_date,
        dispatch_notes
      );

      // If issuing PO to vendor, advance linked Requisition status to 'PO Issued'
      if (newStatus === 'Issued' && po.requisition_id) {
        const timestamp = new Date().toISOString();
        await connection.query(
          `UPDATE requisitions 
           SET status = 'PO Issued', 
               history = JSON_SET(COALESCE(history, '{}'), '$."PO Issued"', ?) 
           WHERE id = ?`,
          [timestamp, po.requisition_id]
        );
        if (po.rfq_id) {
          await connection.query(
            `UPDATE rfqs SET status = 'PO Issued' WHERE id = ?`,
            [po.rfq_id]
          );
        }
      }

      // If vendor marks Dispatched, advance linked Requisition status to 'Dispatched'
      if (newStatus === 'Dispatched' && po.requisition_id) {
        const timestamp = new Date().toISOString();
        await connection.query(
          `UPDATE requisitions 
           SET status = 'Dispatched', 
               history = JSON_SET(COALESCE(history, '{}'), '$."Dispatched"', ?) 
           WHERE id = ?`,
          [timestamp, po.requisition_id]
        );
      }

      // If site verified, advance linked Requisition status to 'Site Verified'
      if (newStatus === 'Site Verified' && po.requisition_id) {
        const timestamp = new Date().toISOString();
        await connection.query(
          `UPDATE requisitions 
           SET status = 'Site Verified', 
               history = JSON_SET(COALESCE(history, '{}'), '$."Site Verified"', ?) 
           WHERE id = ?`,
          [timestamp, po.requisition_id]
        );
      }

      // Audit Log
      const auditNote = newStatus === 'Issued'
        ? `Purchase Manager ${currentUser.name} issued PO ${po.po_no} to Vendor #${po.vendor_id} (${po.vendor_name || 'Vendor'})`
        : newStatus === 'Dispatched'
          ? `Vendor dispatched shipment for PO ${po.po_no}. Challan: ${invoice_no || 'N/A'}. Expected Delivery: ${expected_delivery_date || 'N/A'}. ${dispatch_notes ? `Notes: ${dispatch_notes}` : ''}`
          : (note ? `PO Status changed to ${newStatus}. Note: ${note}` : `PO Status changed to ${newStatus}`);

      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('PO', ?, ?, ?, ?, ?)`,
        [
          String(id),
          newStatus,
          currentUser.id,
          currentUser.name,
          auditNote
        ]
      );

      await connection.commit();

      return await PurchaseOrderModel.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Update Commercial Terms & Declaration (Purchase Manager role only)
   * Validates:
   * - Advance %: between 0 and 100
   * - Credit period: whole number >= 0
   * - Payment terms: non-empty text
   * - Auto-calculates advance amount based on order total
   * - Stores ISO date format without timezone shift
   * - Updates per order only without overwriting other fields
   * - Notifies the next role in workflow
   */
  async updateCommercialTerms(id, payload, currentUser) {
    // 1. Role validation: Only Purchase Manager role can add or edit
    const effectiveRole = currentUser.activeRole || currentUser.role;
    if (effectiveRole !== ROLES.PURCHASE && currentUser.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only the Purchase Manager role can add or edit commercial terms');
    }

    // 2. Fetch existing PO
    const po = await PurchaseOrderModel.findById(id);
    if (!po) {
      throw ApiError.notFound(`Purchase Order with ID ${id} not found`);
    }

    // 3. Validation
    const advance_pct = Number(payload.advance_pct);
    if (isNaN(advance_pct) || advance_pct < 0 || advance_pct > 100) {
      throw ApiError.badRequest('Advance payment percentage must be between 0 and 100');
    }

    const credit_days = Number(payload.credit_days);
    if (isNaN(credit_days) || !Number.isInteger(credit_days) || credit_days < 0) {
      throw ApiError.badRequest('Credit period must be a whole number greater than or equal to 0');
    }

    const payment_terms_text = (payload.payment_terms || '').trim();
    if (!payment_terms_text) {
      throw ApiError.badRequest('Payment terms and conditions must not be empty');
    }

    const DEFAULT_DECLARATION = 'We declare that this Purchase Order shows the actual price of the goods described and that all particulars are true and correct. Materials must be supplied per specified brands and certified delivery challan.';
    const declaration_text = (payload.declaration_text || '').trim() || DEFAULT_DECLARATION;

    // 4. Calculate extra charges and order total
    let newTotalAmount = Number(po.total_amount || 0);
    let updatedExtraCharges = po.extra_charges || {};

    if (payload.extra_charges !== undefined) {
      const extraCharges = payload.extra_charges || {};
      const delivery_charges = Number(extraCharges.delivery_charges || 0);
      const labour_charges = Number(extraCharges.labour_charges || 0);
      const other_charges = Number(extraCharges.other_charges || 0);
      const extra_gst_pct = Number(extraCharges.gst_pct || 0);
      const extra_subtotal = Math.round((delivery_charges + labour_charges + other_charges) * 100) / 100;
      const extra_gst = Math.round((extra_subtotal * (extra_gst_pct / 100)) * 100) / 100;
      const total_extra = Math.round((extra_subtotal + extra_gst) * 100) / 100;

      const materialsSubtotal = Number(po.subtotal || 0);
      const materialsCgst = Number(po.cgst || 0);
      const materialsSgst = Number(po.sgst || 0);
      const materialsTotal = Math.round((materialsSubtotal + materialsCgst + materialsSgst) * 100) / 100;

      newTotalAmount = Math.round((materialsTotal + total_extra) * 100) / 100;

      updatedExtraCharges = {
        delivery_charges,
        labour_charges,
        other_charges,
        gst_pct: extra_gst_pct,
        gst_amount: extra_gst,
        total_extra,
        notes: extraCharges.notes || ''
      };
    }

    // Auto-calculate advance amount from updated order total
    const advance_amount = Math.round((newTotalAmount * (advance_pct / 100)) * 100) / 100;

    // 5. Generate ISO date string without timezone shift (local ISO timestamp)
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const localIsoTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // 6. Build updated payment_terms JSON preserving any existing metadata
    const existingTerms = typeof po.payment_terms === 'object' && po.payment_terms !== null ? po.payment_terms : {};
    const updatedPaymentTerms = {
      ...existingTerms,
      advance_pct,
      advance_amount,
      credit_days,
      notes: payment_terms_text,
      payment_terms: payment_terms_text,
      terms_and_conditions: payment_terms_text
    };

    // 7. Update database record for this order ONLY (preserves all other order fields)
    await PurchaseOrderModel.updateCommercialTerms(id, {
      payment_terms: updatedPaymentTerms,
      declaration_text,
      terms_updated_by_id: currentUser.id,
      terms_updated_by_name: currentUser.name,
      terms_updated_at: localIsoTimestamp,
      extra_charges: updatedExtraCharges,
      total_amount: newTotalAmount
    });

    // 8. Audit Log
    try {
      await pool.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('PO', ?, 'Commercial Terms Updated', ?, ?, ?)`,
        [
          String(id),
          currentUser.id,
          currentUser.name,
          `Commercial terms updated for PO ${po.po_no}: Advance ${advance_pct}% (₹${advance_amount}), Credit ${credit_days} days by Purchase Manager ${currentUser.name}`
        ]
      );
    } catch (auditErr) {
      console.warn('[PurchaseOrderService] Audit log warning:', auditErr.message);
    }

    // 9. Notify next role in the workflow (Vendor & Accounts)
    try {
      if (notificationDispatcher && typeof notificationDispatcher.notify === 'function') {
        const nextRecipients = [];
        if (po.vendor_id) nextRecipients.push({ vendor_id: po.vendor_id });
        nextRecipients.push(ROLES.DIRECTOR, ROLES.ACCOUNTS);

        await notificationDispatcher.notify('PO_TERMS_SAVED', nextRecipients, {
          po_no: po.po_no,
          vendor_name: po.vendor_name,
          advance_pct,
          advance_amount,
          credit_days,
          total_amount: po.total_amount,
          updated_by: currentUser.name,
          site_name: po.site_name,
          link: `/orders/${id}`
        });
      }
    } catch (notifErr) {
      console.warn('[PurchaseOrderService] Notification dispatch warning:', notifErr.message);
    }

    // 10. Return fresh updated order details immediately
    return await PurchaseOrderModel.findById(id);
  },

  /**
   * Public: Fetch PO details for Vendor Delivery Dispatch Link
   */
  async getPublicDeliveryDetails(poId, vendorId = null, sig = null) {
    const po = await PurchaseOrderModel.findById(poId);
    if (!po) throw ApiError.notFound('Purchase Order not found or link has expired');

    // Signature is mandatory: reject missing / invalid / tampered links with 403
    assertValidPoLink(po, vendorId, sig);
    const isVerified = true;

    // Extract safe items (quantity and specs without sensitive internal margins)
    const safeItems = (po.items || []).map(it => ({
      description: it.description,
      spec: it.spec || '',
      unit: it.unit || 'Nos',
      qty: Number(it.qty !== undefined ? it.qty : (it.quantity || 0))
    }));

    return {
      id: po.id,
      po_no: po.po_no,
      pr_no: po.pr_no,
      status: po.status,
      vendor_id: po.vendor_id,
      vendor_name: po.vendor_name,
      vendor_phone: po.vendor_phone,
      site_name: po.site_name,
      site_code: po.site_code,
      site_address: po.site_address,
      expected_delivery_date: po.expected_delivery_date,
      dispatch_date: po.dispatch_date,
      invoice_no: po.invoice_no,
      dispatch_notes: po.dispatch_notes,
      items: safeItems,
      is_dispatched: ['Dispatched', 'Site Verified', 'Partially Received', 'Received'].includes(po.status),
      is_verified_link: isVerified,
      created_at: po.created_at
    };
  },

  /**
   * Public: Vendor submits expected delivery date and dispatch details
   */
  async submitPublicDeliverySchedule(poId, payload) {
    const { 
      vendor_id, 
      sig, 
      expected_delivery_date, 
      delivery_status = 'Scheduled', // 'Scheduled' | 'Dispatched'
      challan_no, 
      dispatch_date, 
      vehicle_no, 
      transport_name, 
      driver_contact, 
      remarks 
    } = payload;

    const po = await PurchaseOrderModel.findById(poId);
    if (!po) throw ApiError.notFound('Purchase Order not found');

    // Signature is mandatory: reject missing / invalid / tampered links with 403 before any validation or write
    assertValidPoLink(po, vendor_id, sig);

    if (!expected_delivery_date) {
      throw ApiError.badRequest('Expected Delivery Date is mandatory');
    }

    const isDispatched = delivery_status === 'Dispatched' || Boolean(challan_no && challan_no.trim());
    const newPoStatus = isDispatched ? 'Dispatched' : (po.status === 'Approved' ? 'Acknowledged' : po.status);
    const effectiveDispatchDate = dispatch_date || (isDispatched ? new Date().toISOString().split('T')[0] : null);
    const invoiceNo = challan_no ? challan_no.trim() : (po.invoice_no || null);

    const notesParts = [];
    if (vehicle_no && vehicle_no.trim()) notesParts.push(`Vehicle: ${vehicle_no.trim()}`);
    if (transport_name && transport_name.trim()) notesParts.push(`Transport: ${transport_name.trim()}`);
    if (driver_contact && driver_contact.trim()) notesParts.push(`Driver: ${driver_contact.trim()}`);
    if (remarks && remarks.trim()) notesParts.push(remarks.trim());
    const combinedNotes = notesParts.length > 0 ? notesParts.join(' | ') : (po.dispatch_notes || null);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await PurchaseOrderModel.updateStatus(
        poId,
        newPoStatus,
        invoiceNo,
        null,
        connection,
        effectiveDispatchDate,
        expected_delivery_date,
        combinedNotes
      );

      // If dispatched, update linked Requisition & RFQ
      if (isDispatched && po.requisition_id) {
        await connection.query(
          `UPDATE requisitions 
           SET status = 'Dispatched',
               dispatch_date = ?,
               vehicle_no = ?,
               transport_name = ?,
               challan_no = ?,
               dispatch_remarks = ?,
               history = JSON_SET(COALESCE(history, '{}'), '$."Dispatched"', ?)
           WHERE id = ?`,
          [
            effectiveDispatchDate,
            vehicle_no || null,
            transport_name || null,
            invoiceNo,
            combinedNotes,
            new Date().toISOString(),
            po.requisition_id
          ]
        );

        if (po.rfq_id) {
          await connection.query(
            `UPDATE rfqs SET status = 'Dispatched' WHERE requisition_id = ? OR id = ?`,
            [po.requisition_id, po.rfq_id]
          );
        }
      }

      // Audit Log
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('PO', ?, ?, NULL, ?, ?)`,
        [
          String(poId),
          isDispatched ? 'Dispatched' : 'Delivery Scheduled',
          `${po.vendor_name} (Vendor Link)`,
          `Vendor scheduled delivery for ${expected_delivery_date}${invoiceNo ? ' under Challan #' + invoiceNo : ''}`
        ]
      );

      await connection.commit();

      // Notify Purchase Manager & Site Supervisor
      try {
        if (notificationDispatcher && typeof notificationDispatcher.notify === 'function') {
          const notifEvent = isDispatched ? 'MATERIAL_DISPATCHED' : 'DELIVERY_SCHEDULED';
          await notificationDispatcher.notify(notifEvent, [ROLES.PURCHASE, ROLES.SUPERVISOR, ROLES.PC], {
            po_no: po.po_no,
            vendor_name: po.vendor_name,
            site_name: po.site_name,
            expected_delivery_date,
            challan_no: invoiceNo,
            vehicle_no,
            link: `/orders/${poId}`
          });
        }
      } catch (err) {
        console.warn('[submitPublicDeliverySchedule] Notification error:', err.message);
      }

      // Public endpoint: return a minimal receipt only (never prices, totals or vendor contact data)
      const updated = await PurchaseOrderModel.findById(poId);
      return {
        id: updated.id,
        po_no: updated.po_no,
        status: updated.status,
        expected_delivery_date: updated.expected_delivery_date,
        dispatch_date: updated.dispatch_date,
        invoice_no: updated.invoice_no
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
};

