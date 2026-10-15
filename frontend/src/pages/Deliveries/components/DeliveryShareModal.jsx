import React from 'react';
import { Truck, X, Copy, Check, ExternalLink } from 'lucide-react';

export const DeliveryShareModal = ({
  po = null,
  onClose,
  copiedLinkPoId = null,
  onCopyLink,
  onWhatsAppShare,
  getDeliveryShareUrl
}) => {
  if (!po) return null;

  const shareUrl = getDeliveryShareUrl ? getDeliveryShareUrl(po) : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={20} color="#2563eb" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Share Delivery Schedule Link
            </h3>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '0.75rem' }}>
            Send this link to <strong>{po.vendor_name}</strong> so they can confirm when materials will arrive for PO <strong>{po.po_no}</strong>.
          </p>

          <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.2rem' }}>DESTINATION SITE:</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{po.site_name} ({po.site_code})</div>
            {po.expected_delivery_date && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>
                Current Expected Date: {new Date(po.expected_delivery_date).toLocaleDateString()}
              </div>
            )}
          </div>

          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
            Direct Vendor Portal Link:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              className="form-control"
              value={shareUrl}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem', background: '#ffffff', color: '#0f172a' }}
            />
            <button
              type="button"
              onClick={() => onCopyLink && onCopyLink(po)}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              {copiedLinkPoId === po.id ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span>{copiedLinkPoId === po.id ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={() => onWhatsAppShare && onWhatsAppShare(po)}
            className="btn btn-secondary"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              fontSize: '0.85rem',
              color: '#15803d',
              borderColor: '#86efac',
              background: '#f0fdf4'
            }}
          >
            <span>💬 Send via WhatsApp</span>
          </button>

          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <ExternalLink size={14} />
            <span>Open Link</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default DeliveryShareModal;
