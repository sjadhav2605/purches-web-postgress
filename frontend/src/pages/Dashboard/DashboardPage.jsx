import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { requisitionService } from '@/services/requisition.service.js';
import { masterService } from '@/services/master.service.js';
import { userService } from '@/services/user.service.js';
import { 
  Building2, 
  UserPlus, 
  X, 
  FileText, 
  Layers, 
  ShoppingCart, 
  Truck, 
  ArrowRight, 
  Plus, 
  List, 
  Store 
} from 'lucide-react';
import './dashboard.css';
import {
  DashboardHeader,
  DirectorView,
  ProcurementView,
  SupervisorView,
  AccountsView
} from './components';

const emptySiteForm = { code: '', name: '', address: '', gstin: '' };
const emptyEmployeeForm = {
  name: '',
  email: '',
  phone: '',
  role: 'supervisor',
  defaultSiteId: '',
  password: 'Admin@123'
};

/**
 * Maps the global activeRole / activeRoleKey from AuthContext to the 4 dedicated Bento Views:
 * - 'purchase' -> 'procurement'
 * - 'supervisor' | 'pc' -> 'supervisor'
 * - 'accounts' -> 'accounts'
 * - 'admin' | 'director_1' | 'director_2' | 'director_3' | 'director' -> 'director'
 */
export const mapRoleToView = (role) => {
  if (!role) return 'director';
  const r = String(role).toLowerCase();
  if (r === 'admin' || r.startsWith('director')) return 'director';
  if (r === 'purchase') return 'procurement';
  if (r === 'supervisor' || r === 'pc') return 'supervisor';
  if (r === 'accounts') return 'accounts';
  return 'director';
};

/**
 * Maps the 4 Bento view keys back to valid role keys for switchRole in AuthContext:
 * - 'procurement' -> 'purchase'
 * - 'supervisor' -> 'supervisor'
 * - 'accounts' -> 'accounts'
 * - 'director' -> 'admin'
 */
export const mapViewToRole = (viewKey) => {
  switch (viewKey) {
    case 'director': return 'admin';
    case 'procurement': return 'purchase';
    case 'supervisor': return 'supervisor';
    case 'accounts': return 'accounts';
    default: return 'admin';
  }
};

