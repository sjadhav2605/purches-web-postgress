import pool from '../config/db.js';

async function check() {
  try {
    const [delRows] = await pool.query("SELECT * FROM deliveries WHERE challan_no LIKE '%fklsd%'");
    console.log('DELIVERIES MATCH:', delRows.length);
    if (delRows.length > 0) {
      console.log('Delivery 0:', JSON.stringify(delRows[0], null, 2));
    }
    const [vbcRows] = await pool.query("SELECT * FROM vendor_billed_challans WHERE challan_no LIKE '%fklsd%'");
    console.log('VBC MATCH:', vbcRows.length);
    if (vbcRows.length > 0) {
      console.log('VBC 0:', JSON.stringify(vbcRows[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

check();
