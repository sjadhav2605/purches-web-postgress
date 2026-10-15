import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { requisitionService } from '../../services/requisition.service.js';
import { masterService } from '../../services/master.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatWorkflowDateTime, formatWorkflowDate } from '../../utils/dateFormatter.js';
import { 
  Plus, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Trash2, 
  Eye, 
  AlertCircle,
  Send,
  CheckSquare,
  Square,
  X,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  Truck,
  Clock,
  Package,
  Share2,
  MessageCircle,
  Copy,
  Check,
  CreditCard,
  DollarSign,
  ExternalLink
} from 'lucide-react';

export const RequisitionListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status');
  const urlTab = searchParams.get('tab') || (statusParam === 'Approved' ? 'approved' : (statusParam === 'PR Raised' || statusParam === 'Draft') ? 'pending' : 'all');

  const [requisitions, setRequisitions] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });
  const [tabCounts, setTabCounts] = useState({ all: 0, approved: 0, declined: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(urlTab);
  const [error, setError] = useState('');

  const { user, activeRole } = useAuth();
  const navigate = useNavigate();

  // Send to Vendors (Float RFQ / Purchase Approve) Modal State
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedPrForRfq, setSelectedPrForRfq] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [vendorSearch, setVendorSearch] = useState('');
  const [submittingRfq, setSubmittingRfq] = useState(false);

  // Payment Terms & Commercial Conditions State
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days Credit');
  const [advancePct, setAdvancePct] = useState(0);
  const [creditDays, setCreditDays] = useState(30);
  const [paymentTermsNotes, setPaymentTermsNotes] = useState('');
  const [modalTab, setModalTab] = useState('configure'); // 'configure' | 'share'
  const [createdRfqResult, setCreatedRfqResult] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  // Decline Modal State (Mandatory Reason for PC or Purchase Decline)
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineTargetPr, setDeclineTargetPr] = useState(null);
  const [declineActionType, setDeclineActionType] = useState('pc'); // 'pc' | 'purchase'
  const [declineReason, setDeclineReason] = useState('');
  const [submittingDecline, setSubmittingDecline] = useState(false);

  const fetchRequisitions = async (page = 1, tab = activeTab) => {
    setLoading(true);
    setError('');
    try {
      const data = await requisitionService.getRequisitions({
        page,
        limit: 10,
        search: search.trim(),
        tab: tab === 'all' ? '' : tab
      });
      setRequisitions(data.items || []);
      if (data.tabCounts) setTabCounts(data.tabCounts);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveTab(urlTab);
    fetchRequisitions(1, urlTab);
  }, [urlTab, activeRole]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowSendModal(false);
        setSelectedPrForRfq(null);
        setShowDeclineModal(false);
        setDeclineTargetPr(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams(tabKey === 'all' ? {} : { tab: tabKey });
    fetchRequisitions(1, tabKey);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRequisitions(1, activeTab);
  };

  // Open Decline Modal
  const handleOpenDeclineModal = (pr, actionType = 'pc') => {
    setDeclineTargetPr(pr);
    setDeclineActionType(actionType);
    setDeclineReason('');
    setShowDeclineModal(true);
  };

  // Submit Decline
  const handleSubmitDecline = async (e) => {
    e.preventDefault();
    if (!declineReason || !declineReason.trim()) {
      alert('A decline reason is mandatory.');
      return;
    }

    setSubmittingDecline(true);
    try {
      if (declineActionType === 'pc') {
        await requisitionService.coordinatorDecline(declineTargetPr.id, declineReason.trim());
      } else {
        await requisitionService.purchaseDecline(declineTargetPr.id, declineReason.trim());
      }
      setShowDeclineModal(false);
      setDeclineTargetPr(null);
      setDeclineReason('');
      fetchRequisitions(pagination.currentPage, activeTab);
    } catch (err) {
      alert(err.message || 'Failed to decline request');
    } finally {
      setSubmittingDecline(false);
    }
  };

  // Coordinator Quick Approve
  const handleCoordinatorApprove = async (pr) => {
    if (!window.confirm(`Approve Request ${pr.pr_no} and forward to Purchase Department?`)) return;
    try {
      await requisitionService.coordinatorApprove(pr.id);
      fetchRequisitions(pagination.currentPage, activeTab);
    } catch (err) {
      alert(err.message || 'Failed to approve request');
    }
  };

  const applyPaymentPreset = (presetKey) => {
    switch (presetKey) {
      case 'adv_credit_20_30':
        setPaymentTerms('Advance + Credit');
        setAdvancePct(20);
        setCreditDays(30);
        setPaymentTermsNotes('20% advance upon PO confirmation, balance payment within 30 days of site receipt verification.');
        break;
      case 'adv_credit_10_30':
        setPaymentTerms('Advance + Credit');
        setAdvancePct(10);
        setCreditDays(30);
        setPaymentTermsNotes('10% advance upon PO confirmation, balance payment within 30 days of site receipt verification.');
        break;
      case 'delivery_100':
        setPaymentTerms('100% on Site Delivery');
        setAdvancePct(0);
        setCreditDays(0);
        setPaymentTermsNotes('100% payment via RTGS/NEFT within 3 days of verified material delivery at site.');
        break;
      case 'net_15':
        setPaymentTerms('Net 15 Days Credit');
        setAdvancePct(0);
        setCreditDays(15);
        setPaymentTermsNotes('100% payment within 15 days of verified delivery challan and invoice submission.');
        break;
      case 'net_30':
        setPaymentTerms('Net 30 Days Credit');
        setAdvancePct(0);
        setCreditDays(30);
        setPaymentTermsNotes('100% payment within 30 days of verified delivery challan and invoice submission.');
        break;
      case 'net_45':
        setPaymentTerms('Net 45 Days Credit');
        setAdvancePct(0);
        setCreditDays(45);
        setPaymentTermsNotes('100% payment within 45 days of verified delivery challan and invoice submission.');
        break;
      case 'net_60':
        setPaymentTerms('Net 60 Days Credit');
        setAdvancePct(0);
        setCreditDays(60);
        setPaymentTermsNotes('100% payment within 60 days of verified delivery challan and invoice submission.');
        break;
      default:
        setPaymentTerms('Custom Terms');
        break;
    }
  };

  // Open Send to Vendors (Purchase Approve) & Payment Terms Modal
  const handleOpenSendModal = async (pr, startInShare = false) => {
    setSelectedPrForRfq(pr);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDeadline(pr.linked_rfq_deadline ? String(pr.linked_rfq_deadline).split('T')[0] : d.toISOString().split('T')[0]);
    setVendorSearch('');

    const initialPt = pr.payment_terms || pr.rfq_payment_terms || 'Net 30 Days Credit';
    const initialAdv = pr.advance_pct !== undefined ? Number(pr.advance_pct) : (pr.rfq_advance_pct !== undefined ? Number(pr.rfq_advance_pct) : 0);
    const initialCd = pr.credit_days !== undefined ? Number(pr.credit_days) : (pr.rfq_credit_days !== undefined ? Number(pr.rfq_credit_days) : 30);
    const initialNotes = pr.payment_terms_notes || '';

    setPaymentTerms(initialPt);
    setAdvancePct(initialAdv);
    setCreditDays(initialCd);
    setPaymentTermsNotes(initialNotes);

    const hasRfq = Boolean(pr.linked_rfq_id || pr.linked_rfq_no || ['Purchase Approved', 'RFQ Sent', 'Bids In', 'Vendor Quotes / Revision', 'Shortlisted', 'Vendor Shortlisted', 'Approved', 'Director Approved', 'PO Issued'].includes(pr.status));

    if (startInShare || hasRfq) {
      setModalTab('share');
      setCreatedRfqResult({
        rfq_id: pr.linked_rfq_id,
        rfq_no: pr.linked_rfq_no || 'RFQ Active',
        payment_terms: initialPt,
        advance_pct: initialAdv,
        credit_days: initialCd,
        payment_terms_notes: initialNotes
      });
    } else {
      setModalTab('configure');
      setCreatedRfqResult(null);
    }

    setShowSendModal(true);
    try {
      const data = await masterService.getVendors();
      const list = data || [];
      setVendors(list);
      setSelectedVendorIds(list.map((v) => v.id));
    } catch (e) {
      console.error('Error fetching vendors:', e);
    }
  };

  const getWhatsAppMessage = (vendor = null) => {
    const pr = selectedPrForRfq;
    if (!pr) return '';
    const rfqNo = createdRfqResult?.rfq_no || pr.linked_rfq_no || 'RFQ Generated';
    const siteName = pr.site_name ? `${pr.site_code ? pr.site_code + ' - ' : ''}${pr.site_name}` : (pr.site_code || 'Site Project');
    const itemsSummary = pr.material_items_summary || (pr.total_items ? `${pr.total_items} items` : 'Requested Material Items');
    const adv = Number(advancePct || 0);
    const cd = Number(creditDays || 30);
    const pt = paymentTerms || 'Net 30 Days Credit';
    const vendorSalutation = vendor?.name ? `*${vendor.name}*` : 'Valued Vendor / Supplier';
    const baseUrl = window.location.origin;
    const rfqIdForLink = createdRfqResult?.rfq_id || pr.linked_rfq_id;
    const quoteUrl = `${baseUrl}/vendor-portal${rfqIdForLink ? `?rfq_id=${rfqIdForLink}` : ''}`;

    return `🏗️ *DECENT DECOR PVT. LTD. (DDPL)*
*REQUEST FOR QUOTATION (RFQ)*

Hello ${vendorSalutation},
Please provide your most competitive quotation for the following procurement request:

📋 *PR No:* ${pr.pr_no}
⚡ *RFQ No:* ${rfqNo}
📍 *Delivery Site:* ${siteName}
📦 *Materials Requested:* ${itemsSummary}
⏰ *Submission Deadline:* ${deadline || (pr.required_by_date ? formatWorkflowDate(pr.required_by_date) : 'Earliest')}

💰 *Commercial & Payment Terms Offered:*
• *Advance Payment:* ${adv}% ${adv > 0 ? '(Disbursed on PO confirmation)' : '(Nil Advance)'}
• *Credit Period:* ${cd} Days
• *Payment Terms:* ${pt}${paymentTermsNotes ? `\n• *Special Notes:* ${paymentTermsNotes}` : ''}

🔗 *Submit Your Quotation Online:*
${quoteUrl}

Please submit your rates and delivery availability before the deadline.
Thank you,
*DDPL Purchase Department*`;
  };

  const handleSendRfqSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedPrForRfq) return;
    if (selectedVendorIds.length === 0) {
      alert('Please select at least one vendor from the list to send this RFQ to.');
      return;
    }

    setSubmittingRfq(true);
    try {
      const res = await requisitionService.purchaseApprove(selectedPrForRfq.id, {
        vendor_ids: selectedVendorIds,
        deadline: deadline || null,
        payment_terms: paymentTerms,
        advance_pct: Number(advancePct || 0),
        credit_days: Number(creditDays || 30),
        payment_terms_notes: paymentTermsNotes,
        remarks: 'RFQ sent from Purchase Department'
      });

      const rfqId = res?.rfq_id || res?.linked_rfq_id;
      const rfqNo = res?.rfq_no || res?.linked_rfq_no || 'RFQ Created';

      const created = {
        rfq_id: rfqId,
        rfq_no: rfqNo,
        payment_terms: paymentTerms,
        advance_pct: Number(advancePct || 0),
        credit_days: Number(creditDays || 30),
        payment_terms_notes: paymentTermsNotes
      };
      setCreatedRfqResult(created);

      setModalTab('share');
      fetchRequisitions(pagination.currentPage, activeTab);
      return created;
    } catch (err) {
      alert(err.message || 'Failed to send RFQ');
      return null;
    } finally {
      setSubmittingRfq(false);
    }
  };

  const handleShareToVendorWhatsApp = async (vendor = null) => {
    let currentRfq = createdRfqResult;
    if (!currentRfq?.rfq_id && !selectedPrForRfq?.linked_rfq_id) {
      const confirmCreate = window.confirm(
        'RFQ has not been floated in the system yet. Would you like to create and float the RFQ to vendors now so they can view and submit rates online?'
      );
      if (!confirmCreate) return;
      currentRfq = await handleSendRfqSubmit();
      if (!currentRfq) return;
    }

    const text = getWhatsAppMessage(vendor);
    let phone = vendor?.phone ? String(vendor.phone).replace(/\D/g, '') : '';
    if (phone.length === 10) {
      phone = '91' + phone;
    }
    const url = phone 
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const filteredVendors = vendors.filter((v) => {
    if (!vendorSearch.trim()) return true;
    const q = vendorSearch.toLowerCase();
    return (v.name && v.name.toLowerCase().includes(q)) ||
           (v.phone && v.phone.includes(q)) ||
           (v.email && v.email.toLowerCase().includes(q));
  });

  const handleDelete = async (id, prNo) => {
    if (!window.confirm(`Are you sure you want to delete ${prNo}?`)) return;
    try {
      await requisitionService.deleteRequisition(id);
      fetchRequisitions(pagination.currentPage, activeTab);
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status, pr = {}) => {
    switch (status) {
      case 'Draft': 
        return <span className="badge badge-draft">Draft</span>;
      case 'Raised':
      case 'PR Raised':
      case 'Pending PC Approval':
        return (
          <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 600 }}>
            ⏳ Raised
          </span>
        );
      case 'Coordinator Approved':
      case 'Sent to Purchase':
        return (
          <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600 }}>
            📨 Sent to Purchase
          </span>
        );
      case 'Coordinator Declined':
        return (
          <span className="badge badge-rejected" title={pr.decline_reason ? `Reason: ${pr.decline_reason}` : ''}>
            ✕ Coordinator Declined
          </span>
        );
      case 'Purchase Approved':
      case 'RFQ Sent':
        return (
          <span className="badge badge-issued" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', fontWeight: 600 }}>
            ⚡ RFQ Sent
          </span>
        );
      case 'Purchase Declined':
        return (
          <span className="badge badge-rejected" title={pr.decline_reason ? `Reason: ${pr.decline_reason}` : ''}>
            ✕ Purchase Declined
          </span>
        );
      case 'Bids In':
      case 'Vendor Quotes / Revision':
        return (
          <span className="badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 600 }}>
            📋 Vendor Quotes / Revision
          </span>
        );
      case 'Vendor Accepted':
        return (
          <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 600 }}>
            ✓ Vendor Accepted
          </span>
        );
      case 'Director Approved':
      case 'Approved':
        return (
          <span className="badge badge-approved" style={{ fontWeight: 600 }}>
            ★ Director Approved
          </span>
        );
      case 'Director Declined':
        return (
          <span className="badge badge-rejected" title={pr.decline_reason ? `Reason: ${pr.decline_reason}` : ''}>
            ✕ Director Declined
          </span>
        );
      case 'Vendor Shortlisted':
      case 'Shortlisted':
        return (
          <span className="badge badge-issued" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', fontWeight: 600 }}>
            🏆 Shortlisted
          </span>
        );
      case 'Dispatched':
        return (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span className="badge badge-verified" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7', fontWeight: 600 }}>
              🚚 Dispatched
            </span>
            {pr.dispatch_date && (
              <span style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>
                {formatWorkflowDate(pr.dispatch_date)}
              </span>
            )}
          </div>
        );
      case 'Received':
      case 'Site Verified':
        return (
          <span className="badge badge-verified" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 600 }}>
            ✓ Received at Site
          </span>
        );
      default:
        return <span className="badge badge-draft">{status}</span>;
    }
  };

  return (
    <div>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Material Requests</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Track site procurement requests, role approval workflows, and delivery status.
          </p>
        </div>

        {['admin', 'pc', 'supervisor', 'purchase'].includes(activeRole || user?.role) && (
          <Link to="/requisitions/new" className="btn btn-primary">
            <Plus size={18} />
            <span>Raise New Request</span>
          </Link>
        )}
      </div>

      {/* Role Dashboard Tabs with Count Badges */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.25rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            background: activeTab === 'all' ? 'var(--primary-600)' : 'transparent',
            color: activeTab === 'all' ? '#ffffff' : 'var(--text-primary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem'
          }}
        >
          <span>All Requests</span>
          <span style={{
            background: activeTab === 'all' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
            color: activeTab === 'all' ? '#ffffff' : '#334155',
            padding: '0.15rem 0.45rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            {tabCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('pending')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            background: activeTab === 'pending' ? '#d97706' : 'transparent',
            color: activeTab === 'pending' ? '#ffffff' : 'var(--text-primary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem'
          }}
        >
          <span>Pending Action</span>
          <span style={{
            background: activeTab === 'pending' ? 'rgba(255,255,255,0.25)' : '#fef3c7',
            color: activeTab === 'pending' ? '#ffffff' : '#92400e',
            padding: '0.15rem 0.45rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            {tabCounts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('approved')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            background: activeTab === 'approved' ? '#059669' : 'transparent',
            color: activeTab === 'approved' ? '#ffffff' : 'var(--text-primary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem'
          }}
        >
          <span>Approved</span>
          <span style={{
            background: activeTab === 'approved' ? 'rgba(255,255,255,0.25)' : '#dcfce7',
            color: activeTab === 'approved' ? '#ffffff' : '#166534',
            padding: '0.15rem 0.45rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            {tabCounts.approved}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('declined')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            background: activeTab === 'declined' ? '#dc2626' : 'transparent',
            color: activeTab === 'declined' ? '#ffffff' : 'var(--text-primary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem'
          }}
        >
          <span>Declined</span>
          <span style={{
            background: activeTab === 'declined' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
            color: activeTab === 'declined' ? '#ffffff' : '#991b1b',
            padding: '0.15rem 0.45rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            {tabCounts.declined}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by Request No, category, remarks, or site..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <button type="submit" className="btn btn-secondary">
            <span>Filter</span>
          </button>
        </form>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Request No</th>
                <th>Site / Location</th>
                <th>Material Items</th>
                <th>Required-by Date</th>
                <th>Raised By</th>
                <th>Raised Date & Time</th>
                <th>Current Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Loading requests...</div>
                  </td>
                </tr>
              ) : requisitions.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <FileText size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No requests found</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Try clearing your search or selecting a different tab.</p>
                  </td>
                </tr>
              ) : (
                requisitions.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          if (['purchase', 'admin'].includes(activeRole || user?.role)) {
                            handleOpenSendModal(pr);
                          } else {
                            navigate(`/requisitions/${pr.id}`);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontWeight: 700,
                          color: 'var(--primary-600)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.92rem',
                          textDecoration: 'underline'
                        }}
                        title="Click to open PR, configure payment terms, or send/share with vendors"
                      >
                        {pr.pr_no}
                      </button>
                      {(Number(pr.advance_pct || pr.rfq_advance_pct || 0) > 0 || (pr.credit_days && pr.credit_days !== 30)) && (
                        <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                          {pr.advance_pct || pr.rfq_advance_pct}% Adv • {pr.credit_days || pr.rfq_credit_days || 30}d
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{pr.site_code}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pr.site_name}</div>
                    </td>
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {pr.total_items} items
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pr.material_items_summary || ''}>
                        {pr.material_items_summary || 'General materials'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{formatWorkflowDate(pr.required_by_date)}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{pr.requested_by_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{pr.requested_by_role}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {formatWorkflowDateTime(pr.created_at)}
                      </div>
                    </td>
                    <td>
                      {getStatusBadge(pr.status, pr)}
                      {(pr.target_director_name || pr.approved_by) && ['Shortlisted', 'Director Approved', 'Vendor Shortlisted', 'PO Issued', 'Approved'].includes(pr.status) && (
                        <div style={{ marginTop: '0.2rem' }}>
                          <span className="badge" style={{ fontSize: '0.68rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600 }}>
                            🏛️ {pr.target_director_name || pr.approved_by}
                          </span>
                        </div>
                      )}
                      {pr.decline_reason && ['Coordinator Declined', 'Purchase Declined', 'Director Declined'].includes(pr.status) && (
                        <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '0.2rem', maxWidth: '180px' }} title={pr.decline_reason}>
                          Reason: {pr.decline_reason}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        {/* Project Coordinator actions on 'Raised' / 'Pending PC Approval' */}
                        {['Raised', 'Pending PC Approval', 'PR Raised'].includes(pr.status) && ['pc', 'admin'].includes(activeRole) && (
                          <>
                            <button
                              onClick={() => handleCoordinatorApprove(pr)}
                              className="btn btn-sm"
                              style={{ 
                                background: '#ecfdf5', 
                                color: '#047857', 
                                border: '1px solid #a7f3d0',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.3rem 0.6rem'
                              }}
                              title="Approve & Send to Purchase Department"
                            >
                              <CheckCircle2 size={13} />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleOpenDeclineModal(pr, 'pc')}
                              className="btn btn-sm"
                              style={{ 
                                background: '#fef2f2', 
                                color: '#b91c1c', 
                                border: '1px solid #fecaca',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.3rem 0.5rem'
                              }}
                              title="Decline Request (Reason Required)"
                            >
                              <XCircle size={13} />
                              <span>Decline</span>
                            </button>
                          </>
                        )}

                        {/* Purchase Department actions on ANY active request */}
                        {['purchase', 'admin'].includes(activeRole || user?.role) && (
                          <>
                            {/* If RFQ not yet created/sent, show primary Send RFQ & Terms button ONLY when approved by PC */}
                            {['Sent to Purchase', 'Coordinator Approved'].includes(pr.status) && (
                              <button
                                onClick={() => handleOpenSendModal(pr)}
                                className="btn btn-primary btn-sm"
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.35rem', 
                                  padding: '0.32rem 0.65rem', 
                                  fontWeight: 700,
                                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                                }}
                                title="Open PR to configure payment terms, credit days, advance % and send RFQ to vendors"
                              >
                                <Send size={13} />
                                <span>Send RFQ & Terms</span>
                              </button>
                            )}

                            {/* If RFQ is already active / sent, show Share to Vendors button */}
                            {['Purchase Approved', 'RFQ Sent', 'Bids In', 'Vendor Quotes / Revision', 'Shortlisted', 'Vendor Shortlisted', 'Approved', 'Director Approved', 'PO Issued'].includes(pr.status) && (
                              <button
                                onClick={() => handleOpenSendModal(pr, true)}
                                className="btn btn-sm"
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.35rem', 
                                  padding: '0.32rem 0.65rem', 
                                  fontWeight: 700,
                                  background: '#ecfdf5',
                                  color: '#047857',
                                  border: '1px solid #a7f3d0'
                                }}
                                title="Share RFQ and Payment Terms with Vendors via WhatsApp or Direct Link"
                              >
                                <Share2 size={13} />
                                <span>Share RFQ</span>
                              </button>
                            )}

                            {['Sent to Purchase', 'Coordinator Approved'].includes(pr.status) && (
                              <button
                                onClick={() => handleOpenDeclineModal(pr, 'purchase')}
                                className="btn btn-sm"
                                style={{ 
                                  background: '#fef2f2', 
                                  color: '#b91c1c', 
                                  border: '1px solid #fecaca',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.3rem 0.5rem'
                                }}
                                title="Decline Request (Reason Required)"
                              >
                                <XCircle size={13} />
                                <span>Decline</span>
                              </button>
                            )}
                          </>
                        )}

                        {/* Site Supervisor mark as received if dispatched */}
                        {pr.status === 'Dispatched' && ['supervisor', 'admin'].includes(activeRole) && (
                          <button
                            onClick={() => navigate(`/requisitions/${pr.id}`)}
                            className="btn btn-sm"
                            style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Mark as Received & Upload Proof"
                          >
                            <Package size={13} />
                            <span>Mark Received</span>
                          </button>
                        )}

                        <button
                          onClick={() => navigate(`/requisitions/${pr.id}`)}
                          className="btn btn-secondary btn-sm"
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>

                        {user?.role === 'admin' && activeRole === 'admin' && (
                          <button
                            onClick={() => handleDelete(pr.id, pr.pr_no)}
                            className="btn btn-danger btn-sm"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!loading && pagination.totalPages > 1 && (
          <div className="pagination" style={{ padding: '1rem 1.5rem', margin: 0 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalItems} total requests)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={pagination.currentPage <= 1}
                onClick={() => fetchRequisitions(pagination.currentPage - 1, activeTab)}
                className="btn btn-secondary btn-sm"
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <button
                disabled={pagination.currentPage >= pagination.totalPages}
                onClick={() => fetchRequisitions(pagination.currentPage + 1, activeTab)}
                className="btn btn-secondary btn-sm"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Decline Reason Modal (Mandatory reason required) */}
      {showDeclineModal && declineTargetPr && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#b91c1c' }}>
                  Decline Request: {declineTargetPr.pr_no}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Declining requires a mandatory reason that will be logged and notified to the team.
                </p>
              </div>
              <button onClick={() => setShowDeclineModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleSubmitDecline}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Decline Reason *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  required
                  placeholder="Specify why this material request is being declined (e.g. Budget exceeded, insufficient stock justification, site clarification required)..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDeclineModal(false)}
                  className="btn btn-secondary"
                  disabled={submittingDecline}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={submittingDecline || !declineReason.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <XCircle size={15} />
                  <span>{submittingDecline ? 'Declining...' : 'Confirm Decline'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send to Vendors / Float RFQ & Configure Payment Terms & Share Modal */}
      {showSendModal && selectedPrForRfq && (
        <div 
          onClick={() => { setShowSendModal(false); setSelectedPrForRfq(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem', cursor: 'pointer' }}
        >
          <div 
            className="card" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '840px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: 0, cursor: 'default' }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Material Request {selectedPrForRfq.pr_no}
                  </h3>
                  <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700 }}>
                    {selectedPrForRfq.status}
                  </span>
                  {(createdRfqResult?.rfq_no || selectedPrForRfq.linked_rfq_no) && (
                    <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}>
                      ⚡ {createdRfqResult?.rfq_no || selectedPrForRfq.linked_rfq_no}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
                  Site: <strong>{selectedPrForRfq.site_code} - {selectedPrForRfq.site_name}</strong> • Items: <strong>{selectedPrForRfq.material_items_summary || `${selectedPrForRfq.total_items} items`}</strong>
                </p>
              </div>
              <button 
                onClick={() => { setShowSendModal(false); setSelectedPrForRfq(null); }} 
                className="close-btn"
                style={{ fontSize: '1.4rem', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#ffffff', padding: '0 1rem' }}>
              <button
                type="button"
                onClick={() => setModalTab('configure')}
                style={{
                  padding: '0.75rem 1.25rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: modalTab === 'configure' ? '3px solid var(--primary-600)' : '3px solid transparent',
                  color: modalTab === 'configure' ? 'var(--primary-600)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.9rem'
                }}
              >
                <CreditCard size={16} />
                <span>1. Payment Terms & Target Vendors</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('share')}
                style={{
                  padding: '0.75rem 1.25rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: modalTab === 'share' ? '3px solid #059669' : '3px solid transparent',
                  color: modalTab === 'share' ? '#059669' : 'var(--text-secondary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.9rem'
                }}
              >
                <Share2 size={16} />
                <span>2. Share with Vendors (WhatsApp & Link)</span>
                {(createdRfqResult || selectedPrForRfq.linked_rfq_no) && (
                  <span style={{ background: '#dcfce7', color: '#166534', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>Ready</span>
                )}
              </button>
            </div>

            {/* TAB 1: CONFIGURE PAYMENT TERMS & SEND RFQ */}
            {modalTab === 'configure' && (
              <form onSubmit={handleSendRfqSubmit} style={{ padding: '1.25rem 1.5rem' }}>
                {/* PAYMENT TERMS & ADVANCE / CREDIT PERIOD SECTION */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <div style={{ background: '#eff6ff', color: '#2563eb', padding: '0.35rem', borderRadius: '6px' }}>
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Commercial & Payment Terms (व्हेंडरला दिसणाऱ्या अटी)
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Set advance payment %, credit period, and payment terms for vendors.
                        </span>
                      </div>
                    </div>

                    <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>
                      ✓ Vendors will see this on RFQ portal
                    </span>
                  </div>

                  {/* Preset Quick Chips */}
                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                      Select Quick Term Presets:
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => applyPaymentPreset('adv_credit_20_30')}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.76rem',
                          padding: '0.25rem 0.55rem',
                          background: advancePct === 20 && creditDays === 30 ? '#eff6ff' : '#ffffff',
                          color: advancePct === 20 && creditDays === 30 ? '#1d4ed8' : '#334155',
                          border: advancePct === 20 && creditDays === 30 ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                          fontWeight: 600
                        }}
                      >
                        ⚡ 20% Adv + 30 Days Credit
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPaymentPreset('adv_credit_10_30')}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.76rem',
                          padding: '0.25rem 0.55rem',
                          background: advancePct === 10 && creditDays === 30 ? '#eff6ff' : '#ffffff',
                          color: advancePct === 10 && creditDays === 30 ? '#1d4ed8' : '#334155',
                          border: advancePct === 10 && creditDays === 30 ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                          fontWeight: 600
                        }}
                      >
                        ⚡ 10% Adv + 30 Days Credit
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPaymentPreset('net_30')}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.76rem',
                          padding: '0.25rem 0.55rem',
                          background: advancePct === 0 && creditDays === 30 ? '#eff6ff' : '#ffffff',
                          color: advancePct === 0 && creditDays === 30 ? '#1d4ed8' : '#334155',
                          border: advancePct === 0 && creditDays === 30 ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                          fontWeight: 600
                        }}
                      >
                        Net 30 Days Credit
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPaymentPreset('net_15')}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.76rem',
                          padding: '0.25rem 0.55rem',
                          background: advancePct === 0 && creditDays === 15 ? '#eff6ff' : '#ffffff',
                          color: advancePct === 0 && creditDays === 15 ? '#1d4ed8' : '#334155',
                          border: advancePct === 0 && creditDays === 15 ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                          fontWeight: 600
                        }}
                      >
                        Net 15 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPaymentPreset('net_45')}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.76rem',
                          padding: '0.25rem 0.55rem',
                          background: advancePct === 0 && creditDays === 45 ? '#eff6ff' : '#ffffff',
                          color: advancePct === 0 && creditDays === 45 ? '#1d4ed8' : '#334155',
                          border: advancePct === 0 && creditDays === 45 ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                          fontWeight: 600
                        }}
                      >
                        Net 45 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPaymentPreset('delivery_100')}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.76rem',
                          padding: '0.25rem 0.55rem',
                          background: advancePct === 0 && creditDays === 0 ? '#eff6ff' : '#ffffff',
                          color: advancePct === 0 && creditDays === 0 ? '#1d4ed8' : '#334155',
                          border: advancePct === 0 && creditDays === 0 ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                          fontWeight: 600
                        }}
                      >
                        100% on Delivery
                      </button>
                    </div>
                  </div>

                  {/* Form Inputs Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    {/* Advance Payment % */}
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        Advance Payment (%):
                      </label>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          className="form-control"
                          value={advancePct}
                          onChange={(e) => setAdvancePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          style={{ fontWeight: 700 }}
                          required
                        />
                        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem' }}>
                        {[0, 10, 20, 25, 50].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAdvancePct(val)}
                            className="btn btn-sm"
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.15rem 0.35rem',
                              background: advancePct === val ? '#2563eb' : '#e2e8f0',
                              color: advancePct === val ? '#ffffff' : '#334155',
                              border: 'none',
                              borderRadius: '4px'
                            }}
                          >
                            {val}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Credit Period (Days) */}
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        Credit Period (Days):
                      </label>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max="180"
                          step="1"
                          className="form-control"
                          value={creditDays}
                          onChange={(e) => setCreditDays(Math.max(0, Number(e.target.value) || 0))}
                          style={{ fontWeight: 700 }}
                          required
                        />
                        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Days</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem' }}>
                        {[0, 15, 30, 45, 60].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCreditDays(val)}
                            className="btn btn-sm"
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.15rem 0.35rem',
                              background: creditDays === val ? '#2563eb' : '#e2e8f0',
                              color: creditDays === val ? '#ffffff' : '#334155',
                              border: 'none',
                              borderRadius: '4px'
                            }}
                          >
                            {val}d
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Payment Terms Name / Policy */}
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        Payment Terms Title:
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder="e.g. Advance + Credit, Net 30 Days"
                        required
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Label visible on Vendor portal & PO
                      </span>
                    </div>
                  </div>

                  {/* Payment Terms Special Conditions / Notes */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Commercial Notes & Conditions for Vendor (Optional):
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="e.g. 20% advance via NEFT on PO issuance, balance within 30 days of site receipt verification..."
                      value={paymentTermsNotes}
                      onChange={(e) => setPaymentTermsNotes(e.target.value)}
                    />
                  </div>

                  {/* Live Highlight Banner */}
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '0.65rem 0.9rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', color: '#065f46' }}>
                      Vendor sees: <strong>{advancePct}% Advance</strong> • <strong>{creditDays} Days Credit</strong> • <strong>{paymentTerms}</strong>
                    </span>
                  </div>
                </div>

                {/* DEADLINE CONFIGURATION */}
                <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                    <Calendar size={15} style={{ color: 'var(--primary-600)' }} />
                    <span>Quotation Submission Deadline *</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      className="form-control"
                      style={{ maxWidth: '200px' }}
                      value={deadline}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setDeadline(e.target.value)}
                      required
                    />
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button" onClick={() => setDeadlinePreset(3)} className="btn btn-secondary btn-sm">+3 Days</button>
                      <button type="button" onClick={() => setDeadlinePreset(7)} className="btn btn-secondary btn-sm">+7 Days</button>
                      <button type="button" onClick={() => setDeadlinePreset(14)} className="btn btn-secondary btn-sm">+14 Days</button>
                    </div>
                  </div>
                </div>

                {/* VENDOR SELECTION LIST */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                      Select Target Suppliers ({selectedVendorIds.length} of {vendors.length} selected) *
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={handleToggleAllVendors}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      >
                        {selectedVendorIds.length === vendors.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>

                  <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search vendor by name, phone, or email..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      style={{ paddingLeft: '2.2rem' }}
                    />
                    <Search size={14} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>

                  <div style={{ maxHeight: '230px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem' }}>
                    {filteredVendors.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No vendors matching search
                      </div>
                    ) : (
                      filteredVendors.map((v) => {
                        const isChecked = selectedVendorIds.includes(v.id);
                        return (
                          <div
                            key={v.id}
                            onClick={() => handleToggleVendor(v.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.55rem 0.75rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: isChecked ? '#eff6ff' : 'transparent',
                              borderBottom: '1px solid #f1f5f9'
                            }}
                          >
                            {isChecked ? (
                              <CheckSquare size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                            ) : (
                              <Square size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isChecked ? 'var(--primary-700)' : 'var(--text-primary)' }}>
                                  {v.name}
                                </span>
                                {(v.advance_pct > 0 || v.credit_days) && (
                                  <span style={{ fontSize: '0.72rem', color: '#047857', background: '#ecfdf5', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                    Default: {v.advance_pct ? `${v.advance_pct}% Adv` : ''} {v.credit_days ? `${v.credit_days}d Credit` : ''}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {v.phone ? `📞 ${v.phone}` : ''} {v.email ? `• ✉️ ${v.email}` : ''} {v.gstin ? `• GST: ${v.gstin}` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => { setShowSendModal(false); setSelectedPrForRfq(null); }}
                    className="btn btn-secondary"
                    disabled={submittingRfq}
                  >
                    Cancel
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setModalTab('share')}
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Share2 size={15} />
                      <span>Preview WhatsApp Message</span>
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submittingRfq || selectedVendorIds.length === 0}
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.45rem', 
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                      }}
                    >
                      <Send size={15} />
                      <span>{submittingRfq ? 'Creating RFQ & Sending...' : `Send RFQ to ${selectedVendorIds.length} Vendor(s)`}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: SHARE VIA WHATSAPP & LINK */}
            {modalTab === 'share' && (
              <div style={{ padding: '1.25rem 1.5rem' }}>
                {/* Status Alert */}
                {!(createdRfqResult?.rfq_id || selectedPrForRfq.linked_rfq_id) ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{ background: '#f59e0b', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, color: '#92400e', fontSize: '0.98rem', fontWeight: 800 }}>
                          ⚠️ RFQ Not Floated in System Yet!
                        </h4>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: '#78350f' }}>
                          PR: <strong>{selectedPrForRfq.pr_no}</strong>. You must float this RFQ so vendors can see and submit quotes on their portal.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendRfqSubmit()}
                      disabled={submittingRfq || selectedVendorIds.length === 0}
                      className="btn btn-primary"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Send size={15} />
                      <span>{submittingRfq ? 'Floating RFQ...' : `Float RFQ to ${selectedVendorIds.length} Vendor(s) Now`}</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{ background: '#16a34a', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle2 size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, color: '#15803d', fontSize: '1rem', fontWeight: 800 }}>
                        ⚡ RFQ Active & Ready to Share with Vendors!
                      </h4>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: '#166534' }}>
                        PR: <strong>{selectedPrForRfq.pr_no}</strong> • RFQ: <strong>{createdRfqResult?.rfq_no || selectedPrForRfq.linked_rfq_no}</strong> • Terms: <strong>{advancePct}% Advance, {creditDays} Days Credit ({paymentTerms})</strong>
                      </p>
                    </div>
                  </div>
                )}

                {/* Quick Share Buttons Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => handleShareToVendorWhatsApp(null)}
                    className="btn"
                    style={{
                      background: '#25D366',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.65rem 1rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(37, 211, 102, 0.3)'
                    }}
                  >
                    <MessageCircle size={18} />
                    <span>Open WhatsApp Web / App</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyShareText(getWhatsAppMessage(null), 'WhatsApp Message')}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.65rem 1rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      borderRadius: '8px'
                    }}
                  >
                    {copyFeedback === 'WhatsApp Message' ? <Check size={18} style={{ color: '#16a34a' }} /> : <Copy size={16} />}
                    <span>{copyFeedback === 'WhatsApp Message' ? 'Message Copied!' : 'Copy Quotation Message'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const baseUrl = window.location.origin;
                      const rfqIdForLink = createdRfqResult?.rfq_id || selectedPrForRfq.linked_rfq_id;
                      const url = `${baseUrl}/vendor-portal${rfqIdForLink ? `?rfq_id=${rfqIdForLink}` : ''}`;
                      handleCopyShareText(url, 'Vendor Link');
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.65rem 1rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      borderRadius: '8px'
                    }}
                  >
                    {copyFeedback === 'Vendor Link' ? <Check size={18} style={{ color: '#16a34a' }} /> : <ExternalLink size={16} />}
                    <span>{copyFeedback === 'Vendor Link' ? 'Link Copied!' : 'Copy Vendor Portal Link'}</span>
                  </button>
                </div>

                {/* SEND TO INDIVIDUAL INVITED VENDORS VIA WHATSAPP */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    📲 One-Click Direct WhatsApp Share by Vendor:
                  </h4>

                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem' }}>
                    {vendors.filter(v => selectedVendorIds.includes(v.id)).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No vendors currently selected. Go back to Tab 1 to select vendors.
                      </div>
                    ) : (
                      vendors.filter(v => selectedVendorIds.includes(v.id)).map((v) => (
                        <div
                          key={v.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.6rem 0.85rem',
                            borderRadius: '6px',
                            background: '#f8fafc',
                            borderBottom: '1px solid #f1f5f9',
                            marginBottom: '0.35rem',
                            flexWrap: 'wrap',
                            gap: '0.5rem'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                              {v.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {v.phone ? `📞 ${v.phone}` : 'No phone specified'} {v.email ? `• ✉️ ${v.email}` : ''}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => handleShareToVendorWhatsApp(v)}
                              className="btn btn-sm"
                              style={{
                                background: '#25D366',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.35rem 0.7rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                boxShadow: '0 1px 3px rgba(37, 211, 102, 0.3)'
                              }}
                              title={`Send quote invitation message directly to ${v.name} on WhatsApp`}
                            >
                              <MessageCircle size={14} />
                              <span>WhatsApp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyShareText(getWhatsAppMessage(v), `Msg-${v.id}`)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                              title="Copy personalized quotation message"
                            >
                              {copyFeedback === `Msg-${v.id}` ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                              <span>{copyFeedback === `Msg-${v.id}` ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* WHATSAPP MESSAGE PREVIEW */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                      WhatsApp Message Preview:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyShareText(getWhatsAppMessage(null), 'Preview Msg')}
                      className="btn btn-link btn-sm"
                      style={{ fontSize: '0.75rem', padding: 0 }}
                    >
                      {copyFeedback === 'Preview Msg' ? '✓ Copied!' : 'Copy Preview'}
                    </button>
                  </div>
                  <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: '0.8rem',
                    color: '#1e293b',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}>
                    {getWhatsAppMessage(null)}
                  </pre>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setModalTab('configure')}
                    className="btn btn-secondary"
                  >
                    &larr; Back to Terms
                  </button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => { setShowSendModal(false); setSelectedPrForRfq(null); }}
                      className="btn btn-secondary"
                    >
                      Close Window
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowSendModal(false); setSelectedPrForRfq(null); }}
                      className="btn btn-primary"
                    >
                      Done & Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequisitionListPage;
