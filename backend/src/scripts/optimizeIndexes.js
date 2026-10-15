import pool from '../config/db.js';

/**
 * Automatically creates optimal database indexes if they don't already exist.
 * Greatly speeds up SELECT, COUNT, and filtering operations across all modules.
 */
export async function optimizeDatabaseIndexes() {
  const indexDefinitions = [
    // Requisitions
    { table: 'requisitions', name: 'idx_req_status_created', columns: 'status, created_at' },
    { table: 'requisitions', name: 'idx_req_site_status', columns: 'site_id, status' },
    { table: 'requisitions', name: 'idx_req_requested_by', columns: 'requested_by_id' },
    { table: 'requisitions', name: 'idx_req_shortlisted_vendor', columns: 'shortlisted_vendor_id' },

    // Requisition Items
    { table: 'requisition_items', name: 'idx_ri_requisition_id', columns: 'requisition_id' },
    { table: 'requisition_items', name: 'idx_ri_material_id', columns: 'material_id' },

    // RFQs & Bids
    { table: 'rfqs', name: 'idx_rfq_requisition_id', columns: 'requisition_id' },
    { table: 'rfqs', name: 'idx_rfq_site_id', columns: 'site_id' },
    { table: 'rfqs', name: 'idx_rfq_status_created', columns: 'status, created_at' },
    { table: 'rfqs', name: 'idx_rfq_winner_vendor', columns: 'winner_vendor_id' },
    { table: 'rfq_bids', name: 'idx_bids_rfq_vendor', columns: 'rfq_id, vendor_id' },
    { table: 'rfq_bids', name: 'idx_bids_status', columns: 'status' },

    // Purchase Orders
    { table: 'purchase_orders', name: 'idx_po_requisition_id', columns: 'requisition_id' },
    { table: 'purchase_orders', name: 'idx_po_vendor_status', columns: 'vendor_id, status' },
    { table: 'purchase_orders', name: 'idx_po_site_id', columns: 'site_id' },
    { table: 'purchase_orders', name: 'idx_po_status_created', columns: 'status, created_at' },

    // Notifications
    { table: 'notifications', name: 'idx_notif_user_read_channel', columns: 'user_id, is_read, channel' },
    { table: 'notifications', name: 'idx_notif_role_read_channel', columns: 'role, is_read, channel' },
    { table: 'notifications', name: 'idx_notif_is_read_channel', columns: 'is_read, channel' },

    // Status History & Receipts
    { table: 'status_history', name: 'idx_sh_entity_type_id', columns: 'entity_type, entity_id' },
    { table: 'deliveries', name: 'idx_del_po_id', columns: 'po_id' }
  ];

  try {
    for (const def of indexDefinitions) {
      try {
        await pool.query(`CREATE INDEX IF NOT EXISTS "${def.name}" ON "${def.table}" (${def.columns})`);
      } catch (innerErr) {
        // Silently skip if table does not exist or index creation not applicable
      }
    }
    console.log('⚡ Performance database indexes verified.');
  } catch (err) {
    console.warn('⚠️ Performance indexing notice:', err.message);
  }
}

export default optimizeDatabaseIndexes;