export const DashboardPage = () => {
  const { user, activeRole, activeRoleKey, switchRole, currentRoleInfo } = useAuth();
  
  // Single source of truth: directly derived from the activeRole in AuthContext (set by top "View As Role" dropdown)
  const currentRole = activeRoleKey || activeRole || user?.role || 'admin';
  const activeView = mapRoleToView(currentRole);

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    pr_raised: 0,
    rfq_sent: 0,
    bids_in: 0,
    shortlisted: 0,
    approved: 0,
    po_issued: 0,
    delivered_verified: 0
  });

  // Administrative Quick Modals
  const [sites, setSites] = useState([]);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [siteForm, setSiteForm] = useState(emptySiteForm);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [savingSite, setSavingSite] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);

  const loadPipelineStats = async () => {
    try {
      const data = await requisitionService.getPipelineStats();
      if (data) setStats(data);
    } catch (e) {
      // silent fallback
    }
  };

  const loadSites = async () => {
    try {
      const data = await masterService.getSites('', true);
      setSites(data || []);
    } catch (e) {
      setSites([]);
    }
  };

  useEffect(() => {
    loadPipelineStats();
    loadSites();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [pipelineData] = await Promise.all([
        requisitionService.getPipelineStats(true).catch(() => null),
        loadSites().catch(() => null)
      ]);
      if (pipelineData) setStats(pipelineData);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // When a role or director variant is changed, synchronise both the dashboard and top navbar!
  const handleRoleChange = (key) => {
    if (!switchRole || user?.role !== 'admin') return;
    if (key.startsWith('director_') || ['admin', 'purchase', 'supervisor', 'accounts', 'pc', 'vendor'].includes(key)) {
      switchRole(key);
      return;
    }
    const targetRoleKey = mapViewToRole(key);
    switchRole(targetRoleKey);
  };

  const openEmployeeModal = async () => {
    setEmployeeForm(emptyEmployeeForm);
    setShowEmployeeModal(true);
    await loadSites();
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    setSavingSite(true);
    try {
      await masterService.createSite({
        code: siteForm.code.trim(),
        name: siteForm.name.trim(),
        address: siteForm.address.trim(),
        gstin: siteForm.gstin.trim()
      });
      setShowSiteModal(false);
      setSiteForm(emptySiteForm);
      await loadSites();
      alert('Project Site added successfully!');
    } catch (err) {
      alert(err.message || 'Failed to add site');
    } finally {
      setSavingSite(false);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!employeeForm.name.trim() || !employeeForm.email.trim()) {
      alert('Full name and email are required.');
      return;
    }
    if (!employeeForm.defaultSiteId) {
      alert('Please assign a project site for this Site Supervisor or Project Coordinator.');
      return;
    }

    setSavingEmployee(true);
    try {
      await userService.createUser({
        name: employeeForm.name.trim(),
        email: employeeForm.email.trim(),
        phone: employeeForm.phone.trim() || null,
        role: employeeForm.role,
        default_site_id: Number(employeeForm.defaultSiteId),
        password: employeeForm.password.trim() || 'Admin@123'
      });
      const roleLabel = employeeForm.role === 'pc' ? 'Project Coordinator' : 'Site Supervisor';
      alert(`${employeeForm.name.trim()} added successfully as ${roleLabel}.`);
      setShowEmployeeModal(false);
      setEmployeeForm(emptyEmployeeForm);
    } catch (err) {
      alert(err.message || 'Failed to add employee');
    } finally {
      setSavingEmployee(false);
    }
  };

  const effectiveRole = activeRole || user?.role || 'admin';
  const showRequisitions = ['admin', 'pc', 'supervisor', 'purchase', 'director'].includes(effectiveRole);
  const showRfqs = ['admin', 'purchase', 'director'].includes(effectiveRole);
  const showOrders = ['admin', 'purchase', 'director', 'accounts'].includes(effectiveRole);
  const showDeliveries = ['admin', 'supervisor', 'pc', 'purchase', 'accounts'].includes(effectiveRole);
  const showVendor = ['admin', 'purchase', 'vendor'].includes(effectiveRole);

  const totalPrs = Number(stats.pr_raised || 0) + Number(stats.approved || 0);

  return (
    <div className="bento-dashboard">
      {/* Bento Dashboard Header with Role Switcher 100% synced with View As Role */}
      <DashboardHeader
        activeRole={activeView}
        activeRoleKey={currentRole}
        onRoleChange={handleRoleChange}
        user={user}
        currentRoleTitle={currentRoleInfo?.title || ''}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* 4 Real Pipeline KPI Cards — Exactly matching Image 2 in modern Bento Grid UI */}
      <div className="bento-kpi-grid">
        {/* Card 1: Requests (PR) */}
        {showRequisitions && (
          <div className="bento-kpi-card">
            <div className="bento-kpi-top">
              <span className="bento-kpi-title">Requests (PR)</span>
              <div className="bento-kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <FileText size={19} />
              </div>
            </div>
            <div>
              <div className="bento-kpi-value">{totalPrs}</div>
              <div className="bento-kpi-trend" style={{ color: '#2563eb' }}>
                <span>{stats.approved || 0} approved</span>
              </div>
            </div>
            <div className="bento-kpi-footer">
              <span>{stats.pr_raised || 0} pending review</span>
              <Link to="/requisitions" style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>View all PRs</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}

        {/* Card 2: RFQs & Vendor Bids */}
        {showRfqs && (
          <div className="bento-kpi-card">
            <div className="bento-kpi-top">
              <span className="bento-kpi-title">RFQs &amp; Vendor Bids</span>
              <div className="bento-kpi-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <Layers size={19} />
              </div>
            </div>
            <div>
              <div className="bento-kpi-value">{stats.rfq_sent || 0}</div>
              <div className="bento-kpi-trend" style={{ color: '#7c3aed' }}>
                <span>Active RFQs in bidding</span>
              </div>
            </div>
            <div className="bento-kpi-footer">
              <span>{stats.bids_in || 0} bids received</span>
              <Link to="/rfqs" style={{ color: '#7c3aed', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>Review Bids</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}

        {/* Card 3: Purchase Orders */}
        {showOrders && (
          <div className="bento-kpi-card">
            <div className="bento-kpi-top">
              <span className="bento-kpi-title">Purchase Orders</span>
              <div className="bento-kpi-icon-wrap" style={{ background: '#fffbeb', color: '#d97706' }}>
                <ShoppingCart size={19} />
              </div>
            </div>
            <div>
              <div className="bento-kpi-value">{stats.po_issued || 0}</div>
              <div className="bento-kpi-trend" style={{ color: '#d97706' }}>
                <span>Issued purchase orders</span>
              </div>
            </div>
            <div className="bento-kpi-footer">
              <span>{stats.shortlisted || 0} in pipeline</span>
              <Link to="/orders" style={{ color: '#d97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>View Orders</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}

        {/* Card 4: Verified Deliveries */}
        {showDeliveries && (
          <div className="bento-kpi-card">
            <div className="bento-kpi-top">
              <span className="bento-kpi-title">Verified Deliveries</span>
              <div className="bento-kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Truck size={19} />
              </div>
            </div>
            <div>
              <div className="bento-kpi-value">{stats.delivered_verified || 0}</div>
              <div className="bento-kpi-trend" style={{ color: '#059669' }}>
                <span>Site verified receipts</span>
              </div>
            </div>
            <div className="bento-kpi-footer">
              <span>Gate inward verified</span>
              <Link to="/deliveries" style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>View Deliveries</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions & Workflows — Exactly matching Image 2 in modern Bento Card */}
      <div className="bento-card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⚡</span>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              Quick Actions &amp; Workflows
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Authorized operational actions for <strong style={{ color: '#0f172a' }}>{currentRoleInfo?.title || currentRole}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {currentRole === 'admin' && (
            <>
              <button
                type="button"
                onClick={() => { setSiteForm(emptySiteForm); setShowSiteModal(true); }}
                className="bento-btn bento-btn-primary"
              >
                <Building2 size={15} />
                <span>Add Project Site</span>
              </button>
              <button
                type="button"
                onClick={openEmployeeModal}
                className="bento-btn bento-btn-primary"
              >
                <UserPlus size={15} />
                <span>Add Employee</span>
              </button>
            </>
          )}

          {showRequisitions && (
            <Link to="/requisitions/new" className="bento-btn bento-btn-primary">
              <Plus size={15} />
              <span>Raise New Request (PR)</span>
            </Link>
          )}

          {showRequisitions && (
            <Link to="/requisitions" className="bento-btn bento-btn-secondary">
              <List size={15} />
              <span>View Requests</span>
            </Link>
          )}

          {showDeliveries && (
            <Link to="/deliveries" className="bento-btn bento-btn-secondary">
              <Truck size={15} />
              <span>Record Site Delivery Receipt</span>
            </Link>
          )}

          {showVendor && (
            <Link to="/vendor-portal" className="bento-btn bento-btn-secondary">
              <Store size={15} />
              <span>Vendor Portal Preview</span>
            </Link>
          )}

          {showOrders && (
            <Link to="/orders" className="bento-btn bento-btn-secondary">
              <ShoppingCart size={15} />
              <span>Review Purchase Orders</span>
            </Link>
          )}

          {showRfqs && (
            <Link to="/rfqs" className="bento-btn bento-btn-secondary">
              <Layers size={15} />
              <span>Review RFQs &amp; Bids</span>
            </Link>
          )}
        </div>
      </div>

      {/* Role-Specific Bento Grid Layout: Exactly matches whichever role is selected in "View As Role" */}
      {activeView === 'director' && <DirectorView activeRoleKey={currentRole} />}
      {activeView === 'procurement' && <ProcurementView />}
      {activeView === 'supervisor' && <SupervisorView />}
      {activeView === 'accounts' && <AccountsView />}

      {/* Add Site Modal */}
      {showSiteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="bento-card" style={{ maxWidth: '460px', width: '100%', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Add Project Site</h3>
              <button 
                type="button" 
                onClick={() => setShowSiteModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateSite} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem' }}>
              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Site Code (Short Name) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INFO-SDB7"
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                  value={siteForm.code}
                  onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Full Site Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Infosys Phase-II SDB 7"
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                  value={siteForm.name}
                  onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Complete Site Delivery Address *</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Full physical street address..."
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                  value={siteForm.address}
                  onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Site GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="27AAECD7921Q1Z2"
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                  value={siteForm.gstin}
                  onChange={(e) => setSiteForm({ ...siteForm, gstin: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowSiteModal(false)}
                  className="bento-btn bento-btn-secondary"
                  disabled={savingSite}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bento-btn bento-btn-primary"
                  disabled={savingSite}
                >
                  {savingSite ? 'Saving...' : 'Save Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showEmployeeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="bento-card" style={{ maxWidth: '500px', width: '100%', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Add Employee</h3>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Site Supervisor or Project Coordinator</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEmployeeModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem' }}>
              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                  placeholder="e.g. Ramesh Patil"
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    style={{ fontSize: '0.82rem' }}
                    placeholder="e.g. ramesh@ddpl.com"
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.82rem' }}
                    placeholder="+91 9876543210"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Role *</label>
                  <select
                    className="form-control"
                    style={{ fontSize: '0.82rem', fontWeight: 600 }}
                    value={employeeForm.role}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
                  >
                    <option value="supervisor">Site Supervisor</option>
                    <option value="pc">Project Coordinator</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Initial Password</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.82rem' }}
                    value={employeeForm.password}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                    placeholder="Admin@123"
                  />
                </div>
              </div>
              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Assign Project Site *</label>
                <select
                  required
                  className="form-control"
                  style={{ fontSize: '0.82rem', borderColor: '#93c5fd', background: '#eff6ff' }}
                  value={employeeForm.defaultSiteId}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, defaultSiteId: e.target.value })}
                >
                  <option value="">-- Select Project Site to Assign --</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                  Restricts user visibility and delivery records to this specific site.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="bento-btn bento-btn-secondary"
                  disabled={savingEmployee}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bento-btn bento-btn-primary"
                  disabled={savingEmployee}
                >
                  {savingEmployee ? 'Adding...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
