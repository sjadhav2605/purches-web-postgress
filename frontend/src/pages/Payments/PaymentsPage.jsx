import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { paymentService } from '../../services/payment.service.js';
import { poService } from '../../services/po.service.js';
import { masterService } from '../../services/master.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  CreditCard, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Eye, 
  Search, 
  Filter, 
  DollarSign, 
  FileText,
  Building2,
  Calendar,
  Check
} from 'lucide-react';

export const PaymentsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, activeRole } = useAuth();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dues'); // 'dues' | 'history'
  const [poSummaries, setPoSummaries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters for POs table
  const [search, setSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');

  // Masters for modal
  const [vendors, setVendors] = useState([]);

  // Form State for Recording Payment
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState('RTGS');
  const [referenceNo, setReferenceNo] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [summariesData, paymentsData] = await Promise.all([
        paymentService.getPoSummary().catch(() => []),
        paymentService.getPayments().catch(() => [])
      ]);
      setPoSummaries(Array.isArray(summariesData) ? summariesData : []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (e) {
      setError(e.message || 'Failed to load payments data');
    } finally {
      setLoading(false);
    }
  };

  const loadVendorsIfNeeded = async () => {
    if (vendors.length === 0) {
      try {
        const vendorsData = await masterService.getVendors().catch(() => []);
        setVendors(vendorsData || []);
      } catch (err) {
        console.error('Failed to load vendors:', err);
      }
    }
  };

  useEffect(() => {
    fetchData();
    const poParam = searchParams.get('po_id');
    if (poParam) {
      setSelectedPoId(poParam);
      loadVendorsIfNeeded();
      setShowModal(true);
    }
  }, []);

  const handlePoSelect = (poIdToSelect, list = poSummaries) => {
    setSelectedPoId(poIdToSelect);
    const chosenPo = list.find((p) => String(p.id) === String(poIdToSelect));

    if (chosenPo) {
      if (chosenPo.vendor_id) setSelectedVendorId(chosenPo.vendor_id);
      
      const balance = Number(chosenPo.balance_due || chosenPo.total_amount || 0);
      const advPct = Number(chosenPo.payment_terms?.advance_pct || 0);
      const totalAmt = Number(chosenPo.total_amount || 0);
      const advAmt = Number(chosenPo.payment_terms?.advance_amount || (totalAmt * advPct / 100));

      if (Number(chosenPo.total_paid || 0) === 0 && advAmt > 0) {
        setAmount(advAmt.toFixed(2));
        setNote(`${advPct}% Advance disbursement against PO ${chosenPo.po_no}`);
      } else {
        setAmount(balance > 0 ? balance.toFixed(2) : totalAmt.toFixed(2));
        setNote(`Payment settlement against PO ${chosenPo.po_no}`);
      }
    }
  };

  const openRecordModalForPo = (po) => {
    loadVendorsIfNeeded();
    setSelectedPoId(po.id);
    setSelectedVendorId(po.vendor_id);
    const balance = Number(po.balance_due);
    const advPct = Number(po.payment_terms?.advance_pct || 0);
    const advAmt = Number(po.payment_terms?.advance_amount || (Number(po.total_amount) * advPct / 100));

    if (Number(po.total_paid) === 0 && advAmt > 0) {
      setAmount(advAmt.toFixed(2));
      setNote(`${advPct}% Advance payment against PO ${po.po_no}`);
    } else {
      setAmount(balance > 0 ? balance.toFixed(2) : Number(po.total_amount).toFixed(2));
      setNote(`Payment disbursement against PO ${po.po_no}`);
    }
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedPoId || !selectedVendorId) {
      alert('Please select both Purchase Order and Vendor');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setSubmitting(true);
    try {
      await paymentService.recordPayment({
        po_id: Number(selectedPoId),
        vendor_id: Number(selectedVendorId),
        amount: Number(amount),
        payment_date: paymentDate,
        mode,
        reference_no: referenceNo.trim(),
        note: note.trim()
      });
      setShowModal(false);
      setReferenceNo('');
      setSuccessMsg(`Payment of ₹${Number(amount).toLocaleString()} recorded successfully!`);
      setTimeout(() => setSuccessMsg(''), 5000);
      await fetchData();
    } catch (e) {
      alert(e.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations for KPIs
  const totalPoValue = poSummaries.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const totalDisbursed = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalBalanceDue = poSummaries.reduce((sum, p) => sum + Number(p.balance_due || 0), 0);
  const pendingOrdersCount = poSummaries.filter((p) => Number(p.balance_due || 0) > 0).length;

  // Filtered POs
  const filteredPOs = poSummaries.filter((po) => {
    const matchesSearch = !search.trim() || 
      po.po_no.toLowerCase().includes(search.toLowerCase()) ||
      (po.vendor_name && po.vendor_name.toLowerCase().includes(search.toLowerCase())) ||
      (po.site_code && po.site_code.toLowerCase().includes(search.toLowerCase())) ||
      (po.pr_no && po.pr_no.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = !paymentStatusFilter || po.payment_status === paymentStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Selected PO details in modal
  const activeModalPo = poSummaries.find((p) => String(p.id) === String(selectedPoId));

  const getPaymentBadge = (status) => {
    switch (status) {
      case 'Paid':
        return <span className="badge badge-verified" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>Paid</span>;
      case 'Partially Paid':
        return <span className="badge badge-warning" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>Partially Paid</span>;
      case 'Unpaid':
      default:
        return <span className="badge badge-draft" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Unpaid</span>;
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Accounts & Vendor Payments
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Purchase order payment tracking, advance settlement, RTGS/NEFT UTR reference logs.
          </p>
        </div>

        <button 
          onClick={() => { 
            loadVendorsIfNeeded(); 
            if (poSummaries.length > 0 && !selectedPoId) {
              handlePoSelect(poSummaries[0].id);
            }
            setShowModal(true); 
          }} 
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
        >
          <Plus size={18} />
          <span>Record Payment</span>
        </button>
      </div>

      {successMsg && (
        <div style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '0.9rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #a7f3d0' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '0.9rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #fca5a5' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Orders Value */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Total Purchase Value
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ₹{totalPoValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Across {poSummaries.length} Purchase Orders
            </div>
          </div>
        </div>

        {/* Total Disbursed */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Total Disbursed (Paid)
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>
              ₹{totalDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {payments.length} Transactions Logged
            </div>
          </div>
        </div>

        {/* Total Outstanding Dues */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Outstanding Balance Due
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#b45309' }}>
              ₹{totalBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {pendingOrdersCount} Orders Pending Full Settlement
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border-color)', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setActiveTab('dues')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'dues' ? '3px solid var(--primary-600)' : '3px solid transparent',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            color: activeTab === 'dues' ? 'var(--primary-600)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '-2px'
          }}
        >
          <CreditCard size={18} />
          <span>Purchase Orders & Dues</span>
          <span style={{ 
            background: activeTab === 'dues' ? 'var(--primary-100)' : '#e2e8f0', 
            color: activeTab === 'dues' ? 'var(--primary-700)' : 'var(--text-muted)', 
            padding: '0.15rem 0.55rem', 
            borderRadius: 'var(--radius-full)', 
            fontSize: '0.75rem',
            fontWeight: 700 
          }}>
            {poSummaries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '3px solid var(--primary-600)' : '3px solid transparent',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            color: activeTab === 'history' ? 'var(--primary-600)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '-2px'
          }}
        >
          <CheckCircle2 size={18} />
          <span>Disbursement Logs (UTR / History)</span>
          <span style={{ 
            background: activeTab === 'history' ? 'var(--primary-100)' : '#e2e8f0', 
            color: activeTab === 'history' ? 'var(--primary-700)' : 'var(--text-muted)', 
            padding: '0.15rem 0.55rem', 
            borderRadius: 'var(--radius-full)', 
            fontSize: '0.75rem',
            fontWeight: 700 
          }}>
            {payments.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PURCHASE ORDERS & DUES */}
      {activeTab === 'dues' && (
        <div>
          {/* Search & Filter Bar */}
          <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by PO No, Vendor, Site, PR No..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>

              <div style={{ width: '220px' }}>
                <select
                  className="form-control"
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                >
                  <option value="">All Payment Statuses</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Paid">Fully Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* PO Dues Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Vendor / Payee</th>
                    <th>Project Site</th>
                    <th>Order Total (₹)</th>
                    <th>Payment Terms</th>
                    <th>Paid (₹)</th>
                    <th>Balance Due (₹)</th>
                    <th>Payment Status</th>
                    <th>PO Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Loading purchase orders & payment summaries...
                      </td>
                    </tr>
                  ) : filteredPOs.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '3.5rem' }}>
                        <CreditCard size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No purchase orders match your criteria</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Purchase orders created from approved requests will appear here with payment dues.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPOs.map((po) => {
                      const advPct = Number(po.payment_terms?.advance_pct || 0);
                      const credDays = Number(po.payment_terms?.credit_days || 0);
                      const advAmt = Number(po.payment_terms?.advance_amount || (Number(po.total_amount) * advPct / 100));
                      const balance = Number(po.balance_due || 0);
                      const paid = Number(po.total_paid || 0);

                      return (
                        <tr key={po.id}>
                          <td>
                            <Link to={`/orders/${po.id}`} style={{ fontWeight: 700, color: 'var(--primary-600)', textDecoration: 'none' }}>
                              {po.po_no}
                            </Link>
                            {po.pr_no && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PR: {po.pr_no}</div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{po.vendor_name}</div>
                            {po.vendor_gstin && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>GSTIN: {po.vendor_gstin}</div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{po.site_code}</span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{po.site_name}</div>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--text-primary)' }}>
                              ₹{Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <span style={{ fontSize: '0.78rem', color: advPct > 0 ? '#1e40af' : 'var(--text-secondary)' }}>
                                Advance: <strong>{advPct}%</strong> {advPct > 0 && `(₹${advAmt.toLocaleString()})`}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Credit: <strong>{credDays}d</strong> after verification
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: paid > 0 ? '#059669' : 'var(--text-muted)' }}>
                              ₹{paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td>
                            <span style={{ 
                              fontWeight: 800, 
                              color: balance > 0 ? '#dc2626' : '#059669' 
                            }}>
                              ₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td>{getPaymentBadge(po.payment_status)}</td>
                          <td>
                            <span className="badge badge-issued">{po.po_status}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => openRecordModalForPo(po)}
                                className="btn btn-primary btn-sm"
                                style={{ 
                                  background: balance > 0 ? 'var(--primary-600)' : '#10b981', 
                                  border: 'none', 
                                  color: '#fff', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.3rem',
                                  fontWeight: 600
                                }}
                                title={balance > 0 ? 'Record Payment for this PO' : 'Log additional adjustment'}
                              >
                                <CreditCard size={14} />
                                <span>{balance > 0 ? 'Pay / Record' : 'Record'}</span>
                              </button>

                              <button
                                onClick={() => navigate(`/orders/${po.id}`)}
                                className="btn btn-secondary btn-sm"
                                title="View Purchase Order Voucher"
                              >
                                <Eye size={14} />
                              </button>
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

      {/* TAB 2: DISBURSEMENT TRANSACTION LOGS */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor / Payee</th>
                  <th>Amount (₹)</th>
                  <th>Mode</th>
                  <th>UTR / Reference No</th>
                  <th>Date</th>
                  <th>Recorded By</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      Loading disbursement logs...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <CreditCard size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No payment transactions recorded yet</div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        Click "Record Payment" to log RTGS/NEFT/Cheque disbursements against a Purchase Order.
                      </p>
                      <button onClick={() => { loadModalData(); setShowModal(true); }} className="btn btn-primary btn-sm">
                        <Plus size={16} />
                        <span>Record First Payment</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/orders/${p.po_id}`} style={{ fontWeight: 700, color: 'var(--primary-600)', textDecoration: 'none' }}>
                          {p.po_no}
                        </Link>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.vendor_name}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>
                          ₹{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td><span className="badge badge-issued">{p.mode}</span></td>
                      <td><code>{p.reference_no}</code></td>
                      <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td>{p.recorded_by_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.note || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '540px', width: '100%', margin: 0, boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.4rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Record Vendor Payment
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Log RTGS, NEFT, Cheque or UPI transaction reference against a Purchase Order.
            </p>

            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Purchase Order (PO) *</label>
                <select
                  className="form-control"
                  value={selectedPoId}
                  onChange={(e) => handlePoSelect(e.target.value)}
                  required
                >
                  <option value="">-- Select Purchase Order --</option>
                  {poSummaries.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.po_no} — {p.vendor_name} (₹{Number(p.total_amount || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Breakdown Card if PO selected */}
              {activeModalPo && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>PO Total Amount:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      ₹{Number(activeModalPo.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  {activeModalPo.balance_due !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Already Disbursed:</span>
                      <strong style={{ color: '#059669' }}>
                        ₹{Number(activeModalPo.total_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  )}
                  {activeModalPo.balance_due !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '0.35rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Remaining Balance Due:</span>
                      <strong style={{ color: '#dc2626' }}>
                        ₹{Number(activeModalPo.balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Vendor (Payee) *</label>
                <select
                  className="form-control"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  required
                >
                  <option value="">-- Select Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className="form-control"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Payment Mode *</label>
                  <select className="form-control" value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="RTGS">RTGS</option>
                    <option value="NEFT">NEFT</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Bank UTR / Transaction Reference No *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC009988776655"
                  className="form-control"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Payment Date *</label>
                <input
                  type="date"
                  required
                  className="form-control"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Notes / Remarks</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Advance payment, 1st installment, etc."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Recording...' : 'Save Payment Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
