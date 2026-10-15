import { RequisitionService } from '../modules/requisitions/requisition.service.js';
import { RfqService } from '../modules/rfqs/rfq.service.js';

async function test() {
  try {
    console.log('--- Testing Requisition 52 Details ---');
    const userPurchase = { id: 2, role: 'purchase', name: 'Purchase Manager' };
    const userDirector1 = { id: 5, role: 'director', name: 'Director 1' };
    const userDirector2 = { id: 10, role: 'director', name: 'Director 2' };

    const prDetails = await RequisitionService.getRequisitionById(52, userPurchase);
    console.log('PR 52 items:', prDetails.items);
    console.log('PR 52 financial totals:', {
      subtotal: prDetails.approved_subtotal,
      gst: prDetails.approved_gst,
      total: prDetails.approved_total,
      target_director_name: prDetails.target_director_name
    });

    console.log('\n--- Testing RFQ lists per Director ---');
    const dir1Rfqs = await RfqService.getAllRfqs({}, userDirector1);
    console.log(`Director 1 (id: 5) RFQs count: ${dir1Rfqs.length}`);
    dir1Rfqs.forEach(r => console.log(`  - RFQ ${r.rfq_no} (id: ${r.id}, target: ${r.target_director_name})`));

    const dir2Rfqs = await RfqService.getAllRfqs({}, userDirector2);
    console.log(`Director 2 (id: 10) RFQs count: ${dir2Rfqs.length}`);
    dir2Rfqs.forEach(r => console.log(`  - RFQ ${r.rfq_no} (id: ${r.id}, target: ${r.target_director_name})`));

    console.log('\n--- Testing PR lists per Director ---');
    const dir1Prs = await RequisitionService.getRequisitions({}, userDirector1);
    console.log(`Director 1 (id: 5) PRs count: ${dir1Prs.totalItems}`);

    const dir2Prs = await RequisitionService.getRequisitions({}, userDirector2);
    console.log(`Director 2 (id: 10) PRs count: ${dir2Prs.totalItems}`);

    console.log('\n--- Testing Scoping Security on RFQ 40 ---');
    try {
      await RfqService.getRfqById(40, userDirector2);
      console.log('ERROR: Director 2 accessed Director 1 RFQ!');
    } catch (e) {
      console.log('SUCCESS: Director 2 blocked from Director 1 RFQ:', e.message);
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    process.exit(0);
  }
}

test();
