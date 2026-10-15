import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext.jsx';
import { ROLE_DEFINITIONS } from '@/constants';
import { 
  HelpCircle, 
  X, 
  ShieldCheck, 
  FileText, 
  FileSpreadsheet, 
  Award, 
  CreditCard, 
  Truck,
  Store 
} from 'lucide-react';

export const RoleDutyBanner = () => {
  const { user, activeRole, switchRole, currentRoleInfo } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const roleList = Object.values(ROLE_DEFINITIONS);

  const getRoleIcon = (roleId) => {
    switch (roleId) {
      case 'pc': return <FileText size={18} />;
      case 'purchase': return <FileSpreadsheet size={18} />;
      case 'director':
      case 'director_1':
      case 'director_2':
      case 'director_3': return <Award size={18} />;
      case 'accounts': return <CreditCard size={18} />;
      case 'supervisor': return <Truck size={18} />;
      case 'vendor': return <Store size={18} />;
      default: return <ShieldCheck size={18} />;
    }
  };

  return (
    <>
      <div className="role-duty-banner">
        <div className="role-duty-content">
          <div 
            className="role-badge-tag" 
            style={{ 
              backgroundColor: `${currentRoleInfo.color}20`, 
              borderColor: currentRoleInfo.color, 
              color: currentRoleInfo.color 
            }}
          >
            {getRoleIcon(currentRoleInfo.id)}
            <span>{currentRoleInfo.title}</span>
          </div>

          <div className="role-duty-text">
            <strong>Scope & Duty: </strong>
            <span>{currentRoleInfo.duty}</span>
          </div>
        </div>

        <button 
          onClick={() => setShowModal(true)} 
          className="btn btn-secondary btn-sm role-guide-btn"
          title="View all role definitions and complete procurement lifecycle"
        >
          <HelpCircle size={15} />
          <span>Roles & Lifecycle Guide</span>
        </button>
      </div>

      {/* Role Responsibilities & Workflow Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-dialog-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  DDPL Procurement Workflow & Role Responsibilities
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
                  Standard organizational roles and the 7-stage procurement lifecycle sequence:
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="close-btn" title="Close">
                <X size={20} />
              </button>
            </div>

            <div className="roles-grid-container">
              {roleList.map((r) => {
                const isActive = r.id === activeRole;
                return (
                  <div 
                    key={r.id} 
                    className={`role-duty-card ${isActive ? 'active-duty-card' : ''}`}
                    style={{ borderTop: `3px solid ${r.color}` }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: r.color, fontWeight: 700 }}>
                        {getRoleIcon(r.id)}
                        <span>{r.title}</span>
                      </div>
                      {isActive && (
                        <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
                          Current View
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.85rem' }}>
                      {r.duty}
                    </div>

                    {user?.role === 'admin' ? (
                      <button
                        onClick={() => {
                          switchRole(r.id);
                          setShowModal(false);
                        }}
                        className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ width: '100%', fontSize: '0.8rem' }}
                      >
                        {isActive ? 'Active View' : `Switch to ${r.title} View`}
                      </button>
                    ) : (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '0.4rem', 
                        borderRadius: 'var(--radius-sm)', 
                        background: isActive ? `${r.color}15` : 'var(--bg-secondary)', 
                        color: isActive ? r.color : 'var(--text-muted)', 
                        fontSize: '0.78rem', 
                        fontWeight: 600 
                      }}>
                        {isActive ? '✓ Your Assigned Account Role' : 'DDPL Workflow Stage'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="workflow-pipeline-summary">
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                7-Stage Procurement Lifecycle Flow:
              </h4>
              <ol style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <li><strong>1. PR Raised:</strong> Project Coordinator logs required materials and quantities for the construction site.</li>
                <li><strong>2. RFQ Sent:</strong> Purchase Department floats an RFQ and invites competitive vendor quotation bids.</li>
                <li><strong>3. Bids In (Vendor):</strong> Invited vendors submit their unit rates and delivery lead times online.</li>
                <li><strong>4. Shortlisted:</strong> Purchase Department evaluates quotes, ranks rates, and shortlists candidates.</li>
                <li><strong>5. Approved:</strong> Director reviews comparative bids and approves the winning L1 vendor quote.</li>
                <li><strong>6. PO Issued & Dispatched (Vendor):</strong> Official PO is generated with 18% GST; Vendor acknowledges and dispatches goods.</li>
                <li><strong>7. Delivered & Verified:</strong> Site Supervisor physically verifies materials against challan; Accounts disburses payments.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
