import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { rfqService } from '../../services/rfq.service.js';
import { requisitionService } from '../../services/requisition.service.js';
import { masterService } from '../../services/master.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatWorkflowDateTime } from '../../utils/dateFormatter.js';
import { FileSpreadsheet, Plus, Eye, Clock, CheckCircle2, AlertCircle, Shield, ArrowLeft } from 'lucide-react';

export const RFQsPage = () => {
  const { activeRole, user, currentRoleInfo } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || '';

  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  // Modal Master Data
  const [requisitions, setRequisitions] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Form State
  const [requisitionId, setRequisitionId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedVendors, setSelectedVendors] = useState([]);

  const fetchRfqs = async (filterToUse = urlStatus) => {
    setLoading(true);
    try {
      const data = await rfqService.getRfqs(filterToUse);
      setRfqs(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Immediate fetch on URL param change
  useEffect(() => {
    setStatusFilter(urlStatus);
    fetchRfqs(urlStatus);
  }, [urlStatus]);

  const loadCreateModalData = async () => {
    try {
      const [reqsData, vendorsData] = await Promise.all([
        requisitionService.getRequisitions({ limit: 100 }).catch(() => ({ items: [] })),
        masterService.getVendors().catch(() => [])
      ]);
      const reqList = reqsData?.items || reqsData?.data || (Array.isArray(reqsData) ? reqsData : []);
      // Only allow requisitions that have been accepted/approved by Project Coordinator
      const approvedReqs = reqList.filter(r => ['Sent to Purchase', 'Coordinator Approved'].includes(r.status));
      setRequisitions(approvedReqs);
      if (approvedReqs.length > 0) setRequisitionId(approvedReqs[0].id);
      else setRequisitionId('');

      setVendors(vendorsData || []);
      if (vendorsData && vendorsData.length > 0) {
        setSelectedVendors(vendorsData.slice(0, 2).map((v) => v.id));
      }
    } catch (err) {
      console.error('Error loading modal data:', err);
    }
  };

  const handleTabClick = (s) => {
    setStatusFilter(s);
    if (s) {
      setSearchParams({ status: s });
    } else {
      setSearchParams({});
    }
  };

  const handleVendorToggle = (vendorId) => {
    if (selectedVendors.includes(vendorId)) {
      setSelectedVendors(selectedVendors.filter((id) => id !== vendorId));
    } else {
      setSelectedVendors([...selectedVendors, vendorId]);
    }
  };

  const handleCreateRfq = async (e) => {
    e.preventDefault();
    if (!requisitionId) {
      alert('Please select a Request (PR)');
      return;
    }
    if (selectedVendors.length === 0) {
      alert('Please invite at least one vendor to bid');
      return;
    }

    try {
      await rfqService.createRfq({
        requisition_id: Number(requisitionId),
        deadline: deadline || null,
        vendor_ids: selectedVendors
      });
      setShowModal(false);
      fetchRfqs();
      alert('RFQ created and vendor bids requested successfully!');
    } catch (e) {
      alert(e.message);
    }
  };

  const effectiveRole = activeRole || user?.role || 'admin';

  // If viewed as Site Supervisor or Project Coordinator, show clear role scope restriction
  if (['supervisor', 'pc'].includes(effectiveRole)) {
    return (
      <div>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/requisitions" className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} />
            <span>Back to Requests</span>
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Request for Quotations (RFQs)</h1>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', maxWidth: '680px', margin: '2rem auto' }}>
          <Shield size={48} style={{ color: 'var(--primary-600)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            Access Restricted to Procurement Roles
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Requests for Quotation (RFQs) and commercial multi-vendor bidding are managed strictly by the <strong>Purchase Department</strong> and <strong>Director</strong>.
            <br /><br />
            As <strong>{currentRoleInfo?.title || 'Site Supervisor'}</strong>, your scope is site request management and physical material delivery receipt verification.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/requisitions" className="btn btn-primary">
              <span>Go to My Requests</span>
            </Link>
            <Link to="/deliveries" className="btn btn-secondary">
              <span>Go to Site Deliveries</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Request for Quotations (RFQ) & Bids</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Multi-vendor bidding, competitive rate comparison matrices, and L1 winner awarding.
          </p>
        </div>

        {['purchase', 'admin'].includes(effectiveRole) && (
          <button
            onClick={() => {
              loadCreateModalData();
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            <Plus size={18} />
            <span>Floating New RFQ</span>
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {[
          { key: '', label: 'All RFQs' },
          { key: 'RFQ Sent', label: 'RFQ Sent' },
          { key: 'Bids In', label: 'Bids In' },
          { key: 'Under_Review', label: 'Under Review' },
          { key: 'Approved', label: 'Approved' },
          { key: 'Closed', label: 'Closed' }
        ].map((tab) => {
          const isActive = statusFilter === tab.key || 
                           (tab.key === 'RFQ Sent' && statusFilter === 'Open') || 
                           (tab.key === 'Approved' && statusFilter === 'Awarded') ||
                           (tab.key === 'Under_Review' && statusFilter === 'Shortlisted');
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>RFQ Number</th>
                <th>Linked PR</th>
                <th>Project Site</th>
                <th>Payment Terms</th>
                <th>Sent By & Date</th>
                <th>Status</th>
                <th>Bid Deadline</th>
                <th>Bids / Vendors</th>
                <th>Winning Vendor</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading RFQs...
                  </td>
                </tr>
              ) : rfqs.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <FileSpreadsheet size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600 }}>No RFQs found</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Float a new RFQ from an approved Request to invite vendor bids.
                    </p>
                  </td>
                </tr>
              ) : (
                rfqs.map((rfq) => (
                  <tr key={rfq.id}>
                    <td>
                      <strong style={{ color: '#38bdf8' }}>{rfq.rfq_no}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Rev: {rfq.current_rev ? `RA${rfq.current_rev}` : 'Original'}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{rfq.pr_no}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{rfq.site_code || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rfq.site_name}</div>
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          💳 {rfq.payment_terms || (rfq.advance_pct > 0 ? `${rfq.advance_pct}% Adv` : 'Standard Terms')}
                        </span>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {Number(rfq.advance_pct) > 0 ? (
                            <span style={{ fontSize: '0.68rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                              {rfq.advance_pct}% Adv
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>
                              Nil Adv
                            </span>
                          )}
                          <span style={{ fontSize: '0.68rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                            {Number(rfq.credit_days) || 30}d Credit
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{rfq.created_by_name || 'Purchase Dept'}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        {rfq.created_by_role ? `(${rfq.created_by_role}) • ` : ''}{formatWorkflowDateTime(rfq.created_at)}
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${rfq.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                        {rfq.status}
                      </span>
                      {rfq.target_director_name && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <span className="badge" style={{ fontSize: '0.68rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600 }}>
                            🏛️ {rfq.target_director_name}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      {rfq.deadline ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                          <Clock size={14} />
                          {new Date(rfq.deadline).toLocaleDateString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className="badge badge-draft">
                        {rfq.bids_count !== undefined ? `${rfq.bids_count} Bid(s)` : `${Array.isArray(rfq.vendor_ids) ? rfq.vendor_ids.length : 0} Vendors`}
                      </span>
                    </td>
                    <td>
                      {rfq.winner_vendor_name ? (
                        <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <CheckCircle2 size={15} />
                          {rfq.winner_vendor_name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Pending Winner</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/rfqs/${rfq.id}`} className={`btn btn-sm ${effectiveRole === 'director' ? 'btn-primary' : 'btn-secondary'}`}>
                        <Eye size={15} />
                        <span>{effectiveRole === 'director' ? 'Review & Approve' : 'Compare Bids'}</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating RFQ Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Float Request for Quotation (RFQ)</h3>
            <form onSubmit={handleCreateRfq}>
              <div className="form-group">
                <label className="form-label">Select Request (PR) *</label>
                <select
                  className="form-control"
                  value={requisitionId}
                  onChange={(e) => setRequisitionId(e.target.value)}
                  required
                >
                  {requisitions.length === 0 ? (
                    <option value="">No requests available</option>
                  ) : (
                    requisitions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.pr_no} ({r.site_code} — {r.category}) [{r.status}]
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Bid Submission Deadline</label>
                <input
                  type="date"
                  className="form-control"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Invite Vendors to Quote *</label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', background: '#f8fafc' }}>
                  {vendors.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No vendors found in master.</div>
                  ) : (
                    vendors.map((v) => (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                          type="checkbox"
                          style={{ accentColor: 'var(--primary-600)' }}
                          checked={selectedVendors.includes(v.id)}
                          onChange={() => handleVendorToggle(v.id)}
                        />
                        <span style={{ color: 'var(--text-primary)' }}>{v.name}</span>
                        {v.phone && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({v.phone})</span>}
                      </label>
                    ))
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {selectedVendors.length} vendor(s) selected
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Float RFQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
