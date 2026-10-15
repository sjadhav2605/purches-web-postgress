/**
 * Currency & numerical formatters with Indian Numbering System (Lakhs / Crores)
 */

/**
 * Formats a number to Indian numbering system (e.g. 1,23,456.78)
 */
export const formatIndianNumber = (num, options = {}) => {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return '0.00';
  }
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  } = options;

  return Number(num).toLocaleString('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits
  });
};

/**
 * Formats an amount with the Indian Rupee symbol (₹)
 * Example: formatCurrency(125000) -> "₹1,25,000.00"
 */
export const formatCurrency = (amount, options = {}) => {
  const { showSymbol = true, ...formatOpts } = options;
  const formatted = formatIndianNumber(amount, formatOpts);
  return showSymbol ? `₹${formatted}` : formatted;
};

/**
 * Calculates 18% (or custom) GST amount
 */
export const calculateGst = (subtotal, rate = 0.18) => {
  const num = Number(subtotal) || 0;
  return Math.round(num * rate * 100) / 100;
};

/**
 * Calculates Grand Total including GST
 */
export const calculateTotalWithGst = (subtotal, rate = 0.18) => {
  const num = Number(subtotal) || 0;
  return Math.round((num + calculateGst(num, rate)) * 100) / 100;
};

/**
 * Safely parses any currency/input value into a float
 */
export const parseAmount = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};
