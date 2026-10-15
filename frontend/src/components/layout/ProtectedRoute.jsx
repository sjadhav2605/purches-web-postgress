import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { landingPathFor } from '@/constants';
import { Navbar } from './Navbar.jsx';
import { Sidebar } from './Sidebar.jsx';
import { PipelineBar } from './PipelineBar.jsx';
import { RoleDutyBanner } from './RoleDutyBanner.jsx';

/**
 * Route-level RBAC: renders children only if the authenticated user's active role is allowed.
 * Mirrors the sidebar visibility so a role cannot reach a page just by typing the URL.
 * (Authorization of the data itself is always enforced again by the backend from the verified token.)
 */
export const RoleRoute = ({ roles, children }) => {
  const { activeRole } = useAuth();
  if (!activeRole || !roles.includes(activeRole)) {
    return <Navigate to={landingPathFor(activeRole)} replace />;
  }
  return children;
};

export const ProtectedLayout = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading DDPL Console...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <PipelineBar />
        <RoleDutyBanner />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
