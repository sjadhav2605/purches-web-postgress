import pool from '../config/db.js';
import nodemailer from 'nodemailer';
import { formatWorkflowDateTime } from '../utils/dateFormatter.js';

/**
 * DDPL Unified Notification Dispatcher
 * Dispatches:
 * 1. In-app dashboard notifications (notifications table)
 * 2. Email (SMTP configured via .env or console fallback)
 * 3. WhatsApp (WhatsApp Cloud API / Twilio configured via .env or console fallback)
 */

let emailTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  try {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } catch (err) {
    console.warn('[NotificationDispatcher] SMTP initialization notice:', err.message);
  }
}

/**
 * Resolves recipients into a list of normalized target objects:
 * [{ id, user_id, vendor_id, role, name, email, phone }]
 */
async function resolveRecipients(recipients, connection = null) {
  const db = connection || pool;
  const list = Array.isArray(recipients) ? recipients : [recipients];
  const targets = [];

  for (const item of list) {
    if (!item) continue;

    // Role string, e.g. 'pc', 'purchase', 'director', 'supervisor', 'admin'
    if (typeof item === 'string') {
      const [rows] = await db.query(
        "SELECT id AS user_id, name, email, role, vendor_id FROM users WHERE role = ? AND status = 'active'",
        [item]
      );
      for (const r of rows) {
        targets.push(r);
      }
      continue;
    }

    // Numerical user ID
    if (typeof item === 'number') {
      const [rows] = await db.query(
        'SELECT id AS user_id, name, email, role, vendor_id FROM users WHERE id = ?',
        [item]
      );
      if (rows.length > 0) targets.push(rows[0]);
      continue;
    }

    // Target object: { user_id, vendor_id, role, email, phone, name }
    if (typeof item === 'object') {
      if (item.vendor_id && !item.email) {
        const [vRows] = await db.query(
          `SELECT v.id AS vendor_id, v.name, v.email, v.phone, u.id AS user_id, 'vendor' AS role
           FROM vendors v
           LEFT JOIN users u ON u.vendor_id = v.id
           WHERE v.id = ?`,
          [item.vendor_id]
        );
        if (vRows.length > 0) {
          targets.push({ ...item, ...vRows[0] });
          continue;
        }
      }

      if (item.user_id && !item.email) {
        const [uRows] = await db.query(
          'SELECT id AS user_id, name, email, role, vendor_id FROM users WHERE id = ?',
          [item.user_id]
        );
        if (uRows.length > 0) {
          targets.push({ ...item, ...uRows[0] });
          continue;
        }
      }

      targets.push(item);
    }
  }

  // Deduplicate by user_id or vendor_id or email
  const unique = [];
  const seen = new Set();
  for (const t of targets) {
    const key = t.user_id ? `u_${t.user_id}` : (t.vendor_id ? `v_${t.vendor_id}` : (t.email || Math.random()));
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }
  return unique;
}

/**
 * Formats notification content from event type and payload
 */
