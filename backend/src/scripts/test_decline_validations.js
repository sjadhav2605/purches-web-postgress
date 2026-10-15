import dotenv from 'dotenv';
dotenv.config();
import pool from '../config/db.js';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const api = {
  async post(url, body, { headers } = {}) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json };
  }
};

function getAuthHeader(user) {
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, vendor_id: user.vendor_id || null },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { Authorization: `Bearer ${token}` };
}

async function runDeclineTests() {
  console.log('Testing Mandatory Decline Validations...');
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email IN (?, ?, ?)', [
      'supervisor@ddpl.com',
      'pc@ddpl.com',
      'purchase@ddpl.com'
    ]);
    const supervisor = users.find(u => u.email === 'supervisor@ddpl.com');
    const pc = users.find(u => u.email === 'pc@ddpl.com');
    const purchase = users.find(u => u.email === 'purchase@ddpl.com');

    const [sites] = await pool.query('SELECT id FROM sites LIMIT 1');

    // 1. Create a request
    const createRes = await api.post(`${BASE_URL}/requisitions`, {
      site_id: sites[0].id,
      required_by_date: '2026-11-20',
      items: [{ description: 'Test Item', unit: 'Bags', quantity: 50, est_rate: 100 }]
    }, { headers: getAuthHeader(supervisor) });
    const prId = createRes.data.data.id;

    // 2. PC decline without reason (should fail)
    const failPcDecline = await api.post(`${BASE_URL}/requisitions/${prId}/coordinator-decline`, {}, { headers: getAuthHeader(pc) });
    if (failPcDecline.ok) throw new Error('Expected PC decline without reason to fail');
    console.log('✓ Coordinator decline without reason properly rejected (400 Bad Request):', failPcDecline.data.message);

    // 3. PC decline with reason (should succeed)
    const succPcDecline = await api.post(`${BASE_URL}/requisitions/${prId}/coordinator-decline`, { reason: 'Item not required on site currently' }, { headers: getAuthHeader(pc) });
    if (!succPcDecline.ok) throw new Error('Expected PC decline with reason to succeed: ' + succPcDecline.data.message);
    console.log('✓ Coordinator decline with reason succeeded. Status is now:', succPcDecline.data.data.status);

    // 4. Create another request, coordinator approves, then test Purchase decline
    const req2 = await api.post(`${BASE_URL}/requisitions`, {
      site_id: sites[0].id,
      required_by_date: '2026-11-20',
      items: [{ description: 'Test Item 2', unit: 'Bags', quantity: 20, est_rate: 200 }]
    }, { headers: getAuthHeader(supervisor) });
    const pr2Id = req2.data.data.id;

    await api.post(`${BASE_URL}/requisitions/${pr2Id}/coordinator-approve`, {}, { headers: getAuthHeader(pc) });

    // Purchase decline without reason (should fail)
    const failPurchDecline = await api.post(`${BASE_URL}/requisitions/${pr2Id}/purchase-decline`, {}, { headers: getAuthHeader(purchase) });
    if (failPurchDecline.ok) throw new Error('Expected Purchase decline without reason to fail');
    console.log('✓ Purchase decline without reason properly rejected (400 Bad Request):', failPurchDecline.data.message);

    // Purchase decline with reason (should succeed)
    const succPurchDecline = await api.post(`${BASE_URL}/requisitions/${pr2Id}/purchase-decline`, { reason: 'Budget exceeded for this category' }, { headers: getAuthHeader(purchase) });
    if (!succPurchDecline.ok) throw new Error('Expected Purchase decline with reason to succeed');
    console.log('✓ Purchase decline with reason succeeded. Status is now:', succPurchDecline.data.data.status);

    console.log('\n✓ All Decline validations verified successfully!');
  } catch (err) {
    console.error('Validation test error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runDeclineTests();
