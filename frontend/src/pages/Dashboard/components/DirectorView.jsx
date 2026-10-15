import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Check, 
  X, 
  Clock, 
  ShieldCheck, 
  ExternalLink, 
  ChevronRight 
} from 'lucide-react';
import { Link } from 'react-router-dom';

const DIRECTOR_PROFILES = {
  director_2: {
    title: 'Director 2',
    scopeBadge: 'Director 2 Assigned Only',
    totalSpend: '₹1.86 Cr',
    spendNote: 'Baner & Wakad site spend',
    spendAvg: '₹9.30L Avg / PO',
    sitesCount: '2 Sites',
    sitesList: 'Baner Commercial Tower, Wakad Enclave',
    sitesStatus: 'Director 2 Assigned Projects',
    budgetUtil: '72.4%',
    budgetAllocated: '₹2.57 Cr',
    budgetRemaining: '₹71.00 Lakh',
    initialOrders: [
      {
        id: 887,
        po_no: 'PO-2026-0887',
        vendor: 'Tata Steel Tubes & TMT',
        site: 'Baner Commercial Tower',
        site_code: 'BANER',
        item: 'Fe 550D TMT Reinforcement Steel - 28 MT',
        amount: 1890000,
        date: 'Today, 09:40 AM',
        status: 'Pending Approval',
        urgency: 'Critical',
        assignedTo: 'Director 2'
      },
      {
        id: 884,
        po_no: 'PO-2026-0884',
        vendor: 'Finolex Cables Ltd.',
        site: 'Wakad Residential Enclave',
        site_code: 'WAKAD',
        item: 'FRLS Copper Armoured Electrical Cables 4 Core',
        amount: 675000,
        date: 'Yesterday',
        status: 'Pending Approval',
        urgency: 'Normal',
        assignedTo: 'Director 2'
      }
    ],
    auditLogs: [
      {
        id: 1,
        action: 'PO_ASSIGNED_D2',
        user: 'Sunil Shinde (Procurement)',
        details: 'Routed PO-2026-0887 (Tata Steel ₹18.90L) for Director 2 commercial approval',
        time: '35 mins ago'
      },
      {
        id: 2,
        action: 'GATE_INWARD_SCANNED',
        user: 'Ramesh Patil (Supervisor)',
        details: 'Vehicle MH-12-RN-9921 arrived at Baner Site (Challan #CH-4091)',
        time: '45 mins ago'
      },
      {
        id: 3,
        action: 'RFQ_DIRECTOR2_APPROVED',
        user: 'Director 2',
        details: 'Approved commercial rates for Wakad Electrical Cabling (RFQ-2026-0314)',
        time: '2 hours ago'
      }
    ]
  },
  director_1: {
    title: 'Director 1',
    scopeBadge: 'Director 1 Assigned Only',
    totalSpend: '₹2.96 Cr',
    spendNote: 'Kharadi & Dhayri site spend',
    spendAvg: '₹8.06L Avg / PO',
    sitesCount: '2 Sites',
    sitesList: 'Kharadi IT Park (Block 2), Dhayri Phase-1',
    sitesStatus: 'Director 1 Assigned Projects',
    budgetUtil: '81.2%',
    budgetAllocated: '₹3.57 Cr',
    budgetRemaining: '₹61.00 Lakh',
    initialOrders: [
      {
        id: 891,
        po_no: 'PO-2026-0891',
        vendor: 'UltraTech Cement Ltd.',
        site: 'Kharadi IT Park (Block 2)',
        site_code: 'KHARADI',
        item: 'Ready Mix Concrete (RMC) M30 Grade - 220 m³',
        amount: 1245000,
        date: 'Today, 10:15 AM',
        status: 'Pending Approval',
        urgency: 'High Priority',
        assignedTo: 'Director 1'
      },
      {
        id: 880,
        po_no: 'PO-2026-0880',
        vendor: 'Saint-Gobain Glass India',
        site: 'Dhayri Phase-1 Heights',
        site_code: 'DHAYRI',
        item: '12mm Toughened Architectural Facade Glass',
        amount: 820000,
        date: 'Yesterday',
        status: 'Pending Approval',
        urgency: 'Normal',
        assignedTo: 'Director 1'
      },
      {
        id: 876,
        po_no: 'PO-2026-0876',
        vendor: 'Kajaria Ceramics Ltd.',
        site: 'Kharadi IT Park (Block 2)',
        site_code: 'KHARADI',
        item: '800x800mm Vitrified Floor Tiles (Double Charged)',
        amount: 540000,
        date: '14 Oct 2026',
        status: 'Pending Approval',
        urgency: 'Normal',
        assignedTo: 'Director 1'
      }
    ],
    auditLogs: [
      {
        id: 1,
        action: 'PO_APPROVED_L2',
        user: 'Director 1',
        details: 'Approved PO-2026-0875 (Kirloskar Water Pumps - ₹7.20L)',
        time: '12 mins ago'
      },
      {
        id: 2,
        action: 'PO_ASSIGNED_D1',
        user: 'Sunil Shinde (Procurement)',
        details: 'Routed PO-2026-0891 (UltraTech Concrete ₹12.45L) to Director 1',
        time: '1 hour ago'
      }
    ]
  },
  director_3: {
    title: 'Director 3',
    scopeBadge: 'Director 3 Assigned Only',
    totalSpend: '₹0.78 Cr',
    spendNote: 'Special MEP & Interiors',
    spendAvg: '₹6.50L Avg / PO',
    sitesCount: 'Special Packages',
    sitesList: 'Finishing, Elevators & HVAC Across Sites',
    sitesStatus: 'Director 3 Assigned Scope',
    budgetUtil: '65.0%',
    budgetAllocated: '₹1.20 Cr',
    budgetRemaining: '₹42.00 Lakh',
    initialOrders: [],
    auditLogs: [
      {
        id: 1,
        action: 'DIRECTOR_REVIEW_CLEARED',
        user: 'Director 3',
        details: 'Cleared HVAC chiller vendor pre-qualifications',
        time: 'Yesterday'
      }
    ]
  },
  admin: {
    title: 'Consolidated DDPL Board',
    scopeBadge: 'Consolidated All Sites',
    totalSpend: '₹4.82 Cr',
    spendNote: 'Procured across 58 POs',
    spendAvg: '₹8.31L Avg / PO',
    sitesCount: '4 Sites',
    sitesList: 'Dhayri, Baner, Kharadi, Wakad',
    sitesStatus: 'All sites operational',
    budgetUtil: '78.5%',
    budgetAllocated: '₹6.14 Cr',
    budgetRemaining: '₹1.32 Cr',
    initialOrders: [
      {
        id: 891,
        po_no: 'PO-2026-0891',
        vendor: 'UltraTech Cement Ltd.',
        site: 'Kharadi IT Park (Block 2)',
        site_code: 'KHARADI',
        item: 'Ready Mix Concrete (RMC) M30 Grade - 220 m³',
        amount: 1245000,
        date: 'Today, 10:15 AM',
        status: 'Pending Approval',
        urgency: 'High Priority',
        assignedTo: 'Director 1'
      },
      {
        id: 887,
        po_no: 'PO-2026-0887',
        vendor: 'Tata Steel Tubes & TMT',
        site: 'Baner Commercial Tower',
        site_code: 'BANER',
        item: 'Fe 550D TMT Reinforcement Steel - 28 MT',
        amount: 1890000,
        date: 'Today, 09:40 AM',
        status: 'Pending Approval',
        urgency: 'Critical',
        assignedTo: 'Director 2'
      },
      {
        id: 884,
        po_no: 'PO-2026-0884',
        vendor: 'Finolex Cables Ltd.',
        site: 'Wakad Residential Enclave',
        site_code: 'WAKAD',
        item: 'FRLS Copper Armoured Electrical Cables 4 Core',
        amount: 675000,
        date: 'Yesterday',
        status: 'Pending Approval',
        urgency: 'Normal',
        assignedTo: 'Director 2'
      },
      {
        id: 880,
        po_no: 'PO-2026-0880',
        vendor: 'Saint-Gobain Glass India',
        site: 'Dhayri Phase-1 Heights',
        site_code: 'DHAYRI',
        item: '12mm Toughened Architectural Facade Glass',
        amount: 820000,
        date: 'Yesterday',
        status: 'Pending Approval',
        urgency: 'Normal',
        assignedTo: 'Director 1'
      },
      {
        id: 876,
        po_no: 'PO-2026-0876',
        vendor: 'Kajaria Ceramics Ltd.',
        site: 'Kharadi IT Park (Block 2)',
        site_code: 'KHARADI',
        item: '800x800mm Vitrified Floor Tiles (Double Charged)',
        amount: 540000,
        date: '14 Oct 2026',
        status: 'Pending Approval',
        urgency: 'Normal',
        assignedTo: 'Director 1'
      }
    ],
    auditLogs: [
      {
        id: 1,
        action: 'PO_APPROVED_L2',
        user: 'Ashok Deshmukh (Director)',
        details: 'Approved PO-2026-0875 (Kirloskar Water Pumps - ₹7.20L)',
        time: '12 mins ago'
      },
      {
        id: 2,
        action: 'GATE_INWARD_SCANNED',
        user: 'Ramesh Patil (Supervisor)',
        details: 'Vehicle MH-12-RN-9921 arrived at Baner Site (Challan #CH-4091)',
        time: '45 mins ago'
      },
      {
        id: 3,
        action: '3WAY_RECON_APPROVED',
        user: 'Pooja Kadam (Accounts)',
        details: 'Matched & cleared payment for JSW Cement Invoice #INV-8812 (₹3.45L)',
        time: '2 hours ago'
      }
    ]
  }
};

