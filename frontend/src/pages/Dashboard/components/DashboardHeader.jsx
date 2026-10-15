import React from 'react';
import { 
  Building2, 
  ShoppingBag, 
  HardHat, 
  Receipt, 
  RotateCw, 
  Sparkles, 
  ArrowUpRight, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardHeader = ({
  activeRole = 'director',
  activeRoleKey = 'admin',
  onRoleChange,
  user = null,
  currentRoleTitle = '',
  onRefresh,
  refreshing = false
}) => {
  const roles = [
    {
      id: 'director',
      label: 'Director / Admin',
      badge: 'Executive',
      icon: ShieldCheck,
      description: 'High-value PO approvals, budget utilization, and system audit trail'
    },
    {
      id: 'procurement',
      label: 'Procurement Manager',
      badge: 'Purchasing',
      icon: ShoppingBag,
      description: 'PR pipeline, RFQ bidding matrix, and vendor dispatch links'
    },
    {
      id: 'supervisor',
      label: 'Site Supervisor',
      badge: 'Site Ops',
      icon: HardHat,
      description: 'Truck gate inward, physical verification, and defect reports'
    },
    {
      id: 'accounts',
      label: 'Accounts & Billing',
      badge: 'Finance',
      icon: Receipt,
      description: '3-way invoice matching, GST ITC claims, and tax breakdown'
    }
  ];

  const isDirectorScope = Boolean(
    activeRoleKey && (activeRoleKey.startsWith('director') || (activeRoleKey !== 'admin' && activeRole === 'director'))
  );

  let titleText = `Welcome back, ${user?.name || 'DDPL Administrator'}`;
  let roleChipText = (currentRoleTitle || (user?.role || activeRole || 'Admin')).toUpperCase();
  let subtitleText = 'Active view is synchronized with your top View As Role selector.';

  if (activeRoleKey === 'director_2') {
    titleText = `${currentRoleTitle || 'Director 2'} Executive Portfolio`;
    roleChipText = 'DIRECTOR 2 (L2 GOVERNANCE)';
    subtitleText = 'Assigned Scope: Baner Commercial Tower & Wakad Residential Enclave • Commercial PO Sign-Off (> ₹5L)';
  } else if (activeRoleKey === 'director_1') {
    titleText = `${currentRoleTitle || 'Director 1'} Executive Portfolio`;
    roleChipText = 'DIRECTOR 1 (L2 GOVERNANCE)';
    subtitleText = 'Assigned Scope: Kharadi IT Park & Dhayri Phase-1 Heights • Commercial PO Sign-Off (> ₹5L)';
  } else if (activeRoleKey === 'director_3') {
    titleText = `${currentRoleTitle || 'Director 3'} Executive Portfolio`;
    roleChipText = 'DIRECTOR 3 (L2 GOVERNANCE)';
    subtitleText = 'Assigned Scope: Specialized MEP, Elevators & Architectural Finishing Packages Across Sites';
  }

  return (
    <div className="bento-header-wrapper">
      {/* Top Greeting & Status Banner */}
      <div className="bento-header-top">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span className="bento-status-badge">
              <span className="bento-status-pulse"></span>
              <span>DDPL Enterprise Cloud • Pune Regional Network</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>•</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Financial Year 2026-2027</span>
          </div>

          <h1 className="bento-title">
            <span>{titleText}</span>
            <span className="bento-role-chip">{roleChipText}</span>
          </h1>

          <p className="bento-subtitle">
            {subtitleText}
          </p>
        </div>

        {/* Quick Action & Live Sync Buttons */}
        <div className="bento-header-actions">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="bento-btn bento-btn-secondary"
            title="Refresh live metrics"
          >
            <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} style={{ color: '#2563eb' }} />
            <span>{refreshing ? 'Syncing...' : 'Sync Live'}</span>
          </button>

          <Link
            to="/requisitions/new"
            className="bento-btn bento-btn-primary"
          >
            <Sparkles size={14} />
            <span>New Requisition</span>
            <ArrowUpRight size={13} style={{ opacity: 0.8 }} />
          </Link>
        </div>
      </div>

      {/* Role Perspectives: Dedicated Director Executive Banner OR 4-Department Bento Switcher */}
      {isDirectorScope ? (
        <div className="bento-switcher-container" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
          <div className="bento-switcher-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <ShieldCheck size={16} style={{ color: '#b45309' }} />
              <span>
                Executive Governance Scope: <strong style={{ color: '#0f172a' }}>{currentRoleTitle} Portfolio</strong>
              </span>
              <span className="bento-badge bento-badge-warning">L2 Authority Rule Active</span>
            </div>
            <span style={{ fontWeight: 600, color: '#059669', fontSize: '0.74rem' }}>
              ● Filtered strictly to assigned sites &amp; high-value POs
            </span>
          </div>

          <div style={{ padding: '0.5rem 0.6rem 0.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.76rem', color: '#475569', fontWeight: 600 }}>Switch Director Scope:</span>
              <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => onRoleChange('director_1')}
                  className={`bento-btn bento-btn-sm ${activeRoleKey === 'director_1' ? 'bento-btn-primary' : 'bento-btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                >
                  <span>Director 1 (Kharadi &amp; Dhayri)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRoleChange('director_2')}
                  className={`bento-btn bento-btn-sm ${activeRoleKey === 'director_2' ? 'bento-btn-primary' : 'bento-btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                >
                  <span>Director 2 (Baner &amp; Wakad)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRoleChange('director_3')}
                  className={`bento-btn bento-btn-sm ${activeRoleKey === 'director_3' ? 'bento-btn-primary' : 'bento-btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                >
                  <span>Director 3 (MEP Packages)</span>
                </button>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => onRoleChange('admin')}
                    className={`bento-btn bento-btn-sm ${activeRoleKey === 'admin' ? 'bento-btn-primary' : 'bento-btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                  >
                    <span>Consolidated Board (All Sites)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Link to operational departments */}
            {user?.role === 'admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Operations:</span>
                <button
                  type="button"
                  onClick={() => onRoleChange('purchase')}
                  className="bento-btn bento-btn-secondary bento-btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                  title="Switch to Procurement Department view"
                >
                  Procurement
                </button>
                <button
                  type="button"
                  onClick={() => onRoleChange('supervisor')}
                  className="bento-btn bento-btn-secondary bento-btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                  title="Switch to Site Supervisor view"
                >
                  Supervisor
                </button>
                <button
                  type="button"
                  onClick={() => onRoleChange('accounts')}
                  className="bento-btn bento-btn-secondary bento-btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                  title="Switch to Accounts & Billing view"
                >
                  Accounts
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bento-switcher-container">
          <div className="bento-switcher-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={13} style={{ color: '#10b981' }} />
              <span>Active Operational Perspective: <strong style={{ color: '#0f172a' }}>{currentRoleTitle || displayRoleLabel}</strong></span>
            </div>
            <span style={{ fontWeight: 500, color: '#64748b' }}>Synced with top header "View As Role"</span>
          </div>

          <div className="bento-switcher-grid">
            {roles.map((r) => {
              const Icon = r.icon;
              const isActive = activeRole === r.id;

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onRoleChange(r.id)}
                  className={`bento-switcher-tab ${isActive ? 'active' : ''}`}
                  title={`Switch to ${r.label} perspective`}
                >
                  <div className="bento-tab-icon">
                    <Icon size={19} />
                  </div>

                  <div className="bento-tab-text">
                    <div className="bento-tab-title-row">
                      <span className="bento-tab-label">{r.label}</span>
                      <span className="bento-tab-tag">{r.badge}</span>
                    </div>
                    <div className="bento-tab-desc">{r.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
