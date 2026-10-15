import pool from '../config/db.js';

async function seed() {
  await pool.query(`
    UPDATE purchase_orders 
    SET invoice_no = 'CH-2026-9812', 
        dispatch_date = '2026-10-03', 
        expected_delivery_date = '2026-10-05', 
        dispatch_notes = 'Vehicle: MH-12-AB-1234, Transporter: VRL Logistics, Driver: Ramesh (9822012345)' 
    WHERE id = 9
  `);

  // Also update linked requisition status to Dispatched
  await pool.query(`
    UPDATE requisitions 
    SET status = 'Dispatched' 
    WHERE id = (SELECT requisition_id FROM purchase_orders WHERE id = 9)
  `);

  console.log('PO 9 and linked Requisition updated to Dispatched with expected delivery date 2026-10-05!');
  process.exit(0);
}

seed();