DIRECTOR_PROFILES.director = DIRECTOR_PROFILES.director_1;

const resolveDirectorProfileKey = (roleKey) => {
  if (!roleKey) return 'admin';
  const key = String(roleKey).toLowerCase();
  if (key === 'director' || key === 'director_1') return 'director_1';
  if (key === 'director_2') return 'director_2';
  if (key === 'director_3') return 'director_3';
  if (DIRECTOR_PROFILES[key]) return key;
  return 'admin';
};

export const DirectorView = ({ activeRoleKey = 'admin' }) => {
  // Resolve profile based on specific active director key
  const profileKey = resolveDirectorProfileKey(activeRoleKey);
  const profile = DIRECTOR_PROFILES[profileKey] || DIRECTOR_PROFILES.admin;

  const [orders, setOrders] = useState(profile.initialOrders);
  const [actionNotice, setActionNotice] = useState(null);

  // Sync orders whenever the active director changes (e.g. Director 2 selected in navbar)
  useEffect(() => {
    setOrders(profile.initialOrders);
  }, [profileKey]);

  const handleApprove = (id) => {
    const po = orders.find(o => o.id === id);
    setOrders(orders.map(o => o.id === id ? { ...o, status: 'Approved' } : o));
    setActionNotice({
      type: 'success',
      text: `Approved high-value order ${po?.po_no} (₹${(po?.amount / 100000).toFixed(2)} Lakh) by ${profile.title}. Released for vendor dispatch.`
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleReject = (id) => {
    const po = orders.find(o => o.id === id);
    setOrders(orders.map(o => o.id === id ? { ...o, status: 'Rejected' } : o));
    setActionNotice({
      type: 'warning',
      text: `Returned order ${po?.po_no} back to Procurement Manager for rate renegotiation.`
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const pendingCount = orders.filter(o => o.status === 'Pending Approval').length;
  const pendingTotal = orders.filter(o => o.status === 'Pending Approval').reduce((acc, o) => acc + o.amount, 0);

  return (
    <div>
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className={`bento-toast ${actionNotice.type === 'success' ? 'bento-toast-success' : 'bento-toast-warning'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {actionNotice.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{actionNotice.text}</span>
          </div>
          <button onClick={() => setActionNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Main Bento Layout: 8-Col Table + 4-Col Side Audit */}
      <div className="bento-layout-grid">
        {/* Main Card: High-Value PO Approval Queue (8 cols) — Strictly Filtered to this Director */}
        <div className="bento-col-8 bento-card">
          <div>
            <div className="bento-card-header">
              <div>
                <h2 className="bento-card-title">
                  <span>{profile.title} High-Value Approval Queue</span>
                  <span className="bento-badge bento-badge-warning">{profile.scopeBadge}</span>
                </h2>
                <p className="bento-card-subtitle">
                  Orders exceeding ₹5,00,000 threshold routed specifically to {profile.title} for commercial authorization.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.74rem', color: '#334155', background: '#f8fafc', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                    <span>Assigned Sites: <strong>{profile.sitesList}</strong></span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: '#1e40af', background: '#eff6ff', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                    <span>Portfolio Spend: <strong>{profile.totalSpend}</strong></span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: '#047857', background: '#ecfdf5', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                    <span>Budget Util: <strong>{profile.budgetUtil}</strong></span>
                  </div>
                </div>
              </div>

              <Link to="/orders" className="bento-btn bento-btn-secondary bento-btn-sm">
                <span>View Orders</span>
                <ChevronRight size={13} />
              </Link>
            </div>

            {/* Approval Table */}
            <div className="bento-table-wrapper">
              {orders.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                  <ShieldCheck size={36} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
                  <strong>No pending high-value orders awaiting {profile.title} sign-off.</strong>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: '#94a3b8' }}>
                    All assigned purchase orders for {profile.sitesList} are cleared.
                  </div>
                </div>
              ) : (
                <table className="bento-table">
                  <thead>
                    <tr>
                      <th>PO / Date</th>
                      <th>Supplier &amp; Site</th>
                      <th>Items Summary</th>
                      <th>Total Amount</th>
                      <th style={{ textAlign: 'right' }}>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((po) => {
                      const isPending = po.status === 'Pending Approval';
                      const isApproved = po.status === 'Approved';
                      const isRejected = po.status === 'Rejected';

                      return (
                        <tr key={po.id}>
                          <td>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{po.po_no}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                              <Clock size={11} />
                              <span>{po.date}</span>
                            </div>
                          </td>

                          <td>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{po.vendor}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }}></span>
                              <span>{po.site}</span>
                            </div>
                          </td>

                          <td style={{ maxWidth: '200px' }}>
                            <div style={{ color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {po.item}
                            </div>
                            <span className={`bento-badge ${po.urgency === 'Critical' ? 'bento-badge-danger' : po.urgency === 'High Priority' ? 'bento-badge-warning' : 'bento-badge-neutral'}`} style={{ marginTop: '0.25rem' }}>
                              {po.urgency}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                              ₹{po.amount.toLocaleString('en-IN')}
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            {isPending && (
                              <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(po.id)}
                                  className="bento-btn bento-btn-success bento-btn-sm"
                                  title={`Approve purchase order as ${profile.title}`}
                                >
                                  <Check size={12} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReject(po.id)}
                                  className="bento-btn bento-btn-danger-outline bento-btn-sm"
                                  title="Reject order and request revision"
                                >
                                  <X size={12} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            )}

                            {isApproved && (
                              <span className="bento-badge bento-badge-success">
                                <Check size={11} />
                                <span>Approved</span>
                              </span>
                            )}

                            {isRejected && (
                              <span className="bento-badge bento-badge-danger">
                                <X size={11} />
                                <span>Rejected</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bento-card-footer">
            <span>Showing high-priority orders awaiting {profile.title} commercial sign-off</span>
            <strong style={{ color: '#334155' }}>Governance: L2 Authority Rule Active</strong>
          </div>
        </div>

        {/* Side Card: Audit Trail Scoped to this Director (4 cols) */}
        <div className="bento-col-4 bento-card">
          <div>
            <div className="bento-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>{profile.title} Audit Feed</h3>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Portfolio approvals &amp; site logs</p>
                </div>
              </div>
              <span className="bento-status-pulse" title="Live stream active"></span>
            </div>

            {/* Timeline Stream */}
            <div style={{ marginTop: '0.75rem' }}>
              {profile.auditLogs.map((log) => (
                <div key={log.id} className="bento-timeline-item">
                  <div className="bento-timeline-dot"></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                      <span className="bento-badge bento-badge-neutral">{log.action}</span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{log.time}</span>
                    </div>
                    <div style={{ color: '#334155', fontWeight: 500, fontSize: '0.75rem', lineHeight: 1.35 }}>
                      {log.details}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      by {log.user}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card-footer">
            <Link to="/audit" style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>View Full Audit Logs</span>
              <ExternalLink size={12} />
            </Link>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>PostgreSQL Logged</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectorView;
