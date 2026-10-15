import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/Auth/LoginPage.jsx';
import { ProtectedLayout, RoleRoute } from './components/layout/ProtectedRoute.jsx';
import { DashboardPage } from './pages/Dashboard/DashboardPage.jsx';

// Requisitions
import { RequisitionListPage } from './pages/Requisitions/RequisitionListPage.jsx';
import { RequisitionFormPage } from './pages/Requisitions/RequisitionFormPage.jsx';
import { RequisitionDetailPage } from './pages/Requisitions/RequisitionDetailPage.jsx';

// RFQs & Bids
import { RFQsPage } from './pages/RFQs/RFQsPage.jsx';
import { RFQDetailPage } from './pages/RFQs/RFQDetailPage.jsx';

// Purchase Orders
import { PurchaseOrderListPage } from './pages/PurchaseOrders/PurchaseOrderListPage.jsx';
import { PurchaseOrderFormPage } from './pages/PurchaseOrders/PurchaseOrderFormPage.jsx';
import { PurchaseOrderDetailPage } from './pages/PurchaseOrders/PurchaseOrderDetailPage.jsx';

// Deliveries & Payments
import { DeliveriesPage } from './pages/Deliveries/DeliveriesPage.jsx';
import { PaymentsPage } from './pages/Payments/PaymentsPage.jsx';

// Vendor Portal & Self-Registration
import { VendorPortalPage } from './pages/Vendor/VendorPortalPage.jsx';
import { VendorRegistrationPage } from './pages/Vendor/VendorRegistrationPage.jsx';

// Masters
import { MaterialsPage } from './pages/Masters/MaterialsPage.jsx';
import { SitesPage } from './pages/Masters/SitesPage.jsx';
import { VendorsPage } from './pages/Masters/VendorsPage.jsx';

// Audit & Users
import { AuditLogPage } from './pages/Audit/AuditLogPage.jsx';
import { UsersPage } from './pages/Users/UsersPage.jsx';
import { PublicQuoteSubmissionPage } from './pages/RFQs/PublicQuoteSubmissionPage.jsx';
import { PublicDeliverySchedulePage } from './pages/Deliveries/PublicDeliverySchedulePage.jsx';

export const App = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/vendor-registration" element={<VendorRegistrationPage />} />
      <Route path="/quote/:id" element={<PublicQuoteSubmissionPage />} />
      <Route path="/rfq-quote/:id" element={<PublicQuoteSubmissionPage />} />
      <Route path="/delivery-schedule/:id" element={<PublicDeliverySchedulePage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        
        {/* Requisitions */}
        <Route path="/requisitions" element={<RequisitionListPage />} />
        <Route path="/requisitions/new" element={<RequisitionFormPage />} />
        <Route path="/requisitions/:id" element={<RequisitionDetailPage />} />

        {/* RFQs & Multi-Vendor Bidding */}
        <Route path="/rfqs" element={<RFQsPage />} />
        <Route path="/rfqs/:id" element={<RFQDetailPage />} />
        
        {/* Purchase Orders */}
        <Route path="/orders" element={<PurchaseOrderListPage />} />
        <Route path="/orders/new" element={<RoleRoute roles={['admin', 'purchase', 'director']}><PurchaseOrderFormPage /></RoleRoute>} />
        <Route path="/orders/:id" element={<PurchaseOrderDetailPage />} />

        {/* Deliveries & Payments */}
        <Route path="/deliveries" element={<DeliveriesPage />} />
        <Route path="/vendor-challans" element={<RoleRoute roles={['admin', 'purchase', 'director', 'accounts']}><DeliveriesPage defaultTab="vendor-challans" /></RoleRoute>} />
        <Route path="/payments" element={<RoleRoute roles={['admin', 'accounts', 'purchase']}><PaymentsPage /></RoleRoute>} />

        {/* Vendor Self-Service Portal */}
        <Route path="/vendor-portal" element={<RoleRoute roles={['admin', 'purchase', 'vendor']}><VendorPortalPage /></RoleRoute>} />

        {/* Masters */}
        <Route path="/materials" element={<RoleRoute roles={['admin', 'purchase']}><MaterialsPage /></RoleRoute>} />
        <Route path="/sites" element={<RoleRoute roles={['admin', 'purchase']}><SitesPage /></RoleRoute>} />
        <Route path="/vendors" element={<RoleRoute roles={['admin', 'purchase']}><VendorsPage /></RoleRoute>} />

        {/* System Administration */}
        <Route path="/audit" element={<RoleRoute roles={['admin']}><AuditLogPage /></RoleRoute>} />
        <Route path="/users" element={<RoleRoute roles={['admin']}><UsersPage /></RoleRoute>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
