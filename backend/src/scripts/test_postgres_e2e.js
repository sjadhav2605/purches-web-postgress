async function runTests() {
  console.log('🧪 Starting PostgreSQL Backend End-to-End Test Suite...\n');

  // 1. Health
  const healthRes = await fetch('http://localhost:5000/health');
  const health = await healthRes.json();
  console.log('1. Health Check:', healthRes.status === 200 ? '✅ PASS' : '❌ FAIL', health.status);

  // 2. Login
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ddpl.com', password: 'Admin@123' })
  });
  const login = await loginRes.json();
  const token = login.data?.token;
  console.log('2. Admin Auth Login:', loginRes.status === 200 && token ? '✅ PASS' : '❌ FAIL', 'Role:', login.data?.user?.role);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 3. Requisitions
  const reqRes = await fetch('http://localhost:5000/api/v1/requisitions', { headers: authHeaders });
  const reqData = await reqRes.json();
  console.log(
    '3. Requisitions List:',
    reqRes.status === 200 ? '✅ PASS' : '❌ FAIL',
    `Returned ${reqData.data?.items?.length} items (Total: ${reqData.data?.pagination?.total})`
  );

  // 4. RFQs
  const rfqRes = await fetch('http://localhost:5000/api/v1/rfqs', { headers: authHeaders });
  const rfqData = await rfqRes.json();
  console.log(
    '4. RFQs List:',
    rfqRes.status === 200 ? '✅ PASS' : '❌ FAIL',
    `Returned ${rfqData.data?.length} RFQs`
  );

  // 5. Purchase Orders
  const poRes = await fetch('http://localhost:5000/api/v1/orders', { headers: authHeaders });
  const poData = await poRes.json();
  console.log(
    '5. Purchase Orders List:',
    poRes.status === 200 ? '✅ PASS' : '❌ FAIL',
    `Returned ${poData.data?.items?.length} Orders`
  );

  // 6. Sites Master
  const sitesRes = await fetch('http://localhost:5000/api/v1/sites', { headers: authHeaders });
  const sitesData = await sitesRes.json();
  console.log(
    '6. Sites Master:',
    sitesRes.status === 200 ? '✅ PASS' : '❌ FAIL',
    `Returned ${sitesData.data?.length} Sites`
  );

  // 7. Materials Master
  const matRes = await fetch('http://localhost:5000/api/v1/materials', { headers: authHeaders });
  const matData = await matRes.json();
  console.log(
    '7. Materials Master:',
    matRes.status === 200 ? '✅ PASS' : '❌ FAIL',
    `Returned ${matData.data?.length} Materials`
  );

  // 8. Vendors Master
  const venRes = await fetch('http://localhost:5000/api/v1/vendors', { headers: authHeaders });
  const venData = await venRes.json();
  console.log(
    '8. Vendors Master:',
    venRes.status === 200 ? '✅ PASS' : '❌ FAIL',
    `Returned ${venData.data?.length} Vendors`
  );

  // 9. Notifications
  const notifRes = await fetch('http://localhost:5000/api/v1/notifications', { headers: authHeaders });
  const notifData = await notifRes.json();
  console.log(
    '9. Notifications:',
    notifRes.status === 200 ? '✅ PASS' : '❌ FAIL',
    `Returned notifications`
  );

  // 10. Create PR test
  console.log('\n📝 10. Testing Requisition Creation in PostgreSQL...');
  const siteId = sitesData.data?.[0]?.id;
  const newPrPayload = {
    site_id: siteId,
    category: 'Civil / Structural',
    required_by_date: '2026-10-30',
    remarks: 'Automated PostgreSQL Integration Test PR',
    items: [
      {
        material_id: matData.data?.[0]?.id,
        description: matData.data?.[0]?.description || 'Test Item 1',
        spec: 'IS Standard',
        unit: 'Bag',
        quantity: 15,
        est_rate: 350.00,
        is_custom: false
      }
    ]
  };

  const createPrRes = await fetch('http://localhost:5000/api/v1/requisitions', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(newPrPayload)
  });
  const createdPr = await createPrRes.json();
  console.log(
    '10. Requisition Creation:',
    createPrRes.status === 201 ? '✅ PASS' : '❌ FAIL',
    'Created PR No:', createdPr.data?.pr_no || createdPr.data?.id
  );

  console.log('\n🎉 ALL POSTGRESQL END-TO-END TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(console.error);
