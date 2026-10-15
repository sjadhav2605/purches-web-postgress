/**
 * API Endpoints, base URL, and network configuration constants
 */

export const API_CONFIG = Object.freeze({
  DEFAULT_BASE_URL: '/api/v1',
  DEFAULT_TIMEOUT_MS: 60000 // 60s timeout for cold starts on free-tier platforms
});

export const API_ENDPOINTS = Object.freeze({
  AUTH: {
    LOGIN: '/auth/login',
    ME: '/auth/me',
    REGISTER: '/auth/register'
  },
  REQUISITIONS: {
    BASE: '/requisitions',
    BY_ID: (id) => `/requisitions/${id}`,
    STATUS: (id) => `/requisitions/${id}/status`,
    PIPELINE_STATS: '/requisitions/pipeline-stats'
  },
  RFQS: {
    BASE: '/rfqs',
    BY_ID: (id) => `/rfqs/${id}`,
    BIDS: (id) => `/rfqs/${id}/bids`,
    BID_BY_ID: (rfqId, bidId) => `/rfqs/${rfqId}/bids/${bidId}`,
    REVISIONS: (id) => `/rfqs/${id}/revisions`,
    PUBLIC_QUOTE: (tokenOrId) => `/rfqs/public/${tokenOrId}`
  },
  ORDERS: {
    BASE: '/orders',
    BY_ID: (id) => `/orders/${id}`,
    STATUS: (id) => `/orders/${id}/status`
  },
  DELIVERIES: {
    BASE: '/deliveries',
    BY_ID: (id) => `/deliveries/${id}`,
    SCHEDULE: (id) => `/deliveries/schedule/${id}`
  },
  PAYMENTS: {
    BASE: '/payments',
    BY_ID: (id) => `/payments/${id}`
  },
  MASTERS: {
    MATERIALS: '/materials',
    SITES: '/sites',
    VENDORS: '/vendors'
  },
  USERS: {
    BASE: '/users',
    BY_ID: (id) => `/users/${id}`
  },
  AUDIT: {
    BASE: '/audit'
  },
  NOTIFICATIONS: {
    BASE: '/notifications',
    MARK_READ: (id) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/mark-all-read'
  },
  VENDOR_BILLED_CHALLANS: {
    BASE: '/vendor-billed-challans',
    BY_ID: (id) => `/vendor-billed-challans/${id}`
  }
});
