import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { rfqService } from '../../services/rfq.service.js';
import { poService } from '../../services/po.service.js';
import { requisitionService } from '../../services/requisition.service.js';
import { masterService } from '../../services/master.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  Store, 
  FileSpreadsheet, 
  ShoppingCart, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Printer, 
  Send,
  Building2,
  Calendar,
  AlertCircle,
  Edit3,
  HelpCircle,
  Check,
  PackageCheck,
  XCircle,
  ChevronRight
} from 'lucide-react';

export const VendorPortalPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const urlRfqId = searchParams.get('rfq_id');
  const urlVendorId = searchParams.get('vendor_id');

  const [activeTab, setActiveTab] = useState('rfqs'); // 'rfqs' | 'orders'
  const [rfqs, setRfqs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState(() => {
    if (urlVendorId) return String(urlVendorId);
    return user?.vendor_id ? String(user.vendor_id) : '';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bid Submission Modal State
  const [showBidModal, setShowBidModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState(null);
  const [leadDays, setLeadDays] = useState(3);
  const [globalLeadFrom, setGlobalLeadFrom] = useState('');
  const [globalLeadTo, setGlobalLeadTo] = useState('');
  const [globalAvailability, setGlobalAvailability] = useState('Available');
  const [bidItems, setBidItems] = useState([]);
  const [submittingBid, setSubmittingBid] = useState(false);

  // Vendor Rate Revision Review State
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionRfq, setRevisionRfq] = useState(null);
  const [revisionBid, setRevisionBid] = useState(null);
  const [latestRevision, setLatestRevision] = useState(null);
  const [revisionResponseItems, setRevisionResponseItems] = useState([]);
  const [vendorRemarks, setVendorRemarks] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rfqData, poData, vendorData] = await Promise.all([
        rfqService.getRfqs().catch(() => []),
        poService.getOrders({ limit: 100 }).catch(() => ({ items: [] })),
        masterService.getVendors().catch(() => [])
      ]);

      const rfqList = rfqData || [];
      const vList = vendorData || [];
      setRfqs(rfqList);
      const poList = poData.items || poData.data || (Array.isArray(poData) ? poData : []);
      setOrders(poList);
      setVendors(vList);

      // Resolve selectedVendorId based on URL params, RFQ invitation, or defaults
      let resolvedVendorId = selectedVendorId;

      if (urlVendorId && vList.some(v => String(v.id) === String(urlVendorId))) {
        resolvedVendorId = String(urlVendorId);
        setSelectedVendorId(resolvedVendorId);
      } else if (urlRfqId && rfqList.length > 0) {
        const targetRfq = rfqList.find(r => String(r.id) === String(urlRfqId));
        if (targetRfq) {
          const invited = (targetRfq.invited_vendor_ids || '').split(',').map(s => s.trim()).filter(Boolean);
          if (resolvedVendorId && invited.includes(String(resolvedVendorId))) {
            // Keep current if invited
          } else if (user?.vendor_id && invited.includes(String(user.vendor_id))) {
            resolvedVendorId = String(user.vendor_id);
            setSelectedVendorId(resolvedVendorId);
          } else if (invited.length > 0) {
            resolvedVendorId = String(invited[0]);
            setSelectedVendorId(resolvedVendorId);
          }
          // Auto-open bid modal for the RFQ if requested via direct link
          setTimeout(() => {
            openBidModal(targetRfq);
          }, 300);
        }
      } else if (vList.length > 0 && !resolvedVendorId) {
        resolvedVendorId = user?.vendor_id ? String(user.vendor_id) : String(vList[0].id);
        setSelectedVendorId(resolvedVendorId);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter orders for currently selected vendor (only formally issued POs, excluding internal drafts & unissued approved POs)
  const vendorOrders = orders.filter(
    (po) => String(po.vendor_id) === String(selectedVendorId) && !['Draft', 'Approved'].includes(po.status)
  );

  // Open Bid Modal and fetch ACTUAL PR items from RFQ
  const openBidModal = async (rfqSummary) => {
    setShowBidModal(true);
    setModalLoading(true);
    try {
      const fullRfq = await rfqService.getRfqById(rfqSummary.id);
      setSelectedRfq(fullRfq);

      // Check if this vendor already submitted a bid for this RFQ
      const existingBid = (fullRfq.bids || []).find(
        (b) => String(b.vendor_id) === String(selectedVendorId)
      );

      const rfqPrItems = fullRfq.items || [];

      if (existingBid && existingBid.items && existingBid.items.length > 0) {
        // Pre-fill existing submitted quote for editing/updating
        setBidItems(
          rfqPrItems.map((prItem, idx) => {
            const matchingBidItem = existingBid.items.find(
              (bi) => bi.description === prItem.description || bi.id === prItem.id
            ) || existingBid.items[idx] || {};

            return {
              id: prItem.id,
              description: prItem.description,
              spec: prItem.spec || matchingBidItem.spec || '',
              unit: prItem.unit || 'Nos',
              qty: Number(prItem.quantity || matchingBidItem.qty || 1),
              rate: Number(matchingBidItem.rate || 0),
              availability: matchingBidItem.availability || 'Available',
              lead_from: matchingBidItem.lead_from || existingBid.lead_from || '',
              lead_to: matchingBidItem.lead_to || existingBid.lead_to || '',
              remarks: matchingBidItem.remarks || ''
            };
          })
        );
        if (existingBid.lead_from) setGlobalLeadFrom(existingBid.lead_from);
        if (existingBid.lead_to) setGlobalLeadTo(existingBid.lead_to);
      } else {
        // Brand new quote entry with real items
        setBidItems(
          rfqPrItems.map((item) => ({
            id: item.id,
            description: item.description,
            spec: item.spec || '',
            unit: item.unit || 'Nos',
            qty: Number(item.quantity || 1),
            rate: 0,
            availability: 'Available',
            lead_from: '',
            lead_to: '',
            remarks: ''
          }))
        );
        setGlobalLeadFrom('');
        setGlobalLeadTo('');
      }
    } catch (err) {
      alert('Failed to load RFQ items: ' + err.message);
      setShowBidModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  // Open Revision Review Modal for Vendor
  const openRevisionModal = async (rfqSummary) => {
    setModalLoading(true);
    try {
      const fullRfq = await rfqService.getRfqById(rfqSummary.id);
      const myBid = (fullRfq.bids || []).find(
        (b) => String(b.vendor_id) === String(selectedVendorId)
      );
      if (!myBid) {
        alert('Bid not found for this vendor.');
        return;
      }
      const latestRev = myBid.latest_revision;
      if (!latestRev) {
        alert('No active rate revision request found.');
        return;
      }

      setRevisionRfq(fullRfq);
      setRevisionBid(myBid);
      setLatestRevision(latestRev);
      setVendorRemarks('');

      const items = (latestRev.items && latestRev.items.length > 0)
        ? latestRev.items.map((ri, idx) => ({
            id: ri.id,
            item_index: ri.item_index !== undefined ? ri.item_index : idx,
            description: ri.description,
            spec: ri.spec || '',
            unit: ri.unit || 'Nos',
            qty: Number(ri.quantity || 1),
            original_rate: Number(ri.original_rate !== undefined ? ri.original_rate : 0),
            revised_rate: Number(ri.revised_rate !== undefined ? ri.revised_rate : 0),
            final_rate: Number(ri.revised_rate !== undefined ? ri.revised_rate : (ri.original_rate || 0)),
            availability: ri.availability || 'Available'
          }))
        : (myBid.items || []).map((it, idx) => ({
            id: it.id,
            item_index: idx,
            description: it.description,
            spec: it.spec || '',
            unit: it.unit || 'Nos',
            qty: Number(it.qty || it.quantity || 1),
            original_rate: Number(it.original_rate !== undefined ? it.original_rate : (it.rate || 0)),
            revised_rate: Number(it.revised_rate !== undefined ? it.revised_rate : (it.rate || 0)),
            final_rate: Number(it.revised_rate !== undefined ? it.revised_rate : (it.rate || 0)),
            availability: it.availability || 'Available'
          }));

      setRevisionResponseItems(items);
      setShowRevisionModal(true);
    } catch (err) {
      alert('Failed to load revision details: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleRevisionFinalRateChange = (idx, val) => {
    const updated = [...revisionResponseItems];
    updated[idx].final_rate = val === '' ? '' : Number(val);
    setRevisionResponseItems(updated);
  };

  const handleAcceptRevisedRates = async () => {
    if (!window.confirm("Accept the Purchase Manager's proposed revised rates?")) return;
    setSubmittingRevision(true);
    try {
      const acceptedItems = revisionResponseItems.map(it => ({
        ...it,
        final_rate: Number(it.revised_rate),
        rate: Number(it.revised_rate)
      }));

      await rfqService.respondBidRevision(revisionRfq.id, revisionBid.id, {
        response_type: 'accepted',
        remarks: vendorRemarks.trim() || 'Accepted Purchase Manager proposed revised rates.',
        items: acceptedItems
      });

      alert('Revised rates accepted! Status updated to "Revised Bid Submitted". Purchase Manager notified.');
      setShowRevisionModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to accept revised rates');
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleSubmitFinalRates = async () => {
    setSubmittingRevision(true);
    try {
      const finalItems = revisionResponseItems.map(it => ({
        ...it,
        final_rate: Number(it.final_rate !== '' ? it.final_rate : it.revised_rate),
        rate: Number(it.final_rate !== '' ? it.final_rate : it.revised_rate)
      }));

      await rfqService.respondBidRevision(revisionRfq.id, revisionBid.id, {
        response_type: 'counter',
        remarks: vendorRemarks.trim() || 'Final rates submitted by vendor.',
        items: finalItems
      });

      alert('Final rates submitted! Status updated to "Revised Bid Submitted". Purchase Manager notified.');
      setShowRevisionModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to submit final rates');
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleRejectRevision = async () => {
    const reason = prompt('Please enter a remark or reason for rejecting the revision request:');
    if (reason === null) return;
    setSubmittingRevision(true);
    try {
      await rfqService.rejectBidRevision(revisionRfq.id, revisionBid.id, {
        remarks: reason.trim() || 'Revision rejected by vendor'
      });
      alert('Revision request rejected. Purchase Department has been notified.');
      setShowRevisionModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to reject revision request');
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleItemFieldChange = (index, field, value) => {
    const updated = [...bidItems];
    updated[index][field] = value;
    // If set to Not Available, zero out the rate
    if (field === 'availability' && value === 'Not Available') {
      updated[index].rate = 0;
    }
    setBidItems(updated);
  };

  const handleApplyGlobalLead = () => {
    const val = globalLeadTo || globalLeadFrom;
    if (!val) {
      alert('Please specify an Expected Delivery Date');
      return;
    }
    const updated = bidItems.map((item) => ({
      ...item,
      lead_from: val,
      lead_to: val
    }));
    setBidItems(updated);
  };

  const handleApplyGlobalAvailability = (status) => {
    setGlobalAvailability(status);
    const updated = bidItems.map((item) => ({
      ...item,
      availability: status,
      rate: status === 'Not Available' ? 0 : item.rate
    }));
    setBidItems(updated);
  };

  const handleSubmitQuote = async (e) => {
    e.preventDefault();
    if (!selectedRfq || !selectedVendorId) return;

    // Validate that at least one item is marked Available or Available on Order with a rate
    const validItems = bidItems.filter(
      (it) => it.availability !== 'Not Available' && Number(it.rate) > 0
    );

    if (validItems.length === 0 && bidItems.some(it => it.availability !== 'Not Available')) {
      alert('Please provide quoted unit rates for available items.');
      return;
    }

    setSubmittingBid(true);
    try {
      const totalAmount = bidItems.reduce((sum, item) => {
        if (item.availability === 'Not Available') return sum;
        return sum + (Number(item.qty || 0) * Number(item.rate || 0));
      }, 0);

      await rfqService.submitBid({
        rfq_id: selectedRfq.id,
        vendor_id: Number(selectedVendorId),
        rev_no: selectedRfq.current_rev || 0,
        quote_amount: totalAmount,
        delivery_days: Number(leadDays),
        lead_from: globalLeadFrom || null,
        lead_to: globalLeadTo || null,
        entered_by: 'vendor',
        bid_items: bidItems
      });

      setShowBidModal(false);
      fetchData();
      alert('Your quote has been successfully submitted to DDPL Purchase Department! RFQ status updated to "Bids In".');
    } catch (e) {
      alert(e.message || 'Failed to submit quote');
    } finally {
      setSubmittingBid(false);
    }
  };

  // Requisition Delivery Details Modal State (Awarded / Shortlisted Vendor)
  const [reqDispatchModalRfq, setReqDispatchModalRfq] = useState(null);
  const [reqDispatchForm, setReqDispatchForm] = useState({
    dispatch_date: new Date().toISOString().split('T')[0],
    vehicle_no: '',
    transport_name: '',
    challan_no: '',
    dispatched_qty: '',
    driver_name: '',
    driver_phone: '',
    dispatch_remarks: ''
  });
  const [submittingReqDispatch, setSubmittingReqDispatch] = useState(false);

  const openRequisitionDispatchModal = (rfq) => {
    setReqDispatchModalRfq(rfq);

    // Extract driver info if previously stored in remarks
    let driverName = '';
    let driverPhone = '';
    let cleanRemarks = rfq.dispatch_remarks || '';
    if (cleanRemarks.includes('Driver:')) {
      const dMatch = cleanRemarks.match(/Driver:\s*([^•|]+)/);
      if (dMatch) driverName = dMatch[1].trim();
    }
    if (cleanRemarks.includes('Phone:')) {
      const pMatch = cleanRemarks.match(/Phone:\s*([^•|]+)/);
      if (pMatch) driverPhone = pMatch[1].trim();
    }

    setReqDispatchForm({
      dispatch_date: rfq.dispatch_date ? new Date(rfq.dispatch_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      vehicle_no: rfq.vehicle_no || '',
      transport_name: rfq.transport_name || '',
      challan_no: rfq.challan_no || '',
      dispatched_qty: rfq.dispatched_qty || '',
      driver_name: driverName,
      driver_phone: driverPhone,
      dispatch_remarks: cleanRemarks
    });
  };

  const handleConfirmRequisitionDispatch = async (e) => {
    e.preventDefault();
    if (!reqDispatchForm.challan_no.trim()) {
      alert('Vendor Delivery Challan / Invoice Number is required.');
      return;
    }
    setSubmittingReqDispatch(true);
    try {
      const driverParts = [];
      if (reqDispatchForm.driver_name.trim()) driverParts.push(`Driver: ${reqDispatchForm.driver_name.trim()}`);
      if (reqDispatchForm.driver_phone.trim()) driverParts.push(`Phone: ${reqDispatchForm.driver_phone.trim()}`);

      const remarksText = reqDispatchForm.dispatch_remarks.trim();
      const combinedRemarks = [
        driverParts.join(' • '),
        remarksText && !remarksText.includes('Driver:') ? remarksText : ''
      ].filter(Boolean).join(' | ');

      await requisitionService.dispatchDelivery(reqDispatchModalRfq.requisition_id, {
        dispatch_date: reqDispatchForm.dispatch_date,
        vehicle_no: reqDispatchForm.vehicle_no.trim(),
        transport_name: reqDispatchForm.transport_name.trim(),
        challan_no: reqDispatchForm.challan_no.trim(),
        dispatched_qty: reqDispatchForm.dispatched_qty.trim(),
        dispatch_remarks: combinedRemarks
      });
      setReqDispatchModalRfq(null);
      await fetchData();
      alert(`Materials marked as Dispatched under Challan ${reqDispatchForm.challan_no.trim()}! Project Coordinator, Site Supervisor and Purchase Department have been notified.`);
    } catch (err) {
      alert(err.message || 'Failed to dispatch shipment');
    } finally {
      setSubmittingReqDispatch(false);
    }
  };

  const [dispatchModalPo, setDispatchModalPo] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({
    invoice_no: '',
    dispatch_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      return d.toISOString().split('T')[0];
    })(),
    transporter: '',
    driver_phone: '',
    vehicle_no: '',
    dispatch_notes: ''
  });
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  const handleOpenDispatchModal = (po) => {
    setDispatchModalPo(po);
    setDispatchForm({
      invoice_no: po.invoice_no || '',
      dispatch_date: po.dispatch_date ? new Date(po.dispatch_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      expected_delivery_date: po.expected_delivery_date ? new Date(po.expected_delivery_date).toISOString().split('T')[0] : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        return d.toISOString().split('T')[0];
      })(),
      transporter: '',
      driver_phone: '',
      vehicle_no: '',
      dispatch_notes: po.dispatch_notes || ''
    });
  };

  const handleConfirmDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchForm.invoice_no.trim()) {
      alert('Vendor Delivery Challan / Invoice Number is required.');
      return;
    }
    if (!dispatchForm.expected_delivery_date) {
      alert('Expected Site Delivery Date is required.');
      return;
    }

    setSubmittingDispatch(true);
    try {
      const combinedNotes = [
        dispatchForm.vehicle_no ? `Vehicle: ${dispatchForm.vehicle_no}` : '',
        dispatchForm.transporter ? `Transporter: ${dispatchForm.transporter}` : '',
        dispatchForm.driver_phone ? `Driver: ${dispatchForm.driver_phone}` : '',
        dispatchForm.dispatch_notes ? `Notes: ${dispatchForm.dispatch_notes}` : ''
      ].filter(Boolean).join(' • ');

      await poService.updateStatus(
        dispatchModalPo.id,
        'Dispatched',
        dispatchForm.invoice_no.trim(),
        `Dispatched by Vendor with Challan ${dispatchForm.invoice_no.trim()}`,
        dispatchForm.dispatch_date,
        dispatchForm.expected_delivery_date,
        combinedNotes
      );

      setDispatchModalPo(null);
      await fetchData();
      alert(`PO ${dispatchModalPo.po_no} marked as Dispatched! Expected site arrival on ${dispatchForm.expected_delivery_date}. Site Supervisor & Project Coordinator notified.`);
    } catch (err) {
      alert(err.message || 'Failed to dispatch shipment');
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const handleUpdatePoStatus = async (poId, nextStatus, poNo) => {
    const actionLabel = nextStatus === 'Acknowledged' ? 'Acknowledge & Accept' : 'Mark as Dispatched';
    if (!window.confirm(`${actionLabel} Purchase Order ${poNo}?`)) return;

    try {
      await poService.updateStatus(poId, nextStatus, '', `Updated by Vendor to ${nextStatus}`);
      fetchData();
      alert(`PO ${poNo} marked as ${nextStatus}!`);
    } catch (e) {
      alert(e.message || 'Failed to update status');
    }
  };

  const currentVendor = vendors.find((v) => String(v.id) === String(selectedVendorId));
  const currentVendorName = currentVendor?.name || 'Selected Vendor';

  // Filter RFQs: Strictly only show RFQs where this vendor was invited, shortlisted, or awarded
  const vendorRfqs = rfqs.filter((r) => {
    if (!selectedVendorId) return false;
    const invitedIds = (r.invited_vendor_ids || '').split(',').map(s => s.trim()).filter(Boolean);
    let shortlistedIds = [];
    try {
      if (r.shortlisted_vendors) {
        const parsed = typeof r.shortlisted_vendors === 'string' ? JSON.parse(r.shortlisted_vendors) : r.shortlisted_vendors;
        if (Array.isArray(parsed)) shortlistedIds = parsed.map(String);
      }
    } catch {}

    const isInvited = invitedIds.includes(String(selectedVendorId));
    const isShortlisted = shortlistedIds.includes(String(selectedVendorId)) || 
                          String(r.shortlisted_vendor_id) === String(selectedVendorId) || 
                          String(r.requisition_shortlisted_vendor_id) === String(selectedVendorId);
    const isWinner = String(r.winner_vendor_id) === String(selectedVendorId);

    return isInvited || isShortlisted || isWinner;
  });

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Vendor Self-Service Portal</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Review RFQs, enter item pricing, specify availability, and update delivery dispatch.
              </p>
            </div>
          </div>
        </div>

        {/* Vendor Profile Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--card-bg)', padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Simulate Vendor:</span>
          <select
            className="form-control"
            style={{ width: 'auto', padding: '0.25rem 0.6rem', fontSize: '0.88rem', color: 'var(--primary-700)', fontWeight: 700, border: '1px solid var(--border-color)' }}
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} {v.gstin ? `(${v.gstin})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveTab('rfqs')}
          className={`btn ${activeTab === 'rfqs' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <FileSpreadsheet size={16} />
          <span>My RFQs & Quotations</span>
          <span className="badge badge-draft" style={{ marginLeft: '0.25rem' }}>
            {vendorRfqs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ShoppingCart size={16} />
          <span>Purchase Orders & Dispatch</span>
          <span className="badge badge-issued" style={{ marginLeft: '0.25rem' }}>
            {vendorOrders.length}
          </span>
        </button>
      </div>

      {/* TAB 1: RFQ Invitations & Bidding */}
      {activeTab === 'rfqs' && (() => {
        const shortlistedRfqs = vendorRfqs.filter(r => {
          const isDecided = ['Approved', 'Director Approved', 'Awarded', 'PO Issued', 'Completed'].includes(r.status) || Boolean(r.winner_vendor_id);
          if (isDecided) {
            return String(r.winner_vendor_id) === String(selectedVendorId);
          }
          return String(r.shortlisted_vendor_id) === String(selectedVendorId) || 
            String(r.requisition_shortlisted_vendor_id) === String(selectedVendorId) ||
            r.pr_status === 'Vendor Shortlisted';
        });

        const revisionRequestedRfqs = vendorRfqs.filter(r => {
          const revVendorIds = (r.revision_requested_vendor_ids || '').split(',').map(s => s.trim());
          return revVendorIds.includes(String(selectedVendorId));
        });

        const pendingReviewRfqs = vendorRfqs.filter(r => {
          const sVendorIds = (r.submitted_vendor_ids || '').split(',').map(s => s.trim());
          const submitted = sVendorIds.includes(String(selectedVendorId));
          const revVendorIds = (r.revision_requested_vendor_ids || '').split(',').map(s => s.trim());
          const revReq = revVendorIds.includes(String(selectedVendorId));
          const isDecided = ['Approved', 'Director Approved', 'Awarded', 'PO Issued', 'Completed'].includes(r.status) || Boolean(r.winner_vendor_id);
          return submitted && !isDecided && !revReq;
        });

        return (
          <div>
            {shortlistedRfqs.length > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ background: '#22c55e', color: '#fff', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: '#15803d', fontSize: '1rem', fontWeight: 800 }}>
                    🎉 Order Awarded / Shortlisted! ({shortlistedRfqs.length})
                  </h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#166534' }}>
                    Congratulations! DDPL has selected your bid. Click <strong>"Dispatch Delivery / Add Challan"</strong> in the table below to enter Challan Number, Vehicle, Driver details, and dispatch shipment.
                  </p>
                </div>
              </div>
            )}

            {revisionRequestedRfqs.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '0.9rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ background: '#f59e0b', color: '#fff', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertCircle size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: '#92400e', fontSize: '0.98rem', fontWeight: 800 }}>
                    ⚠️ Action Required: Rate Revision Requested ({revisionRequestedRfqs.length})
                  </h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.83rem', color: '#78350f' }}>
                    DDPL Purchase Department has requested a rate revision for your submitted quote(s). Please click <strong>"Review Revision Request"</strong> in the table below to accept or propose your revised rates.
                  </p>
                </div>
              </div>
            )}

            {pendingReviewRfqs.length > 0 && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ background: '#0284c7', color: '#fff', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: '#0369a1', fontSize: '0.98rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>⏳ Quotations Under Purchase Review ({pendingReviewRfqs.length})</span>
                    <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: '12px', border: '1px solid #7dd3fc', fontWeight: 600 }}>
                      Awaiting Purchase Manager Response
                    </span>
                  </h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.83rem', color: '#0c4a6e' }}>
                    Your quotation(s) have been submitted to DDPL Purchase Department. The Purchase Manager is currently evaluating rates and quotes. Status will automatically update once a response or shortlisting is issued.
                  </p>
                </div>
              </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Requests for Quotation (RFQs)</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Quotations requested by DDPL Purchase Department. Click "Submit Quote" to review items and submit rates.
                  </span>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                      Total RFQs: {vendorRfqs.length}
                    </span>
                    {pendingReviewRfqs.length > 0 && (
                      <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={11} /> {pendingReviewRfqs.length} Under Review
                      </span>
                    )}
                    {revisionRequestedRfqs.length > 0 && (
                      <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertCircle size={11} /> {revisionRequestedRfqs.length} Action Needed
                      </span>
                    )}
                    {shortlistedRfqs.length > 0 && (
                      <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle2 size={11} /> {shortlistedRfqs.length} Awarded / Shortlisted
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Company: <strong style={{ color: 'var(--primary-700)' }}>{currentVendorName}</strong>
                </span>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>RFQ Number</th>
                      <th>Linked PR</th>
                      <th>Delivery Project Site</th>
                      <th>Payment & Credit Terms</th>
                      <th>Submission Deadline</th>
                      <th>My Quote Status</th>
                      <th>RFQ Stage</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>Loading RFQs...</td></tr>
                    ) : vendorRfqs.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                          <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                              <FileSpreadsheet size={24} />
                            </div>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              No Open RFQs for {currentVendorName}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                              There are currently no quotation requests open for this vendor. RFQs appear here once DDPL Purchase Department floats a material request and invites this vendor.
                            </p>
                            {['admin', 'purchase'].includes(user?.role) && (
                              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <Link to="/requisitions" className="btn btn-sm btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <Send size={13} />
                                  <span>Go to Requisitions & Float RFQ</span>
                                </Link>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      vendorRfqs.map((rfq) => {
                        const submittedVendorIds = (rfq.submitted_vendor_ids || '').split(',').map(s => s.trim());
                        const hasSubmitted = submittedVendorIds.includes(String(selectedVendorId));

                        const revisionRequestedVendorIds = (rfq.revision_requested_vendor_ids || '').split(',').map(s => s.trim());
                        const isRevisionRequested = revisionRequestedVendorIds.includes(String(selectedVendorId));

                        const revisedSubmittedVendorIds = (rfq.revised_submitted_vendor_ids || '').split(',').map(s => s.trim());
                        const isRevisedSubmitted = revisedSubmittedVendorIds.includes(String(selectedVendorId));

                        // Has Director/Purchase awarded or approved a winning vendor?
                        const isDecided = ['Approved', 'Director Approved', 'Awarded', 'PO Issued', 'Completed'].includes(rfq.status) || Boolean(rfq.winner_vendor_id);
                        const isWinner = isDecided && String(rfq.winner_vendor_id) === String(selectedVendorId);
                        const isRejected = isDecided && !isWinner;

                        const isShortlisted = !isDecided && (
                          String(rfq.shortlisted_vendor_id) === String(selectedVendorId) || 
                          String(rfq.requisition_shortlisted_vendor_id) === String(selectedVendorId) || 
                          rfq.pr_status === 'Vendor Shortlisted'
                        );

                        const isDispatched = rfq.status === 'Dispatched' || rfq.pr_status === 'Dispatched' || Boolean(rfq.challan_no);
                        const isReceived = rfq.status === 'Received' || rfq.pr_status === 'Received';

                        return (
                          <tr key={rfq.id} style={{ background: isWinner ? 'rgba(34, 197, 94, 0.08)' : (isRejected ? 'rgba(239, 68, 68, 0.03)' : (isShortlisted ? 'rgba(34, 197, 94, 0.06)' : (isRevisionRequested ? 'rgba(245, 158, 11, 0.08)' : (hasSubmitted ? 'rgba(59, 130, 246, 0.02)' : 'transparent')))) }}>
                            <td>
                              <strong style={{ color: 'var(--primary-700)' }}>{rfq.rfq_no}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Rev: {rfq.current_rev ? `RA${rfq.current_rev}` : 'Original'}
                              </div>
                            </td>
                            <td>
                              <strong>{rfq.pr_no}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rfq.pr_category}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{rfq.site_code || '—'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rfq.site_name}</div>
                            </td>
                            <td>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                  💳 {rfq.payment_terms || (rfq.advance_pct > 0 ? `${rfq.advance_pct}% Adv` : 'Standard Terms')}
                                </span>
                                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                  {Number(rfq.advance_pct) > 0 ? (
                                    <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                                      {rfq.advance_pct}% Adv
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.7rem', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                      Nil Adv
                                    </span>
                                  )}
                                  <span style={{ fontSize: '0.7rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                                    {Number(rfq.credit_days) || 30}d Credit
                                  </span>
                                </div>
                                {rfq.payment_terms_notes && (
                                  <span style={{ fontSize: '0.69rem', color: 'var(--text-muted)', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rfq.payment_terms_notes}>
                                    📝 {rfq.payment_terms_notes}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {rfq.deadline ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                                  <Clock size={14} />
                                  {new Date(rfq.deadline).toLocaleDateString()}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Open</span>
                              )}
                            </td>
                            <td>
                              {isWinner ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                  <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.78rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <CheckCircle2 size={13} />
                                    Quote Accepted & Awarded
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>
                                    Approved by Director
                                  </span>
                                </div>
                              ) : isRejected ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                  <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.78rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <XCircle size={13} />
                                    Not Awarded (Rejected)
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 600 }}>
                                    Director selected another vendor
                                  </span>
                                </div>
                              ) : isShortlisted ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                  <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.78rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <CheckCircle2 size={13} />
                                    You are shortlisted!
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>
                                    Selected by Purchase Manager
                                  </span>
                                </div>
                              ) : isRevisionRequested ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                  <span className="badge" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <AlertCircle size={12} />
                                    Revision Requested
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: 600 }}>
                                    Purchase Manager requested revision
                                  </span>
                                </div>
                              ) : isRevisedSubmitted ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                  <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7', fontSize: '0.76rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <CheckCircle2 size={12} />
                                    Revised Bid Submitted
                                  </span>
                                  <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Clock size={11} />
                                    Under Purchase Review
                                  </span>
                                </div>
                              ) : hasSubmitted ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                  <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7', fontSize: '0.76rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <CheckCircle2 size={12} />
                                    Quote Submitted
                                  </span>
                                  <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Clock size={11} />
                                    Under Purchase Review
                                  </span>
                                  <span style={{ fontSize: '0.69rem', color: '#0369a1', fontWeight: 500, lineHeight: 1.2 }}>
                                    Awaiting Purchase Manager response
                                  </span>
                                </div>
                              ) : (
                                <span className="badge badge-draft" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                  ⚪ Quoting Open
                                </span>
                              )}
                            </td>
                            <td>
                              {isWinner ? (
                                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  🏆 Approved (Winning Bid)
                                </span>
                              ) : isRejected ? (
                                <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <XCircle size={12} /> Awarded to Other
                                </span>
                              ) : isShortlisted && !isDispatched && !isReceived ? (
                                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.75rem', fontWeight: 700 }}>
                                  🏆 Shortlisted
                                </span>
                              ) : rfq.status === 'Under_Review' || rfq.status === 'Under Review' ? (
                                <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.75rem', fontWeight: 700 }}>
                                  🔍 Under Review
                                </span>
                              ) : rfq.status === 'Bids In' ? (
                                <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.75rem', fontWeight: 700 }}>
                                  📋 Bids Evaluation
                                </span>
                              ) : rfq.status === 'RFQ Sent' ? (
                                <span className="badge" style={{ background: hasSubmitted ? '#eff6ff' : '#f8fafc', color: hasSubmitted ? '#1d4ed8' : '#475569', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 600 }}>
                                  {hasSubmitted ? '📋 Bids Under Review' : 'RFQ Sent (Open)'}
                                </span>
                              ) : (
                                <span className={`badge badge-${rfq.status?.toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: '0.75rem' }}>
                                  {rfq.status?.replace(/_/g, ' ') || 'Active'}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                {isWinner ? (
                                  isReceived ? (
                                    <span className="badge badge-approved" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <CheckCircle2 size={13} />
                                      Received at Site
                                    </span>
                                  ) : isDispatched ? (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                      <span className="badge badge-verified" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
                                        <Truck size={14} />
                                        Dispatched
                                      </span>
                                      <span style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: 600 }}>
                                        Challan: {rfq.challan_no || 'Recorded'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => openRequisitionDispatchModal(rfq)}
                                        className="btn btn-sm btn-link"
                                        style={{ fontSize: '0.72rem', padding: 0, textDecoration: 'underline', color: 'var(--primary-600)' }}
                                      >
                                        Edit / View Dispatch Details &rarr;
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => openRequisitionDispatchModal(rfq)}
                                        className="btn btn-sm btn-primary"
                                        style={{ 
                                          background: '#16a34a', 
                                          borderColor: '#16a34a', 
                                          color: '#ffffff',
                                          fontWeight: 700, 
                                          fontSize: '0.8rem',
                                          padding: '0.38rem 0.75rem',
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          gap: '0.4rem',
                                          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                                        }}
                                      >
                                        <Truck size={14} />
                                        <span>Dispatch Delivery / Add Challan</span>
                                      </button>
                                      <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>
                                        ✓ Order Awarded by Director
                                      </span>
                                    </div>
                                  )
                                ) : isRejected ? (
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                                    <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontSize: '0.75rem', padding: '0.3rem 0.6rem', fontWeight: 600 }}>
                                      Bidding Closed
                                    </span>
                                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                      Not Selected
                                    </span>
                                  </div>
                                ) : isShortlisted ? (
                                  <button
                                    type="button"
                                    onClick={() => openRequisitionDispatchModal(rfq)}
                                    className="btn btn-sm btn-primary"
                                    style={{ background: '#f59e0b', borderColor: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                                  >
                                    <Truck size={14} />
                                    <span>Add Delivery Details</span>
                                  </button>
                                ) : isRevisionRequested ? (
                                  <button
                                    type="button"
                                    onClick={() => openRevisionModal(rfq)}
                                    className="btn btn-warning btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                                  >
                                    <AlertCircle size={13} />
                                    <span>Review Revision Request</span>
                                  </button>
                                ) : (
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                    <button
                                      onClick={() => openBidModal(rfq)}
                                      className={`btn btn-sm ${hasSubmitted || isRevisedSubmitted ? 'btn-secondary' : 'btn-primary'}`}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                                      title={hasSubmitted || isRevisedSubmitted ? 'You can revise your quote before Purchase Manager shortlists' : 'Submit your quotation'}
                                    >
                                      <Edit3 size={13} />
                                      <span>{hasSubmitted || isRevisedSubmitted ? 'Edit / Update Quote' : 'Submit Quote'}</span>
                                    </button>
                                    {(hasSubmitted || isRevisedSubmitted) && (
                                      <span style={{ fontSize: '0.68rem', color: '#0369a1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Clock size={11} /> Awaiting PM Response
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 2: Purchase Orders & Dispatch */}
      {activeTab === 'orders' && (
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Orders Awarded to {currentVendorName}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Acknowledge orders, dispatch shipments, and track site delivery verification.
                </span>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong>{vendorOrders.length}</strong> Order(s)
              </span>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Delivery Project Site</th>
                    <th>Total Amount (Incl. GST)</th>
                    <th>Payment Terms</th>
                    <th>PO Status</th>
                    <th style={{ textAlign: 'right' }}>Vendor Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Loading Orders...</td></tr>
                  ) : vendorOrders.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                        <ShoppingCart size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                        <div style={{ fontWeight: 600 }}>No Purchase Orders awarded to {currentVendorName} yet</div>
                        <p style={{ fontSize: '0.85rem' }}>Submit competitive quotes on RFQs to win procurement orders.</p>
                      </td>
                    </tr>
                  ) : (
                    vendorOrders.map((po) => {
                      const isIssued = po.status === 'Issued';
                      const isAck = po.status === 'Acknowledged';
                      const isDispatched = po.status === 'Dispatched';

                      return (
                        <tr key={po.id}>
                          <td>
                            <strong style={{ color: 'var(--primary-700)' }}>{po.po_no}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Date: {new Date(po.created_at || Date.now()).toLocaleDateString()}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{po.site_code}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{po.site_name}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 800, color: 'var(--success-text)', fontSize: '1.05rem' }}>
                              ₹{Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem' }}>
                              Adv: <strong>{po.payment_terms?.advance_pct || 0}%</strong> • Credit: <strong>{po.payment_terms?.credit_days || 30} Days</strong>
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-${po.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                              {po.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                              <Link to={`/orders/${po.id}`} className="btn btn-secondary btn-sm" title="View & Print Official PO">
                                <Printer size={14} />
                              </Link>

                              {isIssued && (
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button
                                    onClick={() => handleUpdatePoStatus(po.id, 'Acknowledged', po.po_no)}
                                    className="btn btn-sm btn-primary"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>Accept PO</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenDispatchModal(po)}
                                    className="btn btn-sm"
                                    style={{ background: '#f59e0b', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                  >
                                    <Truck size={13} />
                                    <span>Dispatch</span>
                                  </button>
                                </div>
                              )}

                              {isAck && (
                                <button
                                  onClick={() => handleOpenDispatchModal(po)}
                                  className="btn btn-sm btn-primary"
                                  style={{ background: '#f59e0b', borderColor: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <Truck size={13} />
                                  <span>Mark Dispatched</span>
                                </button>
                              )}

                              {po.status === 'Approved' && (
                                <button
                                  onClick={() => handleOpenDispatchModal(po)}
                                  className="btn btn-sm btn-primary"
                                  style={{ background: '#16a34a', borderColor: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}
                                >
                                  <Truck size={13} />
                                  <span>Dispatch Delivery</span>
                                </button>
                              )}

                              {isDispatched && (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                                  <span className="badge badge-verified" style={{ fontSize: '0.75rem' }}>
                                    🚚 In Transit to Site
                                  </span>
                                  {po.expected_delivery_date && (
                                    <span style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>
                                      Exp: {new Date(po.expected_delivery_date).toLocaleDateString()}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDispatchModal(po)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', marginTop: '0.2rem' }}
                                  >
                                    Update Dispatch Info
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Quote Submission / Editing Modal */}
      {showBidModal && selectedRfq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '880px', width: '100%', maxHeight: '92vh', overflowY: 'auto', margin: 0, boxShadow: 'var(--shadow-xl)' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                  <Send size={18} style={{ color: 'var(--primary-600)' }} />
                  <span>Submit / Update Quotation for {selectedRfq.rfq_no}</span>
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.2rem 0 0' }}>
                  Quoting as: <strong style={{ color: 'var(--primary-700)' }}>{currentVendorName}</strong> • Delivery Site: <strong>{selectedRfq.site_code} ({selectedRfq.site_name})</strong>
                </p>
              </div>
              <button onClick={() => setShowBidModal(false)} className="close-btn">×</button>
            </div>

            {modalLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading request items...
              </div>
            ) : (
              <form onSubmit={handleSubmitQuote}>
                {(() => {
                  const existingBid = (selectedRfq.bids || []).find(b => String(b.vendor_id) === String(selectedVendorId));
                  const hasExistingQuote = Boolean(existingBid && existingBid.items && (Array.isArray(existingBid.items) ? existingBid.items.length > 0 : existingBid.items !== '[]'));
                  if (hasExistingQuote) {
                    return (
                      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: '#0284c7', color: '#fff', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Clock size={16} />
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#0369a1', flex: 1 }}>
                          <strong style={{ display: 'block', marginBottom: '0.15rem' }}>Quotation Active & Under Review by Purchase Manager</strong>
                          Your quote has been submitted to the DDPL Purchase Department. It is currently awaiting review, price comparison, or shortlisting. You can modify rates or delivery schedule below at any time before a decision is finalized.
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Commercial & Payment Terms Offered by DDPL */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)',
                  border: '1.5px solid #86efac',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1.15rem',
                  marginBottom: '1rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '1.15rem' }}>💳</span>
                      <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                        Commercial & Payment Terms Offered by DDPL Purchase:
                      </strong>
                    </div>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: '#15803d',
                      color: '#ffffff',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      ✓ {selectedRfq.payment_terms || 'Standard Purchase Terms'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: '#ffffff', padding: '0.35rem 0.8rem', borderRadius: '6px', border: '1px solid #bbf7d0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>Advance Payment:</span>
                      <strong style={{ fontSize: '0.9rem', color: '#15803d' }}>
                        {selectedRfq.advance_pct !== undefined && selectedRfq.advance_pct !== null && Number(selectedRfq.advance_pct) > 0
                          ? `${selectedRfq.advance_pct}% Advance`
                          : '0% (Nil Advance)'}
                      </strong>
                    </div>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: '#ffffff', padding: '0.35rem 0.8rem', borderRadius: '6px', border: '1px solid #bfdbfe', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600 }}>Credit Period:</span>
                      <strong style={{ fontSize: '0.9rem', color: '#1d4ed8' }}>
                        {selectedRfq.credit_days ? `${selectedRfq.credit_days} Days Credit` : '30 Days Credit'}
                      </strong>
                    </div>

                    {selectedRfq.payment_terms_notes && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: '#ffffff', padding: '0.35rem 0.8rem', borderRadius: '6px', border: '1px solid #fed7aa', flex: 1, minWidth: '220px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                        <span style={{ fontSize: '0.78rem', color: '#9a3412', fontWeight: 600 }}>Terms Note:</span>
                        <span style={{ fontSize: '0.8rem', color: '#7c2d12', fontWeight: 500 }}>
                          {selectedRfq.payment_terms_notes}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Global Batch Controls */}
                <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    Quick Presets / Batch Helpers:
                  </span>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Expected Delivery Helper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Expected Delivery:</span>
                      <input
                        type="date"
                        className="form-control"
                        value={globalLeadTo || globalLeadFrom}
                        onChange={(e) => {
                          setGlobalLeadTo(e.target.value);
                          setGlobalLeadFrom(e.target.value);
                        }}
                        style={{ width: '140px', fontSize: '0.8rem', padding: '0.25rem 0.4rem' }}
                      />
                      <button
                        type="button"
                        onClick={handleApplyGlobalLead}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        Apply to All
                      </button>
                    </div>

                    {/* Availability Batch */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Set Availability:</span>
                      <button
                        type="button"
                        onClick={() => handleApplyGlobalAvailability('Available')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', color: 'var(--success-text)' }}
                      >
                        All Available
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyGlobalAvailability('Available on Order')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', color: 'var(--warning-text)' }}
                      >
                        All on Order
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items Table with Rate & Availability */}
                <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                  <table className="table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '32%' }}>Material Item & Spec</th>
                        <th style={{ width: '10%' }}>Quantity</th>
                        <th style={{ width: '22%' }}>Availability Status *</th>
                        <th style={{ width: '14%' }}>Unit Rate Ex-GST (₹) *</th>
                        <th style={{ width: '22%' }}>Expected Delivery & Brand Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bidItems.map((item, idx) => {
                        const isNotAvailable = item.availability === 'Not Available';
                        const lineTotal = isNotAvailable ? 0 : Number(item.qty || 0) * Number(item.rate || 0);

                        return (
                          <tr key={idx} style={{ background: isNotAvailable ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                            <td>
                              <strong style={{ fontSize: '0.9rem', color: isNotAvailable ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                {item.description}
                              </strong>
                              {item.spec && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Spec: {item.spec}
                                </div>
                              )}
                            </td>

                            <td>
                              <span style={{ fontWeight: 700 }}>{Number(parseFloat(item.qty || 0))}</span> {item.unit}
                            </td>

                            <td>
                              <select
                                className="form-control"
                                value={item.availability || 'Available'}
                                onChange={(e) => handleItemFieldChange(idx, 'availability', e.target.value)}
                                style={{
                                  fontSize: '0.82rem',
                                  padding: '0.3rem 0.5rem',
                                  fontWeight: 600,
                                  color: item.availability === 'Available' ? '#34d399' : (item.availability === 'Available on Order' ? '#f59e0b' : '#ef4444')
                                }}
                              >
                                <option value="Available">🟢 Available (In Stock)</option>
                                <option value="Available on Order">🟡 Available on Order (Will arrange)</option>
                                <option value="Not Available">🔴 Not Available (Out of stock)</option>
                              </select>
                            </td>

                            <td>
                              {isNotAvailable ? (
                                <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                                  Out of Stock
                                </span>
                              ) : (
                                <div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    required={!isNotAvailable}
                                    className="form-control"
                                    placeholder="0.00"
                                    value={item.rate || ''}
                                    onChange={(e) => handleItemFieldChange(idx, 'rate', e.target.value)}
                                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                                  />
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    Total: ₹{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                              )}
                            </td>

                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>Delivery:</span>
                                  <input
                                    type="date"
                                    className="form-control"
                                    title="Expected Delivery Date"
                                    value={item.lead_to || item.lead_from || ''}
                                    onChange={(e) => {
                                      handleItemFieldChange(idx, 'lead_to', e.target.value);
                                      handleItemFieldChange(idx, 'lead_from', e.target.value);
                                    }}
                                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.35rem', flex: 1 }}
                                  />
                                </div>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Brand make / remarks (optional)"
                                  value={item.remarks || ''}
                                  onChange={(e) => handleItemFieldChange(idx, 'remarks', e.target.value)}
                                  style={{ fontSize: '0.76rem', padding: '0.25rem 0.45rem' }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total Quote Calculation Box */}
                {(() => {
                  const subtotal = bidItems.reduce((sum, item) => {
                    if (item.availability === 'Not Available') return sum;
                    return sum + (Number(item.qty || 0) * Number(item.rate || 0));
                  }, 0);
                  const gst = Math.round(subtotal * 0.18 * 100) / 100;
                  const grandTotal = Math.round((subtotal + gst) * 100) / 100;
                  const availableCount = bidItems.filter(it => it.availability !== 'Not Available').length;

                  return (
                    <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Items Offered: <strong>{availableCount} of {bidItems.length}</strong> items available
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Standard 18% GST (9% CGST + 9% SGST) calculated automatically.
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Subtotal Ex-GST: ₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                          Grand Total (Incl. GST): ₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Modal Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setShowBidModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingBid} className="btn btn-primary" style={{ fontWeight: 700 }}>
                    <Send size={15} />
                    <span>{submittingBid ? 'Submitting...' : 'Submit Quotation to Purchase'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Vendor Dispatch Shipment Modal */}
      {dispatchModalPo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '580px', width: '100%', margin: 0, boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                  <Truck size={20} style={{ color: '#f59e0b' }} />
                  <span>Dispatch Shipment & Delivery Notice</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  PO: <strong>{dispatchModalPo.po_no}</strong> • Site: <strong>{dispatchModalPo.site_code} ({dispatchModalPo.site_name})</strong>
                </p>
              </div>
              <button onClick={() => setDispatchModalPo(null)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleConfirmDispatch}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Vendor Challan / Invoice No *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. CH-2026-9812"
                    value={dispatchForm.invoice_no}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, invoice_no: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Dispatch Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dispatchForm.dispatch_date}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, dispatch_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                <label className="form-label" style={{ color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={15} />
                  <span>Expected Delivery Date at Project Site *</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  style={{ borderColor: '#86efac', background: '#ffffff', fontWeight: 700 }}
                  value={dispatchForm.expected_delivery_date}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, expected_delivery_date: e.target.value })}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.25rem', display: 'block' }}>
                  This date will immediately notify the Site Supervisor and Project Coordinator to schedule material offloading.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Vehicle Number (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. MH-12-AB-1234"
                    value={dispatchForm.vehicle_no}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicle_no: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Transporter / Courier</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. VRL Logistics, Self"
                    value={dispatchForm.transporter}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, transporter: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Driver Contact / Dispatch Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Driver Ramesh (9822012345), full quantity loaded"
                  value={dispatchForm.dispatch_notes}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, dispatch_notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setDispatchModalPo(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submittingDispatch} className="btn btn-primary" style={{ background: '#f59e0b', borderColor: '#f59e0b', fontWeight: 700 }}>
                  <Truck size={15} />
                  <span>{submittingDispatch ? 'Dispatching...' : 'Confirm & Dispatch Shipment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Vendor Reviews Rate Revision Request & Submits Final Rates */}
      {showRevisionModal && latestRevision && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '920px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Rate Revision Request: {revisionRfq?.rfq_no}
                  </h3>
                  <span className="badge badge-issued" style={{ fontSize: '0.75rem' }}>
                    Round {latestRevision.round}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  The DDPL Purchase Department has requested a rate revision. Review the proposed rates below. You can directly <strong>Accept Revised Rates</strong>, or adjust rates and <strong>Submit Final Rate</strong> (or keep your original price).
                </p>
              </div>
              <button onClick={() => setShowRevisionModal(false)} className="close-btn">×</button>
            </div>

            {/* Manager Remarks Banner */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <AlertCircle size={18} style={{ color: '#b45309', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#b45309', fontSize: '0.85rem' }}>
                  Purchase Manager Remark (Round {latestRevision.round}):
                </strong>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {latestRevision.request_remarks || 'Please review proposed revised rates and respond with your best competitive offer.'}
                </p>
              </div>
            </div>

            {/* Item Rates Comparison Table */}
            <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Item Description</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Req. Qty</th>
                    <th style={{ width: '18%' }}>Original Quoted Rate</th>
                    <th style={{ width: '18%' }}>Manager Proposed Rate</th>
                    <th style={{ width: '24%' }}>Final Rate (₹) *</th>
                  </tr>
                </thead>
                <tbody>
                  {revisionResponseItems.map((item, idx) => {
                    const isNotAvail = item.availability === 'Not Available' || item.availability === 'Unavailable';
                    const origRate = Number(item.original_rate || 0);
                    const revRate = Number(item.revised_rate || 0);
                    const finalRate = item.final_rate !== '' ? Number(item.final_rate) : revRate;
                    const qty = Number(item.qty || 1);
                    const lineTotal = isNotAvail ? 0 : qty * finalRate;

                    return (
                      <tr key={idx} style={{ background: isNotAvail ? '#fef2f2' : 'transparent' }}>
                        <td>
                          <strong>{item.description}</strong>
                          {item.spec && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spec: {item.spec}</div>}
                          <div style={{ marginTop: '0.2rem' }}>
                            <span className="badge" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', background: isNotAvail ? '#fef2f2' : '#ecfdf5', color: isNotAvail ? '#b91c1c' : '#047857', border: `1px solid ${isNotAvail ? '#fecaca' : '#a7f3d0'}` }}>
                              {item.availability || 'Available'}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {qty} {item.unit}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                            ₹{origRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Original</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0284c7' }}>
                            ₹{revRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          {revRate < origRate && origRate > 0 && (
                            <span style={{ fontSize: '0.72rem', color: '#047857' }}>
                              (-{(((origRate - revRate) / origRate) * 100).toFixed(1)}%)
                            </span>
                          )}
                        </td>
                        <td>
                          {isNotAvail ? (
                            <span style={{ color: '#b91c1c', fontSize: '0.8rem', fontWeight: 600 }}>Not Available</span>
                          ) : (
                            <div>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="form-control"
                                value={item.final_rate}
                                onChange={(e) => handleRevisionFinalRateChange(idx, e.target.value)}
                                style={{
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                  padding: '0.35rem 0.55rem'
                                }}
                              />
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                Line Total: ₹{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Comparison */}
            {(() => {
              const origSubtotal = revisionResponseItems.reduce((sum, it) => {
                if (it.availability === 'Not Available' || it.availability === 'Unavailable') return sum;
                return sum + (Number(it.qty || 1) * Number(it.original_rate || 0));
              }, 0);
              const origGst = Math.round(origSubtotal * 0.18 * 100) / 100;
              const origGrand = Math.round((origSubtotal + origGst) * 100) / 100;

              const revSubtotal = revisionResponseItems.reduce((sum, it) => {
                if (it.availability === 'Not Available' || it.availability === 'Unavailable') return sum;
                return sum + (Number(it.qty || 1) * Number(it.revised_rate || 0));
              }, 0);
              const revGst = Math.round(revSubtotal * 0.18 * 100) / 100;
              const revGrand = Math.round((revSubtotal + revGst) * 100) / 100;

              const finalSubtotal = revisionResponseItems.reduce((sum, it) => {
                if (it.availability === 'Not Available' || it.availability === 'Unavailable') return sum;
                const r = it.final_rate !== '' ? Number(it.final_rate) : Number(it.revised_rate || 0);
                return sum + (Number(it.qty || 1) * r);
              }, 0);
              const finalGst = Math.round(finalSubtotal * 0.18 * 100) / 100;
              const finalGrand = Math.round((finalSubtotal + finalGst) * 100) / 100;

              return (
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Original Quoted Total</span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        ₹{origGrand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ex-GST: ₹{origSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Manager Proposed Total</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7' }}>
                        ₹{revGrand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ex-GST: ₹{revSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Your Final Response Total</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857' }}>
                        ₹{finalGrand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Incl. 18% GST (Ex-GST: ₹{finalSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Vendor Remarks Input */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Vendor Remarks / Notes for Purchase Manager (Optional)</label>
              <textarea
                rows="2"
                className="form-control"
                placeholder="e.g. Accepted proposed revised rates on steel, or best possible discount offered based on current raw material costs..."
                value={vendorRemarks}
                onChange={(e) => setVendorRemarks(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            {/* Dual Action Buttons: Accept Revised Rates OR Submit Final Rate */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={submittingRevision}
                  onClick={handleRejectRevision}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#dc2626', borderColor: '#fca5a5' }}
                  title="Reject revision request with remarks"
                >
                  <XCircle size={15} />
                  <span>Reject Revision</span>
                </button>

                <button
                  type="button"
                  disabled={submittingRevision}
                  onClick={handleSubmitFinalRates}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  title="Submit current rates in table (or keep original price)"
                >
                  <Send size={15} />
                  <span>{submittingRevision ? 'Submitting...' : 'Submit Final Rate'}</span>
                </button>

                <button
                  type="button"
                  disabled={submittingRevision}
                  onClick={handleAcceptRevisedRates}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, background: '#10b981', borderColor: '#10b981' }}
                  title="Accept proposed revised rates directly"
                >
                  <CheckCircle2 size={15} />
                  <span>{submittingRevision ? 'Accepting...' : 'Accept Revised Rates'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shortlisted Vendor Delivery & Dispatch Modal */}
      {reqDispatchModalRfq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', margin: 0, boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                  <Truck size={20} style={{ color: '#f59e0b' }} />
                  <span>Add Delivery Details & Dispatch Notice</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  RFQ: <strong>{reqDispatchModalRfq.rfq_no}</strong> • Request: <strong>{reqDispatchModalRfq.pr_no}</strong> • Site: <strong>{reqDispatchModalRfq.site_code} ({reqDispatchModalRfq.site_name})</strong>
                </p>
              </div>
              <button onClick={() => setReqDispatchModalRfq(null)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleConfirmRequisitionDispatch}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Vendor Challan / Invoice No *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. CH-2026-9812"
                    value={reqDispatchForm.challan_no}
                    onChange={(e) => setReqDispatchForm({ ...reqDispatchForm, challan_no: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Dispatch Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={reqDispatchForm.dispatch_date}
                    onChange={(e) => setReqDispatchForm({ ...reqDispatchForm, dispatch_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Dispatched Quantity / Items Summary</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 500 Bags OPC 53 Grade, Full order"
                  value={reqDispatchForm.dispatched_qty}
                  onChange={(e) => setReqDispatchForm({ ...reqDispatchForm, dispatched_qty: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Driver Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ramesh Patil"
                    value={reqDispatchForm.driver_name}
                    onChange={(e) => setReqDispatchForm({ ...reqDispatchForm, driver_name: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Driver Mobile / Phone No</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 9822012345"
                    value={reqDispatchForm.driver_phone}
                    onChange={(e) => setReqDispatchForm({ ...reqDispatchForm, driver_phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Vehicle / Truck Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. MH-12-AB-1234"
                    value={reqDispatchForm.vehicle_no}
                    onChange={(e) => setReqDispatchForm({ ...reqDispatchForm, vehicle_no: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Transporter / Transport Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. VRL Logistics, Self"
                    value={reqDispatchForm.transport_name}
                    onChange={(e) => setReqDispatchForm({ ...reqDispatchForm, transport_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Delivery Remarks / Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. ETA tomorrow 10 AM, full material loaded"
                  value={reqDispatchForm.dispatch_remarks}
                  onChange={(e) => setReqDispatchForm({ ...reqDispatchForm, dispatch_remarks: e.target.value })}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Saving this will mark status as <strong>Dispatched</strong> and notify Site Supervisor, Project Coordinator, and Purchase Department.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setReqDispatchModalRfq(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submittingReqDispatch} className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }}>
                  <Truck size={15} />
                  <span>{submittingReqDispatch ? 'Saving Dispatch...' : 'Confirm & Dispatch Shipment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
