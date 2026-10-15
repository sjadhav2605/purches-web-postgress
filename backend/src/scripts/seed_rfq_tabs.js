import pool from '../config/db.js';
import { RfqModel } from '../modules/rfqs/rfq.model.js';

async function seedRfqTabs() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Mark RFQ 16 as Closed (it was already fulfilled and Site Verified)
    await connection.query("UPDATE rfqs SET status = 'Closed' WHERE id = 16");
    console.log('Updated RFQ 16 to Closed');

    // 2. Create RFQ Sent for PR 29 (Civil materials, open for bidding)
    const rfqNoSent = await RfqModel.generateNextRfqNumber(connection);
    const [rfqSentRes] = await connection.query(
      `INSERT INTO rfqs (rfq_no, requisition_id, site_id, deadline, status, created_at)
       VALUES (?, 29, 38, DATE_ADD(CURDATE(), INTERVAL 6 DAY), 'RFQ Sent', NOW())`,
      [rfqNoSent]
    );
    const rfqSentId = rfqSentRes.insertId;
    // Add 2 vendors invited, quotes pending
    await connection.query(
      `INSERT INTO rfq_bids (rfq_id, vendor_id, status, items)
       VALUES (?, 4, 'Pending Quote', '[]'),
              (?, 6, 'Pending Quote', '[]')`,
      [rfqSentId, rfqSentId]
    );
    console.log('Created RFQ Sent:', rfqNoSent, 'id:', rfqSentId);

    // 3. Create Under_Review RFQ for PR 27
    const rfqNoUnderReview = await RfqModel.generateNextRfqNumber(connection);
    const [rfqReviewRes] = await connection.query(
      `INSERT INTO rfqs (rfq_no, requisition_id, site_id, deadline, status, created_at)
       VALUES (?, 27, 43, DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'Under_Review', NOW())`,
      [rfqNoUnderReview]
    );
    const rfqReviewId = rfqReviewRes.insertId;
    const sampleBidItems = JSON.stringify([
      { id: 1, description: 'AAC Lightweight Blocks (600x200x100mm)', qty: 100, unit: 'Nos', rate: 2200, availability: 'Available' }
    ]);
    await connection.query(
      `INSERT INTO rfq_bids (rfq_id, vendor_id, status, items)
       VALUES (?, 4, 'Submitted', ?),
              (?, 6, 'Submitted', ?)`,
      [rfqReviewId, sampleBidItems, rfqReviewId, sampleBidItems]
    );
    console.log('Created Under Review RFQ:', rfqNoUnderReview, 'id:', rfqReviewId);

    await connection.commit();
    console.log('Successfully seeded RFQ tabs!');
  } catch (err) {
    await connection.rollback();
    console.error('Error seeding RFQs:', err);
    throw err;
  } finally {
    connection.release();
    pool.end();
  }
}

seedRfqTabs();
