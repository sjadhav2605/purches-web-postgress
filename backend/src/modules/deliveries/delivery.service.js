import pool from '../../config/db.js';
import { DeliveryModel } from './delivery.model.js';
import { ApiError } from '../../utils/apiError.js';
import { persistDataUrlList } from '../../utils/storageService.js';
import { scopeFor, assertPoVisible, DELIVERY_COLS } from '../../utils/dataScope.js';

export const DeliveryService = {
  async getAllDeliveries(currentUser) {
    const scope = scopeFor(currentUser, DELIVERY_COLS);
    const rows = await DeliveryModel.findAll({ scope });
    return rows;
  },

  async recordDelivery(payload, currentUser) {
    // Verify Receipt: caller must be allowed to see this PO (e.g. a supervisor only for their own site).
    // A delivery always belongs to the PO's site, so a client-supplied site_id cannot be used to escape scoping.
    const visiblePo = await assertPoVisible(payload.po_id, currentUser);
    payload = { ...payload, site_id: visiblePo.site_id };

    // Upload challan / material / damage photos to storage before opening the DB transaction
    payload = {
      ...payload,
      challan_photos: await persistDataUrlList(payload.challan_photos, 'delivery_photos', 'challan'),
      material_photos: await persistDataUrlList(payload.material_photos, 'delivery_photos', 'material'),
      damage_photos: await persistDataUrlList(payload.damage_photos, 'delivery_photos', 'damage')
    };

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Find requisition_id and vendor details linked to po_id
      const [poRows] = await connection.query(
        `SELECT po.id, po.po_no, po.requisition_id, po.vendor_id, v.name AS vendor_name, v.phone AS vendor_phone, v.email AS vendor_email, s.name AS site_name, s.code AS site_code
         FROM purchase_orders po
         JOIN vendors v ON po.vendor_id = v.id
         JOIN sites s ON po.site_id = s.id
         WHERE po.id = ?`,
        [payload.po_id]
      );
      const poInfo = poRows[0] || {};
      const requisitionId = payload.requisition_id || poInfo.requisition_id || null;

      const totalReceivedQty = (payload.received_items || []).reduce((acc, it) => acc + (Number(it.received_qty) || 0), 0);
      const totalDamagedQty = (payload.received_items || []).reduce((acc, it) => acc + (Number(it.damaged_qty) || 0), 0);

      const deliveryId = await DeliveryModel.create({
        ...payload,
        requisition_id: requisitionId,
        recorded_by_id: currentUser.id
      }, connection);

      // Update PO status to Site Verified
      await connection.query(
        `UPDATE purchase_orders 
         SET status = 'Site Verified', 
             verified_by_id = ?, 
             invoice_no = COALESCE(?, invoice_no) 
         WHERE id = ?`,
        [currentUser.id, payload.challan_no, payload.po_id]
      );

      // Also update linked Requisition status to Site Verified
      if (requisitionId) {
        const [reqRows] = await connection.query('SELECT history FROM requisitions WHERE id = ?', [requisitionId]);
        let historyObj = {};
        if (reqRows[0]?.history) {
          try {
            historyObj = typeof reqRows[0].history === 'string' ? JSON.parse(reqRows[0].history) : reqRows[0].history;
          } catch (e) { historyObj = {}; }
        }
        historyObj['Site Verified'] = new Date().toISOString();

        await connection.query(
          `UPDATE requisitions 
           SET status = 'Site Verified',
               challan_no = COALESCE(?, challan_no),
               history = ?
           WHERE id = ?`,
          [payload.challan_no, JSON.stringify(historyObj), requisitionId]
        );

        // Record in delivery_receipts table
        const proofFile = (payload.challan_photos && payload.challan_photos[0]?.dataUrl) 
          || (payload.material_photos && payload.material_photos[0]?.dataUrl) 
          || (payload.damage_photos && payload.damage_photos[0]?.dataUrl) || null;

        await connection.query(
          `INSERT INTO delivery_receipts (delivery_id, requisition_id, po_id, received_by, received_by_id, received_qty, proof_file, remark, received_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deliveryId,
            requisitionId,
            payload.po_id,
            currentUser.name,
            currentUser.id,
            Number(totalReceivedQty) || 0,
            proofFile,
            payload.remarks || (totalDamagedQty > 0 ? `Physical delivery received with ${totalDamagedQty} damaged items` : 'Materials received in good condition'),
            new Date().toISOString()
          ]
        );
      }

      // Audit Log
      await connection.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_name, note)
         VALUES ('Delivery', ?, 'Site Verified', ?, ?, ?)`,
        [
          String(deliveryId),
          currentUser.id,
          currentUser.name,
          `Delivery verified for PO #${payload.po_id} under Challan ${payload.challan_no || 'N/A'}. Total Received: ${totalReceivedQty}, Damaged: ${totalDamagedQty}`
        ]
      );

      await connection.commit();

      return {
        id: deliveryId,
        message: 'Delivery recorded and PO verified successfully',
        vendor: {
          name: poInfo.vendor_name,
          phone: poInfo.vendor_phone,
          email: poInfo.vendor_email
        },
        po_no: poInfo.po_no,
        site_name: poInfo.site_name,
        site_code: poInfo.site_code,
        total_damaged: totalDamagedQty,
        total_received: totalReceivedQty,
        damage_remarks: payload.damage_remarks || ''
      };
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }
};
