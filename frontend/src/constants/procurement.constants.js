/**
 * Procurement domain options, dropdown lists, and business defaults
 */

export const DEFAULT_GST_RATE = 0.18; // 18% Standard GST

export const UOM_OPTIONS = Object.freeze([
  'Nos',
  'Bags',
  'Kg',
  'Mtr',
  'SqFt',
  'CuMtr',
  'Ltr',
  'Pcs',
  'Ton',
  'Box',
  'Roll',
  'Set',
  'Brass'
]);

export const PAYMENT_TERMS_OPTIONS = Object.freeze([
  '100% Against Delivery',
  '50% Advance, 50% Against Delivery',
  '30 Days Credit',
  '45 Days Credit',
  '60 Days Credit',
  '15 Days from Invoice',
  'Immediate RTGS / NEFT on Dispatch',
  'Against Proforma Invoice (Advance)'
]);

export const QUOTE_SOURCE_OPTIONS = Object.freeze([
  { id: 'phone', label: 'Phone Call' },
  { id: 'email', label: 'Email' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'vendor_portal', label: 'Vendor Self-Service Portal' },
  { id: 'in_person', label: 'In-Person / Meeting' }
]);

export const DELIVERY_TABS = Object.freeze([
  { id: 'site-receipts', label: 'Site Receipts' },
  { id: 'vendor-challans', label: 'Vendor Billed Challans' }
]);

export const PR_TABS = Object.freeze([
  { id: 'all', label: 'All Requests' },
  { id: 'pending', label: 'Pending Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'declined', label: 'Declined' }
]);
