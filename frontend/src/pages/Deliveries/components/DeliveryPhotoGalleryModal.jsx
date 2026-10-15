import React from 'react';
import { Download, FileText } from 'lucide-react';
import { handleDownloadPhoto, handleDownloadAllPhotos } from '@/utils';

export const DeliveryPhotoGalleryModal = ({
  gallery = null,
  onCloseGallery,
  previewPhoto = null,
  onClosePreview,
  onOpenPreview
}) => {
  return (
    <>
      {/* Lightbox / Preview Photo Modal */}
      {previewPhoto && (
        <div 
          className="modal-backdrop" 
          onClick={onClosePreview} 
          style={{ 
            zIndex: 1400, 
            background: 'rgba(0,0,0,0.85)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <div style={{ position: 'absolute', top: -40, right: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleDownloadPhoto(previewPhoto, 'challan_doc_preview')}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Download size={14} />
                <span>Download Photo</span>
              </button>
              <button
                onClick={onClosePreview}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.8rem', cursor: 'pointer', lineHeight: 1 }}
                title="Close"
              >
                ✕
              </button>
            </div>
            <img
              src={previewPhoto}
              alt="Photo Preview"
              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
            />
          </div>
        </div>
      )}

      {/* Photo Gallery Modal */}
      {gallery && (
        <div className="modal-backdrop" onClick={onCloseGallery} style={{ zIndex: 1300 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  {gallery.title}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  PO: {gallery.po_no} • Challan: {gallery.challan_no}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleDownloadAllPhotos(gallery.photos, `challan_bill_${gallery.challan_no || 'docs'}`)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                  title="Download all files in this gallery"
                >
                  <Download size={13} />
                  <span>Download All</span>
                </button>
                <button onClick={onCloseGallery} className="close-btn">×</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.85rem' }}>
              {gallery.photos && gallery.photos.map((p, idx) => {
                const src = p.dataUrl || p.url || p;
                const isPdf = (p.name && p.name.toLowerCase().endsWith('.pdf')) || (typeof src === 'string' && src.startsWith('data:application/pdf'));

                return (
                  <div key={idx} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                    {isPdf ? (
                      <div 
                        onClick={() => {
                          const w = window.open('');
                          w.document.write(`<iframe src="${src}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                        }}
                        style={{ height: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', cursor: 'pointer', gap: '0.5rem' }}
                      >
                        <FileText size={38} color="#ef4444" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>PDF Document</span>
                        <span style={{ fontSize: '0.72rem', color: '#2563eb' }}>Click to Open</span>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', height: '150px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img
                          src={src}
                          alt={p.name || `Photo ${idx + 1}`}
                          onClick={() => onOpenPreview ? onOpenPreview(src) : null}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer', background: '#ffffff' }}
                          title="Click to view full image"
                        />
                      </div>
                    )}
                    <div style={{ padding: '0.5rem 0.65rem', borderTop: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>
                        {p.name || `Attachment #${idx + 1}`}
                      </span>
                      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => handleDownloadPhoto(p, `challan_${gallery.challan_no || 'doc'}_${idx + 1}`)}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#2563eb', borderColor: '#bfdbfe' }}
                          title="Download this document"
                        >
                          <Download size={11} />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isPdf) {
                              const w = window.open('');
                              w.document.write(`<iframe src="${src}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                            } else if (onOpenPreview) {
                              onOpenPreview(src);
                            }
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'right', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button onClick={onCloseGallery} className="btn btn-secondary btn-sm">
                Close Gallery
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeliveryPhotoGalleryModal;
