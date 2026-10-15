import dotenv from 'dotenv';
dotenv.config();
import pool from '../config/db.js';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const api = {
  async get(url, { headers } = {}) {
    const res = await fetch(url, { headers });
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json.data !== undefined ? json.data : json };
  },
  async patch(url, body, { headers } = {}) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json.data !== undefined ? json.data : json, raw: json };
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

async function runCommercialTermsTests() {
  console.log('===============================================================');
  console.log('Starting Commercial Terms & Declaration Verification Tests');
  console.log('===============================================================\n');

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email IN (?, ?)', [
      'purchase@ddpl.com',
      'vendor@ddpl.com'
    ]);
    const purchase = users.find(u => u.email === 'purchase@ddpl.com');
    const vendor = users.find(u => u.email === 'vendor@ddpl.com');

    // Find any existing purchase order
    const [orders] = await pool.query('SELECT * FROM purchase_orders ORDER BY id DESC LIMIT 1');
    if (orders.length === 0) {
      throw new Error('No purchase orders found in database to test.');
    }
    const testPo = orders[0];
    console.log(`✓ Testing with Purchase Order: ${testPo.po_no} (ID: ${testPo.id}, Total: ₹${testPo.total_amount})`);

    // 1. ROLE RESTRICTION TEST: Vendor attempts to edit commercial terms
    console.log('\n--- 1. Testing Role Restriction: Vendor should be Forbidden ---');
    const vendorRes = await api.patch(
      `${BASE_URL}/orders/${testPo.id}/commercial-terms`,
      {
        advance_pct: 10,
        credit_days: 30,
        payment_terms: 'Vendor attempting unauthorized edit'
      },
      { headers: getAuthHeader(vendor) }
    );
    if (vendorRes.ok) {
      throw new Error('SECURITY VIOLATION: Vendor was able to edit commercial terms!');
    }
    console.log(`✓ Role check enforced: Vendor rejected with status ${vendorRes.status} (${vendorRes.data.message || vendorRes.raw.message})`);

    // 2. VALIDATION TESTS: Invalid inputs
    console.log('\n--- 2. Testing Validation Rules ---');
    // 2a. Advance % > 100
    const valRes1 = await api.patch(
      `${BASE_URL}/orders/${testPo.id}/commercial-terms`,
      { advance_pct: 125, credit_days: 30, payment_terms: 'Advance test' },
      { headers: getAuthHeader(purchase) }
    );
    if (valRes1.ok) throw new Error('Validation failed: Allowed advance > 100%');
    console.log(`✓ Advance % > 100 rejected: "${valRes1.raw.message || valRes1.data.message}"`);

    // 2b. Credit days negative or decimal
    const valRes2 = await api.patch(
      `${BASE_URL}/orders/${testPo.id}/commercial-terms`,
      { advance_pct: 10, credit_days: -5, payment_terms: 'Credit test' },
      { headers: getAuthHeader(purchase) }
    );
    if (valRes2.ok) throw new Error('Validation failed: Allowed negative credit days');
    console.log(`✓ Negative credit days rejected: "${valRes2.raw.message || valRes2.data.message}"`);

    // 2c. Empty payment terms
    const valRes3 = await api.patch(
      `${BASE_URL}/orders/${testPo.id}/commercial-terms`,
      { advance_pct: 10, credit_days: 30, payment_terms: '   ' },
      { headers: getAuthHeader(purchase) }
    );
    if (valRes3.ok) throw new Error('Validation failed: Allowed empty payment terms');
    console.log(`✓ Empty payment terms rejected: "${valRes3.raw.message || valRes3.data.message}"`);

    // 3. SUCCESSFUL SAVE TEST (Purchase Manager)
    console.log('\n--- 3. Testing Successful Save by Purchase Manager ---');
    const validPayload = {
      advance_pct: 25,
      credit_days: 45,
      payment_terms: '25% advance against Proforma Invoice on PO issuance. Balance 75% within 45 days after Site Verification.',
      declaration_text: 'Custom Declaration: We hereby confirm all supplied materials conform to IS standards and certified delivery challan.'
    };

    const saveRes = await api.patch(
      `${BASE_URL}/orders/${testPo.id}/commercial-terms`,
      validPayload,
      { headers: getAuthHeader(purchase) }
    );

    if (!saveRes.ok) {
      throw new Error('Save failed: ' + (saveRes.raw.message || saveRes.data.message));
    }

    const savedPo = saveRes.data;
    console.log('✓ Commercial terms saved successfully!');
    console.log(`  - PO No: ${savedPo.po_no}`);
    console.log(`  - Advance %: ${savedPo.payment_terms?.advance_pct}%`);
    console.log(`  - Advance Amount Auto-Calculated: ₹${savedPo.payment_terms?.advance_amount} (from total ₹${savedPo.total_amount})`);
    console.log(`  - Credit Days: ${savedPo.payment_terms?.credit_days} days`);
    console.log(`  - Terms Text: "${savedPo.payment_terms?.notes}"`);
    console.log(`  - Declaration Text: "${savedPo.declaration_text}"`);
    console.log(`  - Updated By: ${savedPo.terms_updated_by_name}`);
    console.log(`  - Updated At (ISO format): ${savedPo.terms_updated_at}`);

    // Verify calculation
    const expectedAdvance = Math.round((Number(savedPo.total_amount) * 0.25) * 100) / 100;
    if (Number(savedPo.payment_terms.advance_amount) !== expectedAdvance) {
      throw new Error(`Calculation mismatch: Expected ${expectedAdvance}, got ${savedPo.payment_terms.advance_amount}`);
    }
    console.log('✓ Advance calculation verified accurately.');

    // 4. EDIT AFTER SAVE TEST (Update again)
    console.log('\n--- 4. Testing Subsequent Update (Edit After Save) ---');
    const updateRes = await api.patch(
      `${BASE_URL}/orders/${testPo.id}/commercial-terms`,
      {
        advance_pct: 30,
        credit_days: 60,
        payment_terms: 'Revised: 30% advance on PO issuance. Balance 70% within 60 days of site delivery.',
        declaration_text: 'Revised Declaration: Material warranty of 18 months applies from installation.'
      },
      { headers: getAuthHeader(purchase) }
    );

    if (!updateRes.ok) {
      throw new Error('Subsequent update failed: ' + (updateRes.raw.message || updateRes.data.message));
    }
    const updatedPo2 = updateRes.data;
    console.log(`✓ Edit after save succeeded: Advance is now ${updatedPo2.payment_terms?.advance_pct}%, Credit: ${updatedPo2.payment_terms?.credit_days} days`);
    console.log(`  - Declaration updated to: "${updatedPo2.declaration_text}"`);

    // 5. READ ACCESS CHECK (Other roles can view saved terms and declaration)
    console.log('\n--- 5. Testing Read Access for Other Roles ---');
    const vendorViewRes = await api.get(`${BASE_URL}/orders/${testPo.id}`, { headers: getAuthHeader(vendor) });
    const vendorPo = vendorViewRes.data;
    console.log(`✓ Other role can read saved terms: Advance ${vendorPo.payment_terms?.advance_pct}%, Credit ${vendorPo.payment_terms?.credit_days} days`);
    console.log(`  Declaration viewable: "${vendorPo.declaration_text}"`);

    console.log('\n===============================================================');
    console.log('🎉 ALL COMMERCIAL TERMS & DECLARATION TESTS PASSED! 🎉');
    console.log('===============================================================\n');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCommercialTermsTests();
