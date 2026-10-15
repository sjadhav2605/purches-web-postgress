/**
 * Role Constants for DDPL Procurement Portal
 */
export const ROLES = {
  ADMIN: 'admin',
  DIRECTOR: 'director',
  PURCHASE: 'purchase',
  PC: 'pc',                 // Project Coordinator (Site PR Creator)
  ACCOUNTS: 'accounts',
  SUPERVISOR: 'supervisor', // Site Supervisor (Delivery verification)
  VENDOR: 'vendor'
};

export const ALL_ROLES = Object.values(ROLES);
