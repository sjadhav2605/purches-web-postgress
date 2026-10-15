/**
 * Pure String utility and formatting helpers
 */

/**
 * Capitalizes first letter of string
 */
export const capitalize = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Truncates string to specified maximum length with ellipsis
 */
export const truncate = (str, maxLength = 30) => {
  if (!str || typeof str !== 'string') return '';
  return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
};

/**
 * Extracts initials from person or organization name (e.g. "Decent Decor" -> "DD")
 */
export const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Formats a 10-digit Indian mobile number: "+91 98765 43210"
 */
export const formatPhone = (phone) => {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
};
