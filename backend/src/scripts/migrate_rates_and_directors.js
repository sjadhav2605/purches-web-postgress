import db from '../config/db.js';

async function migrate() {
  try {
    console.log('--- Starting Migration ---');

    // 1. Add columns to requisitions
    const [reqCols] = await db.query('DESCRIBE requisitions');
    const reqColNames = reqCols.map(c => c.Field);

    if (!reqColNames.includes('target_director_id')) {
      console.log('Adding target_director_id to requisitions...');
      await db.query('ALTER TABLE requisitions ADD COLUMN target_director_id INT NULL AFTER shortlisted_vendor_id');
    }
    if (!reqColNames.includes('target_director_name')) {
      console.log('Adding target_director_name to requisitions...');
      await db.query('ALTER TABLE requisitions ADD COLUMN target_director_name VARCHAR(100) NULL AFTER target_director_id');
    }

    // 2. Add columns to requisition_items
    const [itemCols] = await db.query('DESCRIBE requisition_items');
    const itemColNames = itemCols.map(c => c.Field);

    if (!itemColNames.includes('approved_rate')) {
      console.log('Adding approved_rate to requisition_items...');
      await db.query('ALTER TABLE requisition_items ADD COLUMN approved_rate DECIMAL(15,2) NULL AFTER est_rate');
    }

    // 3. Sync target_director_id from rfqs to requisitions where available
    await db.query(`
      UPDATE requisitions r
      JOIN rfqs rfq ON r.id = rfq.requisition_id
      SET r.target_director_id = rfq.target_director_id,
          r.target_director_name = rfq.target_director_name
      WHERE rfq.target_director_id IS NOT NULL AND r.target_director_id IS NULL
    `);

    // 4. Set PR 52 (PR-26-27-0016) and RFQ 40 to Director 1 (id: 5)
    await db.query(`
      UPDATE rfqs 
      SET target_director_id = 5, target_director_name = 'Director 1'
      WHERE id = 40 OR requisition_id = 52
    `);
    await db.query(`
      UPDATE requisitions 
      SET target_director_id = 5, target_director_name = 'Director 1'
      WHERE id = 52
    `);
    await db.query(`
      UPDATE requisition_items
      SET approved_rate = 950.00, est_rate = 950.00
      WHERE requisition_id = 52
    `);

    // 5. Backfill any other approved requisition items from linked POs
    const [pos] = await db.query(`SELECT id, po_no, requisition_id, items FROM purchase_orders WHERE requisition_id IS NOT NULL`);
    for (const po of pos) {
      if (!po.items) continue;
      let poItems = [];
      try {
        poItems = typeof po.items === 'string' ? JSON.parse(po.items) : po.items;
      } catch (e) {
        continue;
      }
      for (const pi of poItems) {
        if (!pi.rate || Number(pi.rate) <= 0) continue;
        await db.query(`
          UPDATE requisition_items
          SET approved_rate = ?,
              est_rate = CASE WHEN est_rate IS NULL OR est_rate = 0 THEN ? ELSE est_rate END
          WHERE requisition_id = ? AND (description = ? OR (SELECT COUNT(*) FROM requisition_items WHERE requisition_id = ?) = 1)
        `, [pi.rate, pi.rate, po.requisition_id, pi.description, po.requisition_id]);
      }
    }

    // 6. For PRs approved by director (approved_by IS NOT NULL), ensure target_director_id is set
    await db.query(`
      UPDATE requisitions r
      JOIN users u ON (r.approved_by_id = u.id OR r.approved_by = u.name) AND u.role = 'director'
      SET r.target_director_id = u.id,
          r.target_director_name = u.name
      WHERE r.target_director_id IS NULL
    `);

    console.log('✅ Migration completed successfully!');
    
    // Verify PR 52
    const [verifyReq] = await db.query('SELECT id, pr_no, status, target_director_id, target_director_name FROM requisitions WHERE id = 52');
    console.log('PR 52:', verifyReq[0]);
    const [verifyItems] = await db.query('SELECT id, description, quantity, est_rate, approved_rate FROM requisition_items WHERE requisition_id = 52');
    console.log('PR 52 Items:', verifyItems);

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
