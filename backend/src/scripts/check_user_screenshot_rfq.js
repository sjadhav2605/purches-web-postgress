import pool from '../config/db.js';

async function check() {
  const [items] = await pool.query("SELECT * FROM requisition_items WHERE description ILIKE '%AAC%'");
  console.log('Requisition items:', items);
  for (const it of items) {
    const [reqs] = await pool.query('SELECT * FROM requisitions WHERE id = ?', [it.requisition_id]);
    console.log('Requisition:', reqs[0]?.pr_no, 'Dispatch Date:', reqs[0]?.dispatch_date, 'Challan:', reqs[0]?.challan_no, 'Bill:', reqs[0]?.bill_no, 'Expected Date:', reqs[0]?.expected_delivery_date);
    const [rfqs] = await pool.query('SELECT * FROM rfqs WHERE requisition_id = ?', [it.requisition_id]);
    console.log('RFQs for PR:', rfqs.map(r => ({ id: r.id, rfq_no: r.rfq_no, challan_no: r.challan_no, bill_no: r.bill_no, dispatch_date: r.dispatch_date, expected_delivery_date: r.expected_delivery_date, reopened: r.dispatch_link_reopened })));
  }
  process.exit(0);
}

check();
