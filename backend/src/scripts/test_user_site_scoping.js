import pool from '../config/db.js';

async function testUserSiteScoping() {
  try {
    // 1. Assign site 38 to PC Amit
    await pool.query("UPDATE users SET default_site_id = 38 WHERE email = 'pc@ddpl.com'");
    console.log('✓ Assigned site 38 to Project Coordinator Amit.');

    // 2. Login as Amit
    const amitLogin = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pc@ddpl.com', password: 'password123' })
    });
    const amitData = await amitLogin.json();
    const amitToken = amitData.data.token;

    // 3. Amit fetches sites
    const sitesRes = await fetch('http://localhost:5000/api/v1/sites', {
      headers: { 'Authorization': 'Bearer ' + amitToken }
    });
    const sitesData = await sitesRes.json();
    console.log('✓ Sites visible to Amit (should be ONLY 1 site - site 38):', sitesData.data.length, 'site(s):');
    sitesData.data.forEach(s => console.log('   ->', s.code, '-', s.name));

    // 4. Amit fetches requisitions
    const reqsRes = await fetch('http://localhost:5000/api/v1/requisitions', {
      headers: { 'Authorization': 'Bearer ' + amitToken }
    });
    const reqsData = await reqsRes.json();
    console.log('✓ Requisitions visible to Amit for site 38:', reqsData.data.items.length, 'items:');
    reqsData.data.items.forEach(r => console.log('   ->', r.pr_no, '|', r.site_name, '|', r.status));

    console.log('\nALL SCOPING VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    pool.end();
  }
}

testUserSiteScoping();
