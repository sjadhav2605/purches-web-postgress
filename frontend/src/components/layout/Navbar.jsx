import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { ROLE_DEFINITIONS } from '@/constants';
import { poService } from '@/services/po.service.js';
import { notificationService } from '@/services/notification.service.js';
import { formatWorkflowDateTime } from '@/utils';
import { LogOut, Plus, List, Shield, ChevronDown, Bell, Truck, Calendar, AlertCircle } from 'lucide-react';

export const Navbar = () => {
  const { user, logout, activeRole, activeRoleKey, switchRole, currentRoleInfo } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [inAppNotifs, setInAppNotifs] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef(null);
  const closeTimerRef = useRef(null);

  const handleNotifMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShowNotifDropdown(true);
  };

  const handleNotifMouseLeave = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    // Smooth delay before closing so cursor movement doesn't cause jitter
    closeTimerRef.current = setTimeout(() => {
      setShowNotifDropdown(false);
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const isSupervisorOrPc = ['supervisor', 'pc'].includes(activeRole);

    const loadShipments = async () => {
      if (!isSupervisorOrPc) return;
      try {
        const res = await poService.getOrders({ limit: 20, status: 'Dispatched' });
        const list = res.items || res.data || (Array.isArray(res) ? res : []);
        if (isMounted) setNotifications(list);
      } catch (e) {
        // quiet ignore
      }
    };

    const loadInAppNotifs = async () => {
      try {
        const notifs = await notificationService.getNotifications({ limit: 15 });
        const list = Array.isArray(notifs) ? notifs : (notifs?.items || notifs?.data?.items || notifs?.data || []);
        if (isMounted) {
          setInAppNotifs(list);
        }
      } catch (e) {
        // quiet ignore
      }
    };

    loadShipments();
    loadInAppNotifs();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadShipments();
        loadInAppNotifs();
      }
    }, 45000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [activeRole, user?.id]);

  const roleOptions = Object.values(ROLE_DEFINITIONS).filter((r, idx, arr) => 
    arr.findIndex(item => item.id === r.id) === idx
  );

  return (
    <header className="navbar">
      <div className="navbar-left">
        <div className="brand-badge-row">
          <span className="brand-name">DDPL Procurement</span>
          <span className="brand-sub">Purchase portal</span>
        </div>

        {/* Quick Actions based on Active Role */}
        <div className="navbar-actions">
          {['admin', 'pc', 'supervisor', 'purchase'].includes(activeRole) && (
            <Link to="/requisitions/new" className="btn btn-sm btn-primary">
              <Plus size={15} />
              <span>New request</span>
            </Link>
          )}

          {['admin', 'pc', 'supervisor', 'purchase', 'director'].includes(activeRole) && (
            <Link to="/requisitions" className="btn btn-sm btn-secondary">
              <List size={15} />
              <span>My requests</span>
            </Link>
          )}

          {activeRole === 'vendor' && (
            <Link to="/vendor-portal" className="btn btn-sm btn-primary">
              <List size={15} />
              <span>Vendor Portal</span>
            </Link>
          )}

          {activeRole === 'accounts' && (
            <Link to="/payments" className="btn btn-sm btn-primary">
              <List size={15} />
              <span>Vendor Payments</span>
            </Link>
          )}
        </div>
      </div>

      <div className="navbar-right">
        {/* Role Switcher: ONLY Administrator can switch roles. Non-admins see their assigned role locked */}
        {user?.role === 'admin' ? (
          <div className="role-switcher-box">
            <label className="role-switcher-label">View As Role:</label>
            <div className="select-wrapper">
              <select
                value={activeRoleKey || activeRole}
                onChange={(e) => {
                  const selectedRole = e.target.value;
                  switchRole(selectedRole);
                  const roleDef = ROLE_DEFINITIONS[selectedRole];
                  const currentPath = window.location.pathname;

                  if (currentPath === '/' || currentPath === '') {
                    // Stay on Dashboard to display the selected role's dashboard view
                    return;
                  } else if (selectedRole === 'vendor') {
                    navigate('/vendor-portal');
                  } else if (currentPath === '/vendor-portal') {
                    navigate('/requisitions');
                  } else if (roleDef && roleDef.allowedNavs && roleDef.allowedNavs.length > 0) {
                    const isAllowed = roleDef.allowedNavs.some(nav => currentPath.startsWith(nav));
                    if (!isAllowed) {
                      navigate(roleDef.allowedNavs[0]);
                    }
                  }
                }}
                className="role-switcher-select"
              >
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-arrow" />
            </div>
          </div>
        ) : (
          <div className="role-switcher-box role-switcher-locked">
            <span className="role-switcher-label">View As Role:</span>
            <div 
              className="role-locked-display"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                fontWeight: 600,
                backgroundColor: `${currentRoleInfo.color}15`,
                color: currentRoleInfo.color,
                border: `1px solid ${currentRoleInfo.color}35`,
                cursor: 'default',
                userSelect: 'none'
              }}
              title="Assigned Account Role (Locked for non-administrators)"
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: currentRoleInfo.color }}></span>
              <span>{currentRoleInfo.title}</span>
            </div>
          </div>
        )}

        {/* Notification Bell for All Roles (Revisions, Quotes, Deliveries) */}
        {(() => {
          const unreadInAppCount = inAppNotifs.filter(n => !n.is_read).length;
          const isSupervisorOrPc = ['supervisor', 'pc'].includes(activeRole);
          const totalCount = unreadInAppCount + (isSupervisorOrPc ? notifications.length : 0);

          return (
            <div 
              ref={notifRef}
              onMouseEnter={handleNotifMouseEnter}
              onMouseLeave={handleNotifMouseLeave}
              style={{ position: 'relative' }}
            >
              <button
                type="button"
                onClick={() => setShowNotifDropdown(prev => !prev)}
                onMouseEnter={handleNotifMouseEnter}
                style={{
                  position: 'relative',
                  background: showNotifDropdown ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.45rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: totalCount > 0 ? 'var(--primary-600)' : 'var(--text-muted)'
                }}
                title="Notifications"
              >
                <Bell size={18} />
                {totalCount > 0 && (
                  <span 
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      minWidth: '18px',
                      height: '18px',
                      padding: '0 4px',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #ffffff'
                    }}
                  >
                    {totalCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div
                  onMouseEnter={handleNotifMouseEnter}
                  onMouseLeave={handleNotifMouseLeave}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    width: '360px',
                    background: '#ffffff',
                    boxShadow: 'var(--shadow-xl)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    zIndex: 2000,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                      <Bell size={15} style={{ color: '#0284c7' }} />
                      <span>Notifications ({totalCount})</span>
                    </div>
                    {unreadInAppCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setInAppNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
                            await notificationService.markAllAsRead();
                          } catch (err) {
                            console.error('Error marking all notifications as read:', err);
                          }
                        }}
                        style={{ border: 'none', background: 'transparent', color: '#0284c7', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                    {/* In-app notifications */}
                    {inAppNotifs.map((n) => (
                      <div
                        key={`notif-${n.id}`}
                        onClick={async () => {
                          try {
                            if (!n.is_read) {
                              setInAppNotifs(prev => prev.map(item => item.id === n.id ? { ...item, is_read: 1 } : item));
                              await notificationService.markAsRead(n.id);
                            }
                          } catch (err) {
                            console.error('Error marking notification as read:', err);
                          }
                          setShowNotifDropdown(false);
                          if (n.link) navigate(n.link);
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid #f1f5f9',
                          background: n.is_read ? '#ffffff' : 'rgba(2, 132, 199, 0.05)',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.84rem', color: 'var(--primary-700)' }}>
                            {n.title}
                          </strong>
                          {!n.is_read && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7', flexShrink: 0, marginTop: '4px' }}></span>
                          )}
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {n.message}
                        </p>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                          {n.created_at ? formatWorkflowDateTime(n.created_at) : 'Just now'}
                        </div>
                      </div>
                    ))}

                    {/* Shipments for Supervisor/PC */}
                    {isSupervisorOrPc && notifications.map((n) => (
                      <div 
                        key={`ship-${n.id}`}
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid #f1f5f9',
                          background: n.status === 'Dispatched' ? 'rgba(16, 185, 129, 0.05)' : '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--primary-700)' }}>{n.po_no}</strong>
                          <span className={`badge badge-${n.status?.toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>
                            {n.status === 'Dispatched' ? '🚚 Dispatched' : n.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginTop: '0.2rem', fontWeight: 600 }}>
                          {n.vendor_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Site: {n.site_code} ({n.site_name})
                        </div>
                        <div style={{ marginTop: '0.35rem', background: '#ecfdf5', color: '#047857', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Calendar size={12} />
                          <span>Expected Arrival: {n.expected_delivery_date ? new Date(n.expected_delivery_date).toLocaleDateString() : 'Pending'}</span>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNotifDropdown(false);
                              navigate('/deliveries');
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ width: '100%', fontSize: '0.75rem', padding: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                          >
                            <Truck size={13} />
                            <span>Verify in Deliveries</span>
                          </button>
                        </div>
                      </div>
                    ))}

                    {inAppNotifs.length === 0 && (!isSupervisorOrPc || notifications.length === 0) && (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        No new notifications.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* User Identity & Logout */}
        <div className="user-profile-badge">
          <div className="user-avatar-mini" style={{ backgroundColor: currentRoleInfo.color }}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="user-details">
            <span className="user-display-name">{user?.name || 'Administrator'}</span>
          </div>

          <button 
            onClick={logout} 
            className="sign-out-btn"
            title="Sign out of DDPL Portal"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};
