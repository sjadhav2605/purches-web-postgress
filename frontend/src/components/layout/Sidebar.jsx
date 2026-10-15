import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FileText, 
  ShoppingCart, 
  Truck, 
  CreditCard, 
  Building2, 
  Package, 
  Users, 
  LayoutDashboard,
  FileSpreadsheet,
  History,
  ShieldAlert,
  Store,
  Receipt
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext.jsx';

export const Sidebar = () => {
  const { activeRole } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-badge">D</div>
        <div className="logo-text">
          <h2>DDPL Portal</h2>
          <span>Decent Decor Pvt. Ltd</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {activeRole === 'vendor' ? (
          <>
            <NavLink to="/vendor-portal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Store size={18} />
              <span>Vendor Portal</span>
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>

            {['admin', 'pc', 'supervisor', 'purchase', 'director'].includes(activeRole) && (
              <NavLink to="/requisitions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <FileText size={18} />
                <span>Requests (PR)</span>
              </NavLink>
            )}

            {['admin', 'purchase', 'director'].includes(activeRole) && (
              <NavLink to="/rfqs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <FileSpreadsheet size={18} />
                <span>RFQs & Bids</span>
              </NavLink>
            )}

            {['admin', 'purchase', 'director', 'accounts'].includes(activeRole) && (
              <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <ShoppingCart size={18} />
                <span>Purchase Orders</span>
              </NavLink>
            )}

            {['admin', 'supervisor', 'pc', 'purchase', 'accounts', 'director'].includes(activeRole) && (
              <NavLink to="/deliveries" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Truck size={18} />
                <span>Deliveries & Challans</span>
              </NavLink>
            )}

            {['admin', 'purchase', 'director', 'accounts'].includes(activeRole) && (
              <NavLink to="/vendor-challans" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Receipt size={18} />
                <span>Vendor Billed Challans</span>
              </NavLink>
            )}

            {['admin', 'accounts', 'purchase'].includes(activeRole) && (
              <NavLink to="/payments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <CreditCard size={18} />
                <span>Payments</span>
              </NavLink>
            )}

            {['admin', 'purchase'].includes(activeRole) && (
              <NavLink to="/vendor-portal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Store size={18} />
                <span>Vendor Portal</span>
              </NavLink>
            )}

            {['admin', 'purchase'].includes(activeRole) && (
              <>
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.75rem 0' }} />

                <div style={{ padding: '0 0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Masters & System
                </div>

                <NavLink to="/materials" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Package size={18} />
                  <span>Materials</span>
                </NavLink>

                <NavLink to="/sites" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Building2 size={18} />
                  <span>Sites</span>
                </NavLink>

                <NavLink to="/vendors" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Users size={18} />
                  <span>Vendors</span>
                </NavLink>
              </>
            )}

            {activeRole === 'admin' && (
              <>
                <NavLink to="/audit" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <History size={18} />
                  <span>Audit Trail</span>
                </NavLink>

                <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <ShieldAlert size={18} />
                  <span>Users & Access</span>
                </NavLink>
              </>
            )}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          DDPL v2.0 • React + Express
        </div>
      </div>
    </aside>
  );
};
