import pool from '../config/db.js';
import { RequisitionModel } from '../modules/requisitions/requisition.model.js';
import { RfqModel } from '../modules/rfqs/rfq.model.js';

async function seedData() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // ==========================================
    // 1. SEED PAYMENTS FOR ISSUE 3
    // ==========================================
    // Clear existing payments if any
    await connection.query('DELETE FROM payments');

    await connection.query(
      `INSERT INTO payments (po_id, vendor_id, amount, payment_date, mode, reference_no, note, recorded_by_id)
       VALUES 
       (12, 4, 32096.00, '2026-10-04', 'RTGS', 'HDFC000192837465', 'Advance 40% against PO DDPL/PO/26-27/001', 1),
       (12, 4, 48144.00, '2026-10-05', 'NEFT', 'ICIC000847291048', 'Balance 60% settlement after site delivery verification', 1),
       (13, 4, 21240.00, '2026-10-05', 'RTGS', 'SBIN000573829104', '100% full invoice payment against challan delivery', 1)`
    );
    console.log('Seeded 3 Payments successfully');

    // ==========================================
    // 2. SEED RFQs & REQUISITIONS FOR ISSUE 2
    // ==========================================
    // RFQ 16 -> set to 'Closed' (PO 12 is already Site Verified)
    await connection.query("UPDATE rfqs SET status = 'Closed' WHERE id = 16");

    // Check if PR-26-27-0005 exists
    const [existingPr5] = await connection.query("SELECT id FROM requisitions WHERE pr_no = 'PR-26-27-0005'");
    let pr5Id;
    if (existingPr5.length === 0) {
      const [newPr5] = await connection.query(
        `INSERT INTO requisitions (pr_no, site_id, requested_by_id, category, status, required_by_date, remarks, history)
         VALUES ('PR-26-27-0005', 38, 2, 'Civil / Structural', 'Sent to Purchase', DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'Reinforcement material for store extension', ?)` ,
        [JSON.stringify({ Raised: new Date().toISOString(), 'Sent to Purchase': new Date().toISOString() })]
      );
      pr5Id = newPr5.insertId;
      await connection.query(
        `INSERT INTO requisition_items (requisition_id, material_id, description, spec, unit, quantity, est_rate)
         VALUES (?, 10, 'OPC 53 Grade Cement, 50 Kg Bag', 'IS 12269 certified', 'Bag', 120, 390.00)`,
        [pr5Id]
      );
    } else {
      pr5Id = existingPr5[0].id;
    }

    // Check if RFQ-26-27-0004 (RFQ Sent) exists
    const [existingRfq4] = await connection.query("SELECT id FROM rfqs WHERE rfq_no = 'RFQ-26-27-0004'");
    if (existingRfq4.length === 0) {
      const [newRfq4] = await connection.query(
        `INSERT INTO rfqs (rfq_no, requisition_id, site_id, deadline, status, created_at, created_by_id, created_by_name, created_by_role)
         VALUES ('RFQ-26-27-0004', ?, 38, DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'RFQ Sent', NOW(), 1, 'DDPL Administrator', 'purchase')`,
        [pr5Id]
      );
      const rfq4Id = newRfq4.insertId;
      await connection.query(
        `INSERT INTO rfq_bids (rfq_id, vendor_id, status, items)
         VALUES (?, 4, 'Pending Quote', '[]'),
                (?, 6, 'Pending Quote', '[]')`,
        [rfq4Id, rfq4Id]
      );
      console.log('Created RFQ-26-27-0004 (RFQ Sent)');
    }

    // Check if PR-26-27-0006 exists
    const [existingPr6] = await connection.query("SELECT id FROM requisitions WHERE pr_no = 'PR-26-27-0006'");
    let pr6Id;
    if (existingPr6.length === 0) {
      const [newPr6] = await connection.query(
        `INSERT INTO requisitions (pr_no, site_id, requested_by_id, category, status, required_by_date, remarks, history)
         VALUES ('PR-26-27-0006', 2, 2, 'Electrical', 'Director Approved', DATE_ADD(CURDATE(), INTERVAL 4 DAY), 'Lighting fixtures for 2nd floor lab', ?)` ,
        [JSON.stringify({ Raised: new Date().toISOString(), 'Sent to Purchase': new Date().toISOString(), 'Shortlisted': new Date().toISOString(), 'Director Approved': new Date().toISOString() })]
      );
      pr6Id = newPr6.insertId;
      await connection.query(
        `INSERT INTO requisition_items (requisition_id, description, spec, unit, quantity, est_rate)
         VALUES (?, 'LED Panel Lights 36W', 'Square 2x2 Recessed 6500K Philips', 'Nos', 40, 1450.00)`,
        [pr6Id]
      );
    } else {
      pr6Id = existingPr6[0].id;
    }

    // Check if RFQ-26-27-0005 (Under_Review) exists
    const [existingRfq5] = await connection.query("SELECT id FROM rfqs WHERE rfq_no = 'RFQ-26-27-0005'");
    if (existingRfq5.length === 0) {
      const [newRfq5] = await connection.query(
        `INSERT INTO rfqs (rfq_no, requisition_id, site_id, deadline, status, created_at, created_by_id, created_by_name, created_by_role, shortlisted_vendors, shortlist_reason)
         VALUES ('RFQ-26-27-0005', ?, 2, DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'Under_Review', NOW(), 1, 'DDPL Administrator', 'purchase', '[4,6]', 'L1 competitive pricing for lighting fixtures')`,
        [pr6Id]
      );
      const rfq5Id = newRfq5.insertId;
      const bidItems1 = JSON.stringify([
        { id: 1, description: 'LED Panel Lights 36W', spec: 'Philips 36W', unit: 'Nos', qty: 40, rate: 1400, availability: 'Available' }
      ]);
      const bidItems2 = JSON.stringify([
        { id: 1, description: 'LED Panel Lights 36W', spec: 'Wipro 36W', unit: 'Nos', qty: 40, rate: 1550, availability: 'Available' }
      ]);
      await connection.query(
        `INSERT INTO rfq_bids (rfq_id, vendor_id, status, items)
         VALUES (?, 4, 'Submitted', ?),
                (?, 6, 'Submitted', ?)`,
        [rfq5Id, bidItems1, rfq5Id, bidItems2]
      );
      console.log('Created RFQ-26-27-0005 (Under_Review)');
    }

    await connection.commit();
    console.log('All sample data seeded successfully!');
  } catch (err) {
    await connection.rollback();
    console.error('Error seeding data:', err);
    throw err;
  } finally {
    connection.release();
    pool.end();
  }
}

seedData();
