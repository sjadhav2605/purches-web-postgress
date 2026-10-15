import pool from '../config/db.js';

const targetIds = [24, 25, 27, 31, 32, 33];

async function deleteRequisitions() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log(`Starting cleanup for Requisition IDs: ${targetIds.join(', ')}...`);

    // 1. Temporarily disable foreign key checks so cascading delete works cleanly
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // 2. Find linked RFQs and POs
    const [rfqs] = await connection.query(
      'SELECT id FROM rfqs WHERE requisition_id IN (?)',
      [targetIds]
    );
    const rfqIds = rfqs.map(r => r.id);

    const [pos] = await connection.query(
      'SELECT id FROM purchase_orders WHERE requisition_id IN (?)',
      [targetIds]
    );
    const poIds = pos.map(p => p.id);

    // 3. Delete payments and deliveries linked to POs
    if (poIds.length > 0) {
      await connection.query('DELETE FROM payments WHERE po_id IN (?)', [poIds]);
      await connection.query('DELETE FROM deliveries WHERE po_id IN (?)', [poIds]);
      await connection.query('DELETE FROM purchase_orders WHERE id IN (?)', [poIds]);
      console.log(`Deleted linked POs (${poIds.length}), deliveries, and payments`);
    }

    // 4. Delete bids and revisions linked to RFQs
    if (rfqIds.length > 0) {
      const [revs] = await connection.query(
        'SELECT id FROM bid_revisions WHERE rfq_id IN (?)',
        [rfqIds]
      );
      const revIds = revs.map(r => r.id);
      if (revIds.length > 0) {
        await connection.query('DELETE FROM bid_revision_items WHERE revision_id IN (?)', [revIds]);
        await connection.query('DELETE FROM bid_revisions WHERE id IN (?)', [revIds]);
      }
      await connection.query('DELETE FROM rfq_bids WHERE rfq_id IN (?)', [rfqIds]);
      await connection.query('DELETE FROM rfqs WHERE id IN (?)', [rfqIds]);
      console.log(`Deleted linked RFQs (${rfqIds.length}), bids, and revisions`);
    }

    // 5. Delete requisition items and edits
    await connection.query('DELETE FROM requisition_items WHERE requisition_id IN (?)', [targetIds]);
    try {
      await connection.query('DELETE FROM requisition_edits WHERE requisition_id IN (?)', [targetIds]);
    } catch (e) {
      // table might not exist in some versions
    }

    // 6. Delete the requisitions themselves
    const [delRes] = await connection.query(
      'DELETE FROM requisitions WHERE id IN (?)',
      [targetIds]
    );
    console.log(`Successfully deleted ${delRes.affectedRows} requisitions: ${targetIds.join(', ')}`);

    // 7. Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    await connection.commit();
    console.log('✅ All requested records deleted successfully!');
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.rollback();
    console.error('❌ Failed to delete records:', error.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

deleteRequisitions();
