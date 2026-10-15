import React from 'react';
import { Truck, CheckCircle2, AlertCircle, Camera } from 'lucide-react';

export const DeliveryUploadModal = ({
  isOpen = false,
  onClose,
  onSubmit,
  submitting = false,
  pos = [],
  sites = [],
  poId = '',
  onPoChange,
  siteId = '',
  onSiteChange,
  challanNo = '',
  onChallanNoChange,
  receivedDate = '',
  onReceivedDateChange,
  remarks = '',
  onRemarksChange,
  damageRemarks = '',
  onDamageRemarksChange,
  poItems = [],
  onItemQtyChange,
  challanPhotos = [],
  onChallanPhotoUpload,
  onRemoveChallanPhoto,
  materialPhotos = [],
  onMaterialPhotoUpload,
  onRemoveMaterialPhoto,
  damagePhotos = [],
  onDamagePhotoUpload,
  onRemoveDamagePhoto,
  onPreviewPhoto
}) => {
  if (!isOpen) return null;

  const currentSelectedPo = pos.find((p) => String(p.id) === String(poId));
  const hasDamagedItems = poItems.some(it => Number(it.damaged_qty) > 0);
  const totalDamagedCount = poItems.reduce((acc, it) => acc + (Number(it.damaged_qty) || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '640px', width: '100%', margin: 0, maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
              <Truck size={18} style={{ color: 'var(--primary-600)' }} />
              <span>Record Site Material Receipt & Challan</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              Requires Challan Number, at least 1 Challan photo, and at least 1 Material photo.
            </p>
          </div>
          <button onClick={onClose} className="close-btn" type="button">×</button>
        </div>

        <form onSubmit={onSubmit}>
          {/* Active PO Dispatch Details Banner */}
          {currentSelectedPo && (currentSelectedPo.expected_delivery_date || currentSelectedPo.status === 'Dispatched') && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <Truck size={16} />
                <span>Vendor Dispatch Notice</span>
              </div>
              <div style={{ color: '#14532d', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.4rem' }}>
                <div>📅 Expected Site Arrival: <strong>{currentSelectedPo.expected_delivery_date ? new Date(currentSelectedPo.expected_delivery_date).toLocaleDateString() : 'Pending'}</strong></div>
                <div>📄 Vendor Challan: <strong>{currentSelectedPo.invoice_no || 'N/A'}</strong></div>
                {currentSelectedPo.dispatch_notes && (
                  <div style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: '#15803d' }}>
                    🚚 Transporter: {currentSelectedPo.dispatch_notes}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Purchase Order (PO) *</label>
              <select
                className="form-control"
                value={poId}
                onChange={(e) => onPoChange(e.target.value)}
                required
              >
                {pos.length === 0 ? (
                  <option value="">No pending POs found</option>
                ) : (
                  pos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.po_no} — {p.vendor_name} ({p.status})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Delivery Site *</label>
              <select
                className="form-control"
                value={siteId}
                onChange={(e) => onSiteChange(e.target.value)}
                required
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} ({s.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Vendor Challan Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. CH-2026-9812"
                className="form-control"
                value={challanNo}
                onChange={(e) => onChallanNoChange(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Receipt Date *</label>
              <input
                type="date"
                required
                className="form-control"
                value={receivedDate}
                onChange={(e) => onReceivedDateChange(e.target.value)}
              />
            </div>
          </div>

          {/* Line items verification */}
          {poItems.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                Material Items Received:
              </label>
              <div className="table-responsive" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ textAlign: 'center', width: '80px' }}>Ordered</th>
                      <th style={{ width: '115px' }}>Received OK</th>
                      <th style={{ width: '125px', color: '#dc2626' }}>Damaged / Defect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((it, idx) => {
                      const isDamaged = Number(it.damaged_qty || 0) > 0;
                      return (
                        <tr key={idx} style={{ background: isDamaged ? '#fff1f2' : 'transparent' }}>
                          <td style={{ fontSize: '0.85rem' }}>
                            <strong>{it.description}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{it.unit}</div>
                          </td>
                          <td style={{ fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>{it.ordered_qty}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              className="form-control"
                              value={it.received_qty}
                              onChange={(e) => onItemQtyChange(idx, 'received_qty', e.target.value)}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              className="form-control"
                              value={it.damaged_qty}
                              onChange={(e) => onItemQtyChange(idx, 'damaged_qty', e.target.value)}
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                fontSize: '0.85rem',
                                borderColor: isDamaged ? '#f43f5e' : undefined,
                                color: isDamaged ? '#e11d48' : undefined,
                                fontWeight: isDamaged ? 700 : 400
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {hasDamagedItems && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', padding: '0.45rem 0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#9f1239', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={15} />
                  <span>
                    <strong>{totalDamagedCount} defective/damaged item(s) flagged!</strong> Please attach Damage Photos below so vendor receives full proof.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Photo Upload Sections (Challan + Material + Damage photos) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {/* Challan Photo */}
            <div style={{ background: 'var(--bg-card-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700 }}>
                  📄 Challan Photo *
                </label>
                <span style={{ fontSize: '0.72rem', color: challanPhotos.length > 0 ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}>
                  {challanPhotos.length} attached
                </span>
              </div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                <Camera size={14} />
                <span>Upload Challan</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => onChallanPhotoUpload(e.target.files)}
                />
              </label>
              {challanPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {challanPhotos.map((p, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img 
                        src={p.dataUrl} 
                        alt={p.name} 
                        onClick={() => onPreviewPhoto(p.dataUrl)}
                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} 
                        title="Click to preview"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveChallanPhoto(i)}
                        style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Material Photo */}
            <div style={{ background: 'var(--bg-card-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700 }}>
                  📷 Material Photo *
                </label>
                <span style={{ fontSize: '0.72rem', color: materialPhotos.length > 0 ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}>
                  {materialPhotos.length} attached
                </span>
              </div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                <Camera size={14} />
                <span>Upload Material</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => onMaterialPhotoUpload(e.target.files)}
                />
              </label>
              {materialPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {materialPhotos.map((p, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img 
                        src={p.dataUrl} 
                        alt={p.name} 
                        onClick={() => onPreviewPhoto(p.dataUrl)}
                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} 
                        title="Click to preview"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveMaterialPhoto(i)}
                        style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Damage / Defect Photo */}
            <div style={{ background: damagePhotos.length > 0 ? '#fff1f2' : 'var(--bg-card-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: `1px solid ${damagePhotos.length > 0 ? '#fda4af' : 'var(--border-color)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#dc2626' }}>
                  ⚠️ Damage Photos
                </label>
                <span style={{ fontSize: '0.72rem', color: damagePhotos.length > 0 ? '#b91c1c' : 'var(--text-muted)', fontWeight: 600 }}>
                  {damagePhotos.length} attached
                </span>
              </div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center', borderColor: '#fca5a5', color: '#b91c1c' }}>
                <Camera size={14} />
                <span>Upload Damage</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => onDamagePhotoUpload(e.target.files)}
                />
              </label>
              {damagePhotos.length > 0 && (
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {damagePhotos.map((p, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img 
                        src={p.dataUrl} 
                        alt={p.name} 
                        onClick={() => onPreviewPhoto(p.dataUrl)}
                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #f43f5e' }} 
                        title="Click to preview"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveDamagePhoto(i)}
                        style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Damage Notes */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontSize: '0.82rem', color: hasDamagedItems ? '#dc2626' : undefined }}>
              Damage / Defect Notes {hasDamagedItems && '(Sent to Vendor in WhatsApp/Email Notice)'}
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 2 bags torn, 4 pcs cracked/chipped during offloading..."
              value={damageRemarks}
              onChange={(e) => onDamageRemarksChange(e.target.value)}
              style={{ borderColor: hasDamagedItems ? '#fca5a5' : undefined }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Site Verification Remarks</label>
            <textarea
              rows="2"
              className="form-control"
              value={remarks}
              onChange={(e) => onRemarksChange(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={16} />
              <span>{submitting ? 'Verifying...' : 'Confirm & Verify Receipt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryUploadModal;
