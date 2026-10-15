import React from 'react';
import { Truck, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';

export const DeliveryVendorNoticeModal = ({
  notice = null,
  onClose,
  copiedNoticeText = false,
  onCopyNoticeText,
  onSendEmail,
  onSendWhatsApp,
  buildReceiptVendorMessage
}) => {
  if (!notice) return null;

  const messageText = buildReceiptVendorMessage ? buildReceiptVendorMessage(notice) : '';

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1250 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={22} color="#16a34a" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#14532d' }}>
              Site Receipt Recorded & Verified!
            </h3>
          </div>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div><strong>PO Number:</strong> {notice.po_no}</div>
              <div><strong>Challan No:</strong> {notice.challan_no}</div>
              <div><strong>Site:</strong> {notice.site_code} ({notice.site_name})</div>
              <div><strong>Receipt Date:</strong> {notice.received_date}</div>
              <div><strong>Vendor:</strong> {notice.vendor?.name}</div>
              <div><strong>Vendor Phone:</strong> {notice.vendor?.phone || 'Not registered'}</div>
            </div>
          </div>

          {/* Status summary banner */}
          {notice.total_damaged > 0 ? (
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#9f1239' }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={16} />
                <span>⚠️ {notice.total_damaged} Damaged / Defective Pieces Reported!</span>
              </div>
              {notice.damage_remarks && (
                <div style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>
                  <strong>Defect Notes:</strong> {notice.damage_remarks}
                </div>
              )}
              <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: '#be123c' }}>
                Vendor will receive line-by-line inspection details for replacement or credit note.
              </div>
            </div>
          ) : (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#166534' }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={16} />
                <span>✓ All Items Received in Good Physical Condition (0 Defects)</span>
              </div>
            </div>
          )}

          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
            Inspection Notice Message Preview:
          </label>
          <textarea
            readOnly
            rows={7}
            className="form-control"
            value={messageText}
            style={{ fontSize: '0.8rem', background: '#f8fafc', color: '#1e293b', fontFamily: 'monospace', lineHeight: 1.4 }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onCopyNoticeText && onCopyNoticeText(notice)}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
          >
            {copiedNoticeText ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
            <span>{copiedNoticeText ? 'Copied!' : 'Copy Notice Text'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSendEmail && onSendEmail(notice)}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
          >
            <span>✉️ Send Email</span>
          </button>

          <button
            type="button"
            onClick={() => onSendWhatsApp && onSendWhatsApp(notice)}
            className="btn btn-primary"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              fontSize: '0.85rem',
              background: '#16a34a',
              borderColor: '#16a34a'
            }}
          >
            <span>💬 Send WhatsApp to Vendor</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryVendorNoticeModal;