function buildEventContent(event, payload = {}) {
  const ts = formatWorkflowDateTime(payload.timestamp || new Date());
  let title = 'DDPL Procurement Notification';
  let message = '';
  let link = payload.link || '/requisitions';

  switch (event) {
    case 'PR_RAISED':
      title = `New Request: ${payload.pr_no} Raised`;
      message = `Site Supervisor ${payload.requester_name || 'Supervisor'} raised Request ${payload.pr_no} for ${payload.site_name || 'Site'} on ${ts} (${payload.items_count || (payload.items?.length) || 1} items).`;
      link = `/requisitions/${payload.requisition_id || ''}`;
      break;

    case 'COORDINATOR_APPROVED':
      title = `Request ${payload.pr_no}: Approved by Coordinator`;
      message = `Project Coordinator ${payload.actor_name || ''} approved Request ${payload.pr_no} (${payload.site_name || ''}) on ${ts} and forwarded it to the Purchase Department.`;
      link = `/requisitions/${payload.requisition_id || ''}`;
      break;

    case 'COORDINATOR_DECLINED':
      title = `Request ${payload.pr_no}: Declined by Coordinator`;
      message = `Project Coordinator ${payload.actor_name || ''} declined Request ${payload.pr_no} on ${ts}. Reason: "${payload.reason || 'No reason provided'}".`;
      link = `/requisitions/${payload.requisition_id || ''}`;
      break;

    case 'PURCHASE_APPROVED':
      title = `RFQ ${payload.rfq_no || payload.pr_no}: Request Approved & RFQ Sent`;
      message = `Purchase Department approved Request ${payload.pr_no} on ${ts} and sent RFQ ${payload.rfq_no || ''} for ${payload.site_name || 'Site'}. Deadline: ${payload.deadline || '7 days'}.`;
      link = payload.rfq_id ? `/rfqs/${payload.rfq_id}` : `/vendor-portal`;
      break;

    case 'PURCHASE_DECLINED':
      title = `Request ${payload.pr_no}: Declined by Purchase Department`;
      message = `Purchase Department declined Request ${payload.pr_no} on ${ts}. Reason: "${payload.reason || 'No reason provided'}".`;
      link = `/requisitions/${payload.requisition_id || ''}`;
      break;

    case 'VENDOR_REVISION_REQUESTED':
      title = `RFQ ${payload.rfq_no}: Rate Revision Requested (Round ${payload.round || 1})`;
      message = `Purchase Department requested revised rates for RFQ ${payload.rfq_no} on ${ts}. Remarks: "${payload.remarks || 'Please review item rates'}".`;
      link = `/vendor-portal`;
      break;

    case 'VENDOR_ACCEPTED':
      title = `RFQ ${payload.rfq_no}: Vendor Submitted Revision`;
      message = `Vendor "${payload.vendor_name || 'Vendor'}" submitted revised rates for RFQ ${payload.rfq_no} (Total: ₹${Number(payload.total_amount || 0).toLocaleString()}) on ${ts}.`;
      link = payload.rfq_id ? `/rfqs/${payload.rfq_id}` : `/rfqs`;
      break;

    case 'DIRECTOR_APPROVED':
      title = `RFQ ${payload.rfq_no}: Approved by Director`;
      message = `Director approved winning bid for RFQ ${payload.rfq_no} on ${ts} (Vendor: ${payload.vendor_name || 'Vendor'}). Purchase Manager may now shortlist the vendor.`;
      link = payload.rfq_id ? `/rfqs/${payload.rfq_id}` : `/rfqs`;
      break;

    case 'DIRECTOR_DECLINED':
      title = `RFQ ${payload.rfq_no}: Declined by Director`;
      message = `Director declined RFQ ${payload.rfq_no} on ${ts}. Remark: "${payload.remark || payload.reason || 'Review required'}".`;
      link = payload.rfq_id ? `/rfqs/${payload.rfq_id}` : `/rfqs`;
      break;

    case 'VENDOR_SHORTLISTED':
      title = `You are shortlisted for RFQ ${payload.rfq_no}!`;
      message = `Congratulations! You have been shortlisted by DDPL for RFQ ${payload.rfq_no} (${payload.site_name || 'Site'}). Please proceed to enter dispatch and delivery details.`;
      link = `/vendor-portal`;
      break;

    case 'MATERIAL_DISPATCHED':
      title = `Material Dispatched for Request ${payload.pr_no}`;
      message = `Vendor "${payload.vendor_name || 'Vendor'}" dispatched materials on ${ts}. Challan: ${payload.challan_no || 'N/A'}, Vehicle: ${payload.vehicle_no || 'N/A'}, Qty: ${payload.dispatched_qty || 'All'}.`;
      link = `/deliveries`;
      break;

    case 'MATERIAL_RECEIVED':
      title = `Material Received at Site for Request ${payload.pr_no}`;
      message = `Site Supervisor ${payload.actor_name || 'Supervisor'} confirmed receipt of material at ${payload.site_name || 'Site'} on ${ts}. Received Qty: ${payload.received_qty || 'N/A'}, Challan: ${payload.challan_no || 'N/A'}.`;
      link = `/deliveries`;
      break;

    default:
      title = payload.title || `Procurement Update: ${payload.pr_no || ''}`;
      message = payload.message || `Status update at ${ts}`;
  }

  return { title, message, link, timestamp: ts };
}

/**
 * Core notify service
 * @param {string} event - Event type identifier
 * @param {string|number|object|Array} recipients - Role, User ID, Vendor ID, or target object
 * @param {object} payload - Contextual metadata for the event
 */
