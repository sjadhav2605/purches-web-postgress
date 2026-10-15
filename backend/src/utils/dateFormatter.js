/**
 * Safe date parsing helper
 */
const parseSafeDate = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  if (typeof dateInput === 'string') {
    let normalized = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(' ', 'T');
    }
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(dateInput);
  return isNaN(fallback.getTime()) ? null : fallback;
};

/**
 * Formats a Date or date string to "DD-MMM-YYYY hh:mm AM/PM"
 * Example: 2026-10-09T10:00:00.000Z -> "09-Oct-2026 03:30 PM"
 */
export const formatWorkflowDateTime = (dateInput) => {
  if (!dateInput) return '';
  const d = parseSafeDate(dateInput);
  if (!d) return String(dateInput);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');

  return `${day}-${month}-${year} ${formattedHours}:${minutes} ${ampm}`;
};

export const formatWorkflowDate = (dateInput) => {
  if (!dateInput) return '';
  const d = parseSafeDate(dateInput);
  if (!d) return String(dateInput);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};
