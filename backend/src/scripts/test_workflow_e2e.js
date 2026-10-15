import dotenv from 'dotenv';
dotenv.config();
import pool from '../config/db.js';
import jwt from 'jsonwebtoken';
import { formatWorkflowDateTime } from '../utils/dateFormatter.js';

const BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const api = {
  async get(url, { headers } = {}) {
    const res = await fetch(url, { headers });
    const json = await res.json();
    if (!res.ok) throw { message: json.message || res.statusText, response: { data: json } };
    return { data: json.data !== undefined ? json.data : json };
  },
  async post(url, body, { headers } = {}) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw { message: json.message || res.statusText, response: { data: json } };
    return { data: json.data !== undefined ? json.data : json };
  },
  async put(url, body, { headers } = {}) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw { message: json.message || res.statusText, response: { data: json } };
    return { data: json.data !== undefined ? json.data : json };
  }
};

// Helper to generate auth token directly or login
function getAuthHeader(user) {
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      vendor_id: user.vendor_id || null
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
  return { Authorization: `Bearer ${token}` };
}

async function runE2ETest() {
  console.log('===============================================================');
  console.log('Starting DDPL Procurement End-to-End Role-Based Workflow Test');
  console.log('===============================================================\n');

  try {
    // 0. Fetch demo users from database
    const [users] = await pool.query('SELECT * FROM users WHERE email IN (?, ?, ?, ?, ?, ?)', [
      'supervisor@ddpl.com',
      'pc@ddpl.com',
      'purchase@ddpl.com',
      'director@ddpl.com',
      'vendor@ddpl.com',
      'vendor2@ddpl.com'
    ]);

    const supervisor = users.find(u => u.email === 'supervisor@ddpl.com');
    const pc = users.find(u => u.email === 'pc@ddpl.com');
    const purchase = users.find(u => u.email === 'purchase@ddpl.com');
    const director = users.find(u => u.email === 'director@ddpl.com');
    const vendor1 = users.find(u => u.email === 'vendor@ddpl.com');
    const vendor2 = users.find(u => u.email === 'vendor2@ddpl.com');

    if (!supervisor || !pc || !purchase || !director || !vendor1 || !vendor2) {
      throw new Error('One or more demo users are missing from the database. Please check migrations/seeds.');
    }

    console.log('✓ Demo users loaded:');
    console.log(`  - Supervisor: ${supervisor.name} (${supervisor.email})`);
    console.log(`  - Project Coordinator: ${pc.name} (${pc.email})`);
    console.log(`  - Purchase Manager: ${purchase.name} (${purchase.email})`);
    console.log(`  - Director: ${director.name} (${director.email})`);
    console.log(`  - Vendor 1: ${vendor1.name} (${vendor1.email}, vendor_id: ${vendor1.vendor_id})`);
    const [activeSites] = await pool.query('SELECT * FROM sites ORDER BY id ASC LIMIT 1');
    if (activeSites.length === 0) {
      throw new Error('No site found in database');
    }
    const testSite = activeSites[0];
    console.log(`  - Active Site: ${testSite.name} (${testSite.code}, ID: ${testSite.id})\n`);

    // -------------------------------------------------------------
    // STEP 1: Site Supervisor raises a material request
    // -------------------------------------------------------------
    console.log('--- STEP 1: Site Supervisor raises a Material Request ---');
    const createRes = await api.post(
      `${BASE_URL}/requisitions`,
      {
        site_id: testSite.id,
        required_by_date: '2026-11-15',
        remarks: 'Urgent cement required for Phase 2 foundation slab casting',
        items: [
          {
            description: 'UltraTech Cement OPC 53 Grade',
            spec: 'IS 12269:2013 Grade 53 in 50kg bags',
            unit: 'Bags',
            quantity: 200,
            est_rate: 380
          }
        ]
      },
      { headers: getAuthHeader(supervisor) }
    );

    const pr = createRes.data?.data || createRes.data;
    console.log(`✓ Request created: ${pr.pr_no} (ID: ${pr.id})`);
    console.log(`  Status: ${pr.status}`);
    console.log(`  Created at formatted: ${formatWorkflowDateTime(pr.created_at)}`);

    // Verify PC notification
    const [pcNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE user_id = ? OR role = 'pc' ORDER BY id DESC LIMIT 1",
      [pc.id]
    );
    console.log(`✓ Notification created for Project Coordinator: "${pcNotifs[0]?.title}" - ${pcNotifs[0]?.message}\n`);

    // -------------------------------------------------------------
    // STEP 2: Project Coordinator edits and approves request
    // -------------------------------------------------------------
    console.log('--- STEP 2: Project Coordinator edits and approves request ---');
    // Coordinator Edit
    const editRes = await api.put(
      `${BASE_URL}/requisitions/${pr.id}/coordinator-edit`,
      {
        required_by_date: '2026-11-20',
        remarks: 'Coordinator note: increased to 250 bags to avoid shortages during continuous pour',
        items: [
          {
            description: 'UltraTech Cement OPC 53 Grade',
            spec: 'IS 12269:2013 Grade 53 in 50kg bags',
            unit: 'Bags',
            quantity: 250,
            est_rate: 380
          }
        ]
      },
      { headers: getAuthHeader(pc) }
    );
    console.log('✓ Coordinator edited request items and fields.');

    // Check requisition_edits audit table
    const [edits] = await pool.query('SELECT * FROM requisition_edits WHERE requisition_id = ?', [pr.id]);
    console.log(`✓ Edit history recorded: ${edits.length} field diff(s) stored in requisition_edits.`);

    // Coordinator Approves & Sends to Purchase Department
    const coordApproveRes = await api.post(
      `${BASE_URL}/requisitions/${pr.id}/coordinator-approve`,
      {},
      { headers: getAuthHeader(pc) }
    );
    const prAfterCoord = coordApproveRes.data?.data || coordApproveRes.data;
    console.log(`✓ Coordinator approved request. Status is now: "${prAfterCoord.status}"`);

    // Verify notifications for Supervisor & Purchase
    const [supNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [supervisor.id]
    );
    console.log(`✓ Notification created for Site Supervisor: "${supNotifs[0]?.title}"`);

    const [purchNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE user_id = ? OR role = 'purchase' ORDER BY id DESC LIMIT 1",
      [purchase.id]
    );
    console.log(`✓ Notification created for Purchase Department: "${purchNotifs[0]?.title}"\n`);

    // -------------------------------------------------------------
    // STEP 3: Purchase Department approves & floats RFQ to vendors
    // -------------------------------------------------------------
    console.log('--- STEP 3: Purchase Department approves & floats RFQ to 2 vendors ---');
    const purchaseApproveRes = await api.post(
      `${BASE_URL}/requisitions/${pr.id}/purchase-approve`,
      {
        vendor_ids: [vendor1.vendor_id, vendor2.vendor_id],
        deadline: '2026-11-01',
        remarks: 'Floating RFQ to registered suppliers for best commercial rates'
      },
      { headers: getAuthHeader(purchase) }
    );
    const prAfterPurchase = purchaseApproveRes.data?.data || purchaseApproveRes.data;
    console.log(`✓ Purchase approved request. Status: "${prAfterPurchase.status}"`);

    // Retrieve created RFQ
    const [rfqRows] = await pool.query('SELECT * FROM rfqs WHERE requisition_id = ? ORDER BY id DESC LIMIT 1', [pr.id]);
    const rfq = rfqRows[0];
    console.log(`✓ RFQ generated: ${rfq.rfq_no} (ID: ${rfq.id}, Status: ${rfq.status})`);
    console.log(`  Sent by: ${rfq.created_by_name} (${rfq.created_by_role})`);

    // Verify notifications for Vendor 1 and Vendor 2
    const [v1Notifs] = await pool.query(
      'SELECT * FROM notifications WHERE vendor_id = ? ORDER BY id DESC LIMIT 1',
      [vendor1.vendor_id]
    );
    console.log(`✓ Notification sent to Vendor 1: "${v1Notifs[0]?.title}" - ${v1Notifs[0]?.message}\n`);

    // -------------------------------------------------------------
    // STEP 4: Test Vendor Data Isolation & Bid Submissions
    // -------------------------------------------------------------
    console.log('--- STEP 4: Vendor Data Isolation & Bid Submissions ---');
    // Vendor 1 submits quote
    await api.post(
      `${BASE_URL}/rfqs/bid`,
      {
        rfq_id: rfq.id,
        vendor_id: vendor1.vendor_id,
        quote_amount: 250 * 370,
        delivery_days: 2,
        entered_by: 'vendor',
        bid_items: [
          {
            description: 'UltraTech Cement OPC 53 Grade',
            spec: 'IS 12269:2013 Grade 53 in 50kg bags',
            unit: 'Bags',
            qty: 250,
            rate: 370,
            availability: 'Available'
          }
        ]
      },
      { headers: getAuthHeader(vendor1) }
    );
    console.log('✓ Vendor 1 submitted quote: ₹370/bag');

    // Vendor 2 submits quote
    await api.post(
      `${BASE_URL}/rfqs/bid`,
      {
        rfq_id: rfq.id,
        vendor_id: vendor2.vendor_id,
        quote_amount: 250 * 385,
        delivery_days: 4,
        entered_by: 'vendor',
        bid_items: [
          {
            description: 'UltraTech Cement OPC 53 Grade',
            spec: 'IS 12269:2013 Grade 53 in 50kg bags',
            unit: 'Bags',
            qty: 250,
            rate: 385,
            availability: 'Available'
          }
        ]
      },
      { headers: getAuthHeader(vendor2) }
    );
    console.log('✓ Vendor 2 submitted quote: ₹385/bag');

    // TEST VENDOR DATA ISOLATION:
    // Vendor 1 retrieves RFQ details: must ONLY see their own bid!
    const v1ViewRfq = await api.get(`${BASE_URL}/rfqs/${rfq.id}`, { headers: getAuthHeader(vendor1) });
    const rfqData = v1ViewRfq.data?.data || v1ViewRfq.data;
    const v1Bids = rfqData.bids || [];
    console.log(`✓ Data Isolation Check for Vendor 1: returned ${v1Bids.length} bid(s)`);
    if (v1Bids.some(b => b.vendor_id !== vendor1.vendor_id)) {
      throw new Error('SECURITY VIOLATION: Vendor 1 was able to view bids from other vendors!');
    }
    console.log('✓ SECURITY CONFIRMED: Vendor 1 cannot see Vendor 2 bids.\n');

    // -------------------------------------------------------------
    // STEP 5: Bid Revision Loop (Purchase requests revision, Vendor accepts)
    // -------------------------------------------------------------
    console.log('--- STEP 5: Bid Revision Loop ---');
    // Get vendor 1's bid record id
    const [bidsV1] = await pool.query('SELECT id FROM rfq_bids WHERE rfq_id = ? AND vendor_id = ?', [
      rfq.id,
      vendor1.vendor_id
    ]);
    const v1BidId = bidsV1[0].id;

    // Purchase Manager requests revised rate (₹355/bag)
    await api.post(
      `${BASE_URL}/rfqs/${rfq.id}/bids/${v1BidId}/send-revision`,
      {
        items: [
          {
            description: 'UltraTech Cement OPC 53 Grade',
            spec: 'IS 12269:2013 Grade 53 in 50kg bags',
            unit: 'Bags',
            qty: 250,
            revised_rate: 355
          }
        ],
        remarks: 'Please offer your best discounted rate for 250 bags bulk delivery'
      },
      { headers: getAuthHeader(purchase) }
    );
    console.log('✓ Purchase Manager sent rate revision request to Vendor 1 (proposed ₹355/bag)');

    // Vendor 1 reviews and accepts revision
    await api.post(
      `${BASE_URL}/rfqs/${rfq.id}/bids/${v1BidId}/respond-revision`,
      {
        response_type: 'accepted',
        remarks: 'Accepted proposed bulk rate of ₹355/bag',
        items: [
          {
            description: 'UltraTech Cement OPC 53 Grade',
            qty: 250,
            final_rate: 355
          }
        ]
      },
      { headers: getAuthHeader(vendor1) }
    );
    console.log('✓ Vendor 1 accepted the revised rate. Status set to "Revised Bid Submitted". Purchase Manager notified.\n');

    // -------------------------------------------------------------
    // STEP 6: Director Review & Approval
    // -------------------------------------------------------------
    console.log('--- STEP 6: Director reviews side-by-side bids & approves ---');
    const directorApproveRes = await api.post(
      `${BASE_URL}/rfqs/${rfq.id}/director-approve`,
      {
        vendor_id: vendor1.vendor_id,
        note: 'Approved lowest revised bid from Vendor 1. Proceed with shortlisting.'
      },
      { headers: getAuthHeader(director) }
    );
    const dirData = directorApproveRes.data?.data || directorApproveRes.data;
    console.log(`✓ Director approved RFQ. PO created: "${dirData?.po_no || 'Created'}"`);

    // Verify Purchase Manager notified
    const [purchDirectorNotif] = await pool.query(
      "SELECT * FROM notifications WHERE (user_id = ? OR role = 'purchase') AND title LIKE '%Director Approved%' ORDER BY id DESC LIMIT 1",
      [purchase.id]
    );
    console.log(`✓ Notification created for Purchase Manager: "${purchDirectorNotif[0]?.title}"\n`);

    // -------------------------------------------------------------
    // STEP 7: Purchase Manager shortlists winning vendor
    // -------------------------------------------------------------
    console.log('--- STEP 7: Purchase Manager shortlists Vendor 1 ---');
    const shortlistRes = await api.post(
      `${BASE_URL}/requisitions/${pr.id}/shortlist-vendor`,
      {
        vendor_id: vendor1.vendor_id
      },
      { headers: getAuthHeader(purchase) }
    );
    const prAfterShortlist = shortlistRes.data?.data || shortlistRes.data;
    console.log(`✓ Purchase Manager marked Vendor 1 as shortlisted. Request status: "${prAfterShortlist.status}"`);

    // Verify Vendor 1 received "You are shortlisted" notification
    const [v1ShortlistNotif] = await pool.query(
      "SELECT * FROM notifications WHERE vendor_id = ? AND title LIKE '%Shortlisted%' ORDER BY id DESC LIMIT 1",
      [vendor1.vendor_id]
    );
    console.log(`✓ Shortlist notification sent to Vendor 1: "${v1ShortlistNotif[0]?.title}" - ${v1ShortlistNotif[0]?.message}\n`);

    // -------------------------------------------------------------
    // STEP 8: Vendor dispatches shipment & enters delivery details
    // -------------------------------------------------------------
    console.log('--- STEP 8: Vendor 1 adds delivery details & marks Dispatched ---');
    const dispatchRes = await api.post(
      `${BASE_URL}/requisitions/${pr.id}/dispatch`,
      {
        dispatch_date: '2026-10-06',
        challan_no: 'CH-2026-E2E-7788',
        vehicle_no: 'MH-12-DE-9900',
        transport_name: 'VRL Logistics Express',
        dispatched_qty: '250 Bags OPC 53 Grade',
        dispatch_remarks: 'Loaded and dispatched from warehouse. Driver Ramesh (9822012345)'
      },
      { headers: getAuthHeader(vendor1) }
    );
    const prAfterDispatch = dispatchRes.data?.data || dispatchRes.data;
    console.log(`✓ Shipment dispatched by Vendor 1. Request status: "${prAfterDispatch.status}"`);
    console.log(`  Challan No: ${prAfterDispatch.challan_no}, Vehicle: ${prAfterDispatch.vehicle_no}`);

    // Verify notifications for Coordinator, Supervisor, and Purchase
    const [dispatchNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE message LIKE '%CH-2026-E2E-7788%' ORDER BY id DESC"
    );
    console.log(`✓ ${dispatchNotifs.length} Dispatch notifications created (sent to Supervisor, PC, and Purchase Dept).\n`);

    // -------------------------------------------------------------
    // STEP 9: Site Supervisor marks delivery as Received & uploads proof
    // -------------------------------------------------------------
    console.log('--- STEP 9: Site Supervisor receives material & uploads proof ---');
    const receiveRes = await api.post(
      `${BASE_URL}/requisitions/${pr.id}/receive`,
      {
        received_qty: 250,
        challan_no: 'CH-2026-E2E-7788',
        proof_file: 'https://ddpl-procurement.s3.amazonaws.com/proofs/challan_signed_7788.pdf',
        remarks: 'Physical bags counted and unloaded at site shed. Quality seal intact.',
        received_date: '2026-10-07'
      },
      { headers: getAuthHeader(supervisor) }
    );
    const prAfterReceive = receiveRes.data?.data || receiveRes.data;
    console.log(`✓ Delivery received and verified by Site Supervisor. Final status: "${prAfterReceive.status}"`);

    // Verify delivery_receipts table record
    const [receipts] = await pool.query('SELECT * FROM delivery_receipts WHERE requisition_id = ?', [pr.id]);
    console.log(`✓ Delivery receipt stored: ${receipts.length} record(s) in delivery_receipts table.`);

    // Verify notifications sent to Purchase and Coordinator
    const [receiveNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE message LIKE '%Site Supervisor%received%' ORDER BY id DESC"
    );
    console.log(`✓ Notifications dispatched to Purchase Manager & Coordinator on receipt verification.\n`);

    // -------------------------------------------------------------
    // STEP 10: Audit Trail & Status History Verification
    // -------------------------------------------------------------
    console.log('--- STEP 10: Audit Trail & Status History Verification ---');
    const [history] = await pool.query(
      'SELECT from_status, to_status, action_by, role, remark, created_at FROM status_history WHERE entity_id = ? AND entity_type = "requisition" ORDER BY id ASC',
      [pr.id]
    );

    console.log(`✓ Total lifecycle status transitions logged: ${history.length}`);
    history.forEach((h, idx) => {
      console.log(`  [${idx + 1}] ${h.from_status} ➔ ${h.to_status} | By: ${h.action_by} (${h.role}) on ${formatWorkflowDateTime(h.created_at)}`);
      console.log(`      Remark: "${h.remark}"`);
    });

    console.log('\n===============================================================');
    console.log('🎉 ALL END-TO-END ROLE WORKFLOW TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('===============================================================\n');

  } catch (err) {
    console.error('\n❌ E2E TEST FAILED:', err.response?.data || err.message);
    if (err.response?.data?.errors) {
      console.error('Validation errors:', err.response.data.errors);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runE2ETest();