export async function notify(event, recipients, payload = {}) {
  // Fire-and-forget in setImmediate background execution so HTTP responses return instantly to the user
  setImmediate(async () => {
    try {
      const targets = await resolveRecipients(recipients);
      if (!targets || targets.length === 0) {
        return;
      }

    const { title, message, link, timestamp } = buildEventContent(event, payload);

    for (const target of targets) {
      const userId = target.user_id || target.id || null;
      const vendorId = target.vendor_id || null;
      let role = target.role || null;
      if (['COORDINATOR_APPROVED', 'COORDINATOR_DECLINED', 'PURCHASE_DECLINED', 'MATERIAL_DISPATCHED'].includes(event) && (!role || role === 'admin')) {
        role = 'supervisor';
      }
      const email = target.email || (role ? `${role}@ddpl.com` : null);
      const phone = target.phone || '+91 98220 00000';
      const recipientName = target.name || 'User';

      // (a) In-App Notification
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, vendor_id, role, title, message, link, type, channel, is_read)
           VALUES (?, ?, ?, ?, ?, ?, 'info', 'in_app', 0)`,
          [userId, vendorId, role, title, message, link]
        );
      } catch (inAppErr) {
        console.error('[NotificationDispatcher] In-App insert failed:', inAppErr.message);
      }

      // (b) Email Notification
      try {
        if (emailTransporter && email) {
          await emailTransporter.sendMail({
            from: process.env.SMTP_FROM || '"DDPL Procurement Portal" <procurement@ddpl.com>',
            to: email,
            subject: title,
            text: `Dear ${recipientName},\n\n${message}\n\nTimestamp: ${timestamp}\nPortal Link: ${process.env.CLIENT_URL || 'http://localhost:5173'}${link}\n\nRegards,\nDecent Decor Pvt. Ltd. (DDPL)`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background: #1e3a8a; padding: 1.25rem 1.5rem; color: #ffffff;">
                  <h2 style="margin: 0; font-size: 1.25rem;">DDPL Procurement Portal</h2>
                  <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: #bfdbfe;">Decent Decor Pvt. Ltd. (Pune)</p>
                </div>
                <div style="padding: 1.5rem;">
                  <h3 style="margin-top: 0; color: #0f172a;">${title}</h3>
                  <p style="font-size: 0.95rem;">${message}</p>
                  <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 0.75rem 1rem; margin: 1.25rem 0;">
                    <p style="margin: 0; font-size: 0.85rem; color: #64748b;"><strong>Timestamp:</strong> ${timestamp}</p>
                    ${payload.pr_no ? `<p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: #64748b;"><strong>Request No:</strong> ${payload.pr_no}</p>` : ''}
                    ${payload.site_name ? `<p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: #64748b;"><strong>Site:</strong> ${payload.site_name}</p>` : ''}
                  </div>
                  <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}${link}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 0.65rem 1.25rem; border-radius: 6px; font-weight: 600; font-size: 0.9rem;">View in Portal</a>
                </div>
                <div style="background: #f1f5f9; padding: 0.75rem 1.5rem; font-size: 0.75rem; color: #64748b; text-align: center;">
                  This is an automated notification from DDPL Procurement Portal. Please do not reply directly.
                </div>
              </div>
            `
          });
        } else {
          console.log(`📧 [Notification: Email] To: ${email} | Subject: ${title} | Message: ${message}`);
        }

        // Record email delivery record in notifications
        await pool.query(
          `INSERT INTO notifications (user_id, vendor_id, role, title, message, link, type, channel, is_read)
           VALUES (?, ?, ?, ?, ?, ?, 'email', 'email', 1)`,
          [userId, vendorId, role, `[Email] ${title}`, message, link]
        ).catch(() => {});
      } catch (emailErr) {
        console.warn(`[NotificationDispatcher] Email dispatch fallback to console: ${emailErr.message}`);
        console.log(`📧 [Notification: Email Fallback] To: ${email} | Subject: ${title}`);
      }

      // (c) WhatsApp Message
      try {
        if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && phone) {
          // Send via WhatsApp Business Cloud API
          const waUrl = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
          await fetch(waUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone.replace(/[^0-9]/g, ''),
              type: 'text',
              text: { body: `*DDPL Procurement Alert*\n\n*${title}*\n${message}\n\nTime: ${timestamp}\nLink: ${process.env.CLIENT_URL || 'http://localhost:5173'}${link}` }
            })
          });
        } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && phone) {
          // Send via Twilio WhatsApp API
          const twilioAuth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
          const formData = new URLSearchParams();
          formData.append('From', process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886');
          formData.append('To', `whatsapp:${phone.replace(/[^0-9+]/g, '')}`);
          formData.append('Body', `*DDPL Alert*: ${title}\n${message}`);

          await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
          });
        } else {
          console.log(`📱 [Notification: WhatsApp] To: ${phone} (${recipientName}) | Alert: *${title}* - ${message}`);
        }

        // Record whatsapp delivery record in notifications
        await pool.query(
          `INSERT INTO notifications (user_id, vendor_id, role, title, message, link, type, channel, is_read)
           VALUES (?, ?, ?, ?, ?, ?, 'whatsapp', 'whatsapp', 1)`,
          [userId, vendorId, role, `[WhatsApp] ${title}`, message, link]
        ).catch(() => {});
      } catch (waErr) {
        console.warn(`[NotificationDispatcher] WhatsApp dispatch fallback to console: ${waErr.message}`);
        console.log(`📱 [Notification: WhatsApp Fallback] To: ${phone} | ${title}`);
      }
    }
  } catch (err) {
    // Top level catcher: NEVER fail caller's request if notification fails
    console.error('[NotificationDispatcher] notify() non-fatal error:', err);
  }
});
}

export default { notify };
