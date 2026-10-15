import pool from '../config/db.js';
import { RequisitionModel } from '../modules/requisitions/requisition.model.js';

async function seedSampleRequisitions() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Pending Action PR - Raised by Site Supervisor Rajesh
    const prNo1 = await RequisitionModel.generateNextPrNumber(connection);
    const [r1] = await connection.query(
      `INSERT INTO requisitions (pr_no, site_id, requested_by_id, category, status, required_by_date, remarks, history)
       VALUES (?, 2, 2, 'Civil / Structural', 'Raised', DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'Urgent reinforcement material for 2nd floor column casting', ?)`,
      [prNo1, JSON.stringify({ Raised: new Date().toISOString() })]
    );
    const r1Id = r1.insertId;
    await connection.query(
      `INSERT INTO requisition_items (requisition_id, material_id, description, spec, unit, quantity, est_rate)
       VALUES (?, 10, 'OPC 53 Grade Cement, 50 Kg Bag', 'IS 12269 certified, UltraTech / Ambuja', 'Bag', 100, 390.00),
              (?, 14, 'TMT Steel Rebars Fe 550D - 12mm', 'Tata Tiscon / JSW Neosteel Fe550D', 'Kg', 500, 65.00)`,
      [r1Id, r1Id]
    );
    console.log('Created Pending PR 1:', prNo1, 'id:', r1Id);

    // 2. Sent to Purchase PR - Raised by Rajesh, approved by PC Amit (Pending Purchase Action)
    const prNo2 = await RequisitionModel.generateNextPrNumber(connection);
    const [r2] = await connection.query(
      `INSERT INTO requisitions (pr_no, site_id, requested_by_id, category, status, required_by_date, remarks, approved_by, approved_by_id, approved_at, history)
       VALUES (?, 38, 2, 'Civil / Structural', 'Sent to Purchase', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Masonry work for new partition walls', 'Project Coordinator Amit', 3, NOW(), ?)`,
      [prNo2, JSON.stringify({ Raised: new Date(Date.now() - 3600000 * 2).toISOString(), 'Sent to Purchase': new Date().toISOString() })]
    );
    const r2Id = r2.insertId;
    await connection.query(
      `INSERT INTO requisition_items (requisition_id, material_id, description, spec, unit, quantity, est_rate)
       VALUES (?, 11, 'PPC Portland Pozzolana Cement, 50 Kg Bag', 'IS 1489 certified', 'Bag', 150, 360.00)`,
      [r2Id]
    );
    console.log('Created Sent to Purchase PR 2:', prNo2, 'id:', r2Id);

    // 3. Dispatched PR - Ready for Site Supervisor Rajesh to Receive at Site!
    const prNo3 = await RequisitionModel.generateNextPrNumber(connection);
    const [r3] = await connection.query(
      `INSERT INTO requisitions (pr_no, site_id, requested_by_id, category, status, required_by_date, remarks, approved_by, approved_by_id, approved_at, shortlisted_vendor_id, dispatch_date, vehicle_no, transport_name, challan_no, dispatched_qty, dispatch_remarks, history)
       VALUES (?, 2, 2, 'Civil / Structural', 'Dispatched', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'Structural materials dispatched from plant', 'Director 1', 5, NOW(), 1, CURDATE(), 'MH-12-RN-8821', 'VRL Logistics', 'CH-2026-8841', 200, 'All bags loaded securely', ?)`,
      [prNo3, JSON.stringify({
        Raised: new Date(Date.now() - 86400000 * 2).toISOString(),
        'Sent to Purchase': new Date(Date.now() - 86400000).toISOString(),
        'Director Approved': new Date(Date.now() - 3600000 * 5).toISOString(),
        Dispatched: new Date().toISOString()
      })]
    );
    const r3Id = r3.insertId;
    await connection.query(
      `INSERT INTO requisition_items (requisition_id, material_id, description, spec, unit, quantity, est_rate)
       VALUES (?, 12, 'TMT Steel Rebars Fe 550D - 8mm', 'Tata Tiscon / JSW Neosteel Fe550D', 'Kg', 200, 68.00)`,
      [r3Id]
    );
    console.log('Created Dispatched PR 3:', prNo3, 'id:', r3Id);

    await connection.commit();
    console.log('Successfully seeded pending and dispatched PRs!');
  } catch (err) {
    await connection.rollback();
    console.error('Seed error:', err);
    throw err;
  } finally {
    connection.release();
    pool.end();
  }
}

seedSampleRequisitions();
