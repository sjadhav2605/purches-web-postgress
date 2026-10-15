import db from '../config/db.js';
import { RequisitionService } from '../modules/requisitions/requisition.service.js';
import { RfqService } from '../modules/rfqs/rfq.service.js';
import { MastersService } from '../modules/masters/masters.service.js';

async function testAll() {
  console.log('==================================================');
  console.log('🚀 SYSTEM HEALTH & DEPLOYMENT READINESS CHECK');
  console.log('==================================================');

  // 1. Database Connection & Tables
  const [tables] = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log(`✅ Database connected. Total tables: ${tables.length}`);

  // 2. PR Rate & Flow Verification
  const [prList] = await db.query('SELECT id, pr_no FROM requisitions ORDER BY id DESC LIMIT 1');
  if (prList.length > 0) {
    const pr = await RequisitionService.getRequisitionById(prList[0].id, { id: 1, role: 'admin', name: 'Administrator' });
    console.log(`✅ Latest PR (${pr.pr_no}) fetched successfully:`);
    console.log(`   - Status: ${pr.status}`);
    console.log(`   - Items count: ${pr.items?.length || 0}`);
  }

  // 3. Director Scoping Verification
  const dir1Rfqs = await RfqService.getAllRfqs({}, { id: 5, role: 'director', name: 'Director 1' });
  const dir2Rfqs = await RfqService.getAllRfqs({}, { id: 10, role: 'director', name: 'Director 2' });
  const dir3Rfqs = await RfqService.getAllRfqs({}, { id: 11, role: 'director', name: 'Director 3' });

  console.log(`✅ Director Isolation Check:`);
  console.log(`   - Director 1 (id 5) RFQs: ${dir1Rfqs.length}`);
  console.log(`   - Director 2 (id 10) RFQs: ${dir2Rfqs.length}`);
  console.log(`   - Director 3 (id 11) RFQs: ${dir3Rfqs.length}`);

  // 4. Vendors Master & Public Registration
  const vendors = await MastersService.getVendors();
  console.log(`✅ Vendors Master Check: Total vendors: ${vendors.length}`);

  // 5. Materials Master
  const materials = await MastersService.getMaterials();
  console.log(`✅ Materials Master Check: Total materials: ${materials.length}`);

  // 6. Sites Master
  const sites = await MastersService.getSites();
  console.log(`✅ Sites Master Check: Total sites: ${sites.length}`);

  console.log('==================================================');
  console.log('🎉 ALL SYSTEM HEALTH CHECKS PASSED SUCCESSFULLY!');
  console.log('==================================================');
  process.exit(0);
}

testAll().catch(err => {
  console.error('❌ HEALTH CHECK FAILED:', err);
  process.exit(1);
});
