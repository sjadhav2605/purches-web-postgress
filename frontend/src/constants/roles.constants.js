/**
 * Core RBAC Roles and Profile Definitions for DDPL Procurement Portal
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  PURCHASE: 'purchase',
  DIRECTOR: 'director',
  DIRECTOR_1: 'director_1',
  DIRECTOR_2: 'director_2',
  DIRECTOR_3: 'director_3',
  PC: 'pc',
  SUPERVISOR: 'supervisor',
  ACCOUNTS: 'accounts',
  VENDOR: 'vendor'
});

export const ROLE_DEFINITIONS = {
  pc: {
    id: 'pc',
    title: 'Project Coordinator',
    duty: 'Raise material requests (PR) for your site and track them through delivery.',
    color: '#0284c7',
    allowedNavs: ['/requisitions', '/deliveries']
  },
  purchase: {
    id: 'purchase',
    title: 'Purchase Department',
    duty: 'Send RFQs and revisions, evaluate vendor bids, and shortlist competitive quotes.',
    color: '#4f46e5',
    allowedNavs: ['/requisitions', '/rfqs', '/orders', '/vendors']
  },
  director_1: {
    id: 'director_1',
    baseRole: 'director',
    directorId: 5,
    title: 'Director 1',
    duty: 'Director 1: Review and approve assigned RFQ bids, authorize PO issuance, and monitor requisitions.',
    color: '#d97706',
    allowedNavs: ['/rfqs', '/orders', '/audit', '/requisitions']
  },
  director_2: {
    id: 'director_2',
    baseRole: 'director',
    directorId: 6,
    title: 'Director 2',
    duty: 'Director 2: Review and approve assigned RFQ bids, authorize PO issuance, and monitor requisitions.',
    color: '#b45309',
    allowedNavs: ['/rfqs', '/orders', '/audit', '/requisitions']
  },
  director_3: {
    id: 'director_3',
    baseRole: 'director',
    directorId: 7,
    title: 'Director 3',
    duty: 'Director 3: Review and approve assigned RFQ bids, authorize PO issuance, and monitor requisitions.',
    color: '#92400e',
    allowedNavs: ['/rfqs', '/orders', '/audit', '/requisitions']
  },
  director: {
    id: 'director_1',
    baseRole: 'director',
    directorId: 5,
    title: 'Director 1',
    duty: 'Director 1: Review and approve assigned RFQ bids, authorize PO issuance, and monitor requisitions.',
    color: '#d97706',
    allowedNavs: ['/rfqs', '/orders', '/audit', '/requisitions']
  },
  accounts: {
    id: 'accounts',
    title: 'Accounts',
    duty: 'Track vendor payables, credit terms, and disburse payments via RTGS/NEFT with bank UTRs.',
    color: '#059669',
    allowedNavs: ['/orders', '/deliveries', '/payments']
  },
  supervisor: {
    id: 'supervisor',
    title: 'Site Supervisor',
    duty: 'Verify physical material receipts against vendor challans at project site and confirm delivery.',
    color: '#e11d48',
    allowedNavs: ['/requisitions', '/deliveries']
  },
  vendor: {
    id: 'vendor',
    title: 'Vendor / Supplier',
    duty: 'Submit quotation rates against RFQs, acknowledge awarded purchase orders, and dispatch shipments.',
    color: '#0891b2',
    allowedNavs: ['/vendor-portal', '/rfqs', '/orders']
  },
  admin: {
    id: 'admin',
    title: 'Administrator',
    duty: 'Complete administrative control: user roles, project sites, material catalogue, and audit logs.',
    color: '#7c3aed',
    allowedNavs: ['/requisitions', '/rfqs', '/orders', '/deliveries', '/payments', '/materials', '/sites', '/vendors', '/audit', '/users']
  }
};

/**
 * Resolves director variant key (director_1, director_2, director_3) based on user record
 */
export const resolveDirectorKey = (u) => {
  if (!u) return 'director_1';
  const idNum = Number(u.id);
  const emailStr = String(u.email || '').toLowerCase();
  if (idNum === 6 || idNum === 10 || emailStr.includes('director2')) return 'director_2';
  if (idNum === 7 || idNum === 11 || emailStr.includes('director3')) return 'director_3';
  return 'director_1';
};

/**
 * Resolves active effective role key based on user and admin view mode
 */
export const resolveRoleKey = (u, adminView) => {
  if (!u || !u.role) return null;
  if (u.role === 'admin') return adminView;
  return u.role === 'director' ? resolveDirectorKey(u) : u.role;
};

/**
 * Default post-login landing path per active role
 */
export const landingPathFor = (role) => {
  if (role === 'vendor') return '/vendor-portal';
  if (role === 'accounts') return '/payments';
  return '/requisitions';
};
