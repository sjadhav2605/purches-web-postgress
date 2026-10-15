import React, { useState } from 'react';
import { 
  Layers, 
  Send, 
  Copy, 
  Check, 
  ChevronRight, 
  MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProcurementView = () => {
  const [evaluations, setEvaluations] = useState([
    {
      id: 318,
      rfq_no: 'RFQ-2026-0318',
      item: 'AAC Lightweight Concrete Blocks (600x200x150mm)',
      qty: '4,500 Nos',
      site: 'Kharadi IT Park (Block 2)',
      budget_rate: 65,
      vendors: [
        { name: 'Siporex India Pvt. Ltd.', rate: 58.50, total: 263250, l1: true, saving: '10.0%' },
        { name: 'Magicrete Building Solutions', rate: 64.00, total: 288000, l1: false, saving: '1.5%' },
        { name: 'Biltech Building Elements', rate: 66.50, total: 299250, l1: false, saving: '+2.3%' }
      ],
      poGenerated: false
    },
    {
      id: 314,
      rfq_no: 'RFQ-2026-0314',
      item: 'Polycab 2.5 sq mm FRLS Copper Electrical Wire',
      qty: '60 Coils (90m each)',
      site: 'Baner Commercial Tower',
      budget_rate: 2000,
      vendors: [
        { name: 'Polycab Authorized Distributor', rate: 1820, total: 109200, l1: true, saving: '9.0%' },
        { name: 'Havells Trade Agency', rate: 1950, total: 117000, l1: false, saving: '2.5%' },
        { name: 'RR Kabel City Wholesaler', rate: 2040, total: 122400, l1: false, saving: '+2.0%' }
      ],
      poGenerated: false
    }
  ]);

  const [toastMessage, setToastMessage] = useState(null);

  const [selectedPo, setSelectedPo] = useState('PO-2026-0887');
  const [vendorName, setVendorName] = useState('Tata Steel Tubes & TMT');
  const [vendorPhone, setVendorPhone] = useState('9822019844');
  const [copiedLink, setCopiedLink] = useState(false);

  const samplePOs = [
    { po_no: 'PO-2026-0887', vendor: 'Tata Steel Tubes & TMT', phone: '9822019844', site: 'Baner Tower' },
    { po_no: 'PO-2026-0891', vendor: 'UltraTech Cement Ltd.', phone: '9850123456', site: 'Kharadi IT Park' },
    { po_no: 'PO-2026-0884', vendor: 'Finolex Cables Ltd.', phone: '9422998877', site: 'Wakad Enclave' }
  ];

  const handlePoSelect = (poNo) => {
    const found = samplePOs.find(p => p.po_no === poNo);
    if (found) {
      setSelectedPo(found.po_no);
      setVendorName(found.vendor);
      setVendorPhone(found.phone);
    }
  };

  const dispatchUrl = `${window.location.origin}/delivery-schedule/${selectedPo}?v=1`;
  const whatsappMsg = `Hello ${vendorName},\n\nPlease update your expected arrival date and driver details for Purchase Order *${selectedPo}*:\n${dispatchUrl}\n\nThank you,\nDDPL Purchase Department`;

  const handleCopyDispatch = () => {
    navigator.clipboard.writeText(dispatchUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const cleanPhone = vendorPhone.replace(/[^0-9]/g, '');
    const url = `https://api.whatsapp.com/send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(whatsappMsg)}`;
    window.open(url, '_blank');
  };

  const handleGeneratePo = (rfqId, l1Vendor) => {
    setEvaluations(evaluations.map(e => e.id === rfqId ? { ...e, poGenerated: true } : e));
    setToastMessage({
      type: 'success',
      text: `Draft Purchase Order initiated for ${l1Vendor.name} at ₹${l1Vendor.rate} rate. Routing to approval queue.`
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="bento-toast bento-toast-success">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={16} />
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Main Bento Layout: 8-Col Evaluation Matrix + 4-Col Side WhatsApp Generator */}
      <div className="bento-layout-grid">
        {/* Main Card: Live Quotation Evaluation Matrix (8 cols) */}
        <div className="bento-col-8 bento-card">
          <div>
            <div className="bento-card-header">
              <div>
                <h2 className="bento-card-title">
                  <span>Live Quotation Evaluation Matrix</span>
                  <span className="bento-badge bento-badge-info">L1 Automated Ranking</span>
                </h2>
                <p className="bento-card-subtitle">
                  Multi-vendor rate comparison with budget variance and one-click PO conversion.
                </p>
              </div>

              <Link to="/rfqs" className="bento-btn bento-btn-secondary bento-btn-sm">
                <span>View RFQ Portal</span>
                <ChevronRight size={13} />
              </Link>
            </div>

            {/* Matrix Cards for RFQs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {evaluations.map((evalItem) => {
                const l1Vendor = evalItem.vendors.find(v => v.l1);

                return (
                  <div key={evalItem.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingBottom: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="bento-badge bento-badge-info">{evalItem.rfq_no}</span>
                          <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{evalItem.item}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                          Qty: <strong>{evalItem.qty}</strong> • Site: <strong>{evalItem.site}</strong> • Target Budget: <strong>₹{evalItem.budget_rate} / unit</strong>
                        </div>
                      </div>

                      {evalItem.poGenerated ? (
                        <span className="bento-badge bento-badge-success">
                          <Check size={12} />
                          <span>PO Generated</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleGeneratePo(evalItem.id, l1Vendor)}
                          className="bento-btn bento-btn-primary bento-btn-sm"
                        >
                          <ShoppingCart size={13} />
                          <span>Generate PO (L1)</span>
                        </button>
                      )}
                    </div>

                    {/* Vendor Rate Comparison Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', marginTop: '0.75rem' }}>
                      {evalItem.vendors.map((vendor, vIdx) => (
                        <div
                          key={vIdx}
                          style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: vendor.l1 ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                            background: vendor.l1 ? '#f0fdf4' : '#ffffff',
                            boxShadow: vendor.l1 ? '0 2px 4px rgba(16, 185, 129, 0.1)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {vendor.name}
                            </span>
                            {vendor.l1 && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#059669', color: '#ffffff', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                L1
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                            ₹{vendor.rate.toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#64748b' }}>/ unit</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
                            <span>Total: ₹{vendor.total.toLocaleString('en-IN')}</span>
                            <strong style={{ color: vendor.l1 ? '#059669' : '#475569' }}>{vendor.saving}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bento-card-footer">
            <span>Competitive bidding enforced: Minimum 3 quotes per category</span>
            <strong style={{ color: '#334155' }}>Procurement Policy Compliant</strong>
          </div>
        </div>

        {/* Side Card: Quick Vendor WhatsApp Dispatch Generator (4 cols) */}
        <div className="bento-col-4 bento-card">
          <div>
            <div className="bento-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Vendor Dispatch Portal</h3>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Generate WhatsApp arrival link</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Select Purchase Order
                </label>
                <select
                  value={selectedPo}
                  onChange={(e) => handlePoSelect(e.target.value)}
                  style={{ width: '100%', fontSize: '0.78rem', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                >
                  {samplePOs.map((p) => (
                    <option key={p.po_no} value={p.po_no}>
                      {p.po_no} - {p.vendor} ({p.site})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Vendor Contact Phone (WhatsApp)
                </label>
                <input
                  type="text"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="e.g. 9822019844"
                  style={{ width: '100%', fontSize: '0.78rem', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Automated Dispatch Notification Preview
                </label>
                <textarea
                  readOnly
                  rows={4}
                  value={whatsappMsg}
                  style={{ width: '100%', fontSize: '0.72rem', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontFamily: 'monospace', resize: 'none', lineHeight: 1.35 }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={handleCopyDispatch}
                  className="bento-btn bento-btn-secondary"
                  style={{ flex: 1 }}
                >
                  {copiedLink ? <Check size={13} style={{ color: '#059669' }} /> : <Copy size={13} />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="bento-btn bento-btn-success"
                  style={{ flex: 1 }}
                >
                  <Send size={13} />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bento-card-footer">
            <span>Direct vendor input without login</span>
            <strong style={{ color: '#059669' }}>Encrypted Token</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcurementView;
