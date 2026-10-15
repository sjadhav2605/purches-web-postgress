/**
 * Workflow status codes, pipeline definitions, and status visual badges
 */

export const PIPELINE_STAGES = Object.freeze([
  { num: 1, label: 'PR Raised', key: 'pr_raised', path: '/requisitions?tab=pending' },
  { num: 2, label: 'RFQ Sent', key: 'rfq_sent', path: '/rfqs?status=RFQ Sent' },
  { num: 3, label: 'Bids In', key: 'bids_in', path: '/rfqs?status=Bids In' },
  { num: 4, label: 'Shortlisted', key: 'shortlisted', path: '/rfqs?status=Shortlisted' },
  { num: 5, label: 'Approved', key: 'approved', path: '/rfqs?status=Approved' },
  { num: 6, label: 'PO Issued', key: 'po_issued', path: '/orders?status=Issued' },
  { num: 7, label: 'Delivered & verified', key: 'delivered_verified', path: '/deliveries' }
]);

export const REQUISITION_STATUS = Object.freeze({
  DRAFT: 'Draft',
  PR_RAISED: 'PR Raised',
  RFQ_SENT: 'RFQ Sent',
  SHORTLISTED: 'Shortlisted',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  PO_ISSUED: 'PO Issued',
  DELIVERED: 'Delivered'
});

export const RFQ_STATUS = Object.freeze({
  OPEN: 'Open',
  RFQ_SENT: 'RFQ Sent',
  BIDS_IN: 'Bids In',
  UNDER_REVIEW: 'Under_Review',
  SHORTLISTED: 'Shortlisted',
  APPROVED: 'Approved',
  AWARDED: 'Awarded',
  CLOSED: 'Closed'
});

export const PO_STATUS = Object.freeze({
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  ACKNOWLEDGED: 'Acknowledged',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  SITE_VERIFIED: 'Site Verified',
  PAID: 'Paid',
  CANCELLED: 'Cancelled'
});

export const DELIVERY_STATUS = Object.freeze({
  PENDING: 'Pending',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected'
});

export const PAYMENT_STATUS = Object.freeze({
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
  PAID: 'Paid',
  PROCESSING: 'Processing'
});

export const STATUS_THEMES = Object.freeze({
  'Approved': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'Awarded': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'Verified': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'Site Verified': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'Paid': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'Declined': { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  'Cancelled': { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  'Rejected': { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  'Draft': { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  'Pending': { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  'Under_Review': { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  'Shortlisted': { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
  'RFQ Sent': { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  'PR Raised': { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  'Bids In': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  'Issued': { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  'Dispatched': { color: '#b45309', bg: '#fffbeb', border: '#fde68a' }
});
