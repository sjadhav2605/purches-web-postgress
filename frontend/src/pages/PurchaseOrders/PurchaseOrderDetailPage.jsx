import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { poService } from '../../services/po.service.js';
import { paymentService } from '../../services/payment.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ArrowLeft, Printer, CheckCircle2, Truck, AlertCircle, ShoppingCart, Award, Check, Send, FileText, Edit3, Save, RotateCcw, CreditCard, Share2, Copy, ExternalLink, Calendar, X } from 'lucide-react';

const DEFAULT_DECLARATION = 'We declare that this Purchase Order shows the actual price of the goods described and that all particulars are true and correct. Materials must be supplied per specified brands and certified delivery challan.';

// Indian Numbering System: Amount in Words (Lakh / Crore, Paise)
const numberToWordsIndian = (num) => {
  if (!num || isNaN(num) || num <= 0) return 'Rupees Zero Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    let str = '';
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    } else {
      str += a[n];
    }
    return str;
  };

  const integerPart = Math.floor(num);
  const paisePart = Math.round((num - integerPart) * 100);

  let n = integerPart;
  let str = '';

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  n %= 100;

  if (crore > 0) str += inWords(crore) + 'Crore ';
  if (lakh > 0) str += inWords(lakh) + 'Lakh ';
  if (thousand > 0) str += inWords(thousand) + 'Thousand ';
  if (hundred > 0) str += inWords(hundred) + 'Hundred ';
  if (n > 0) str += inWords(n);

  let result = 'Rupees ' + (str.trim() || 'Zero') + ' Only';
  if (paisePart > 0) {
    result = 'Rupees ' + (str.trim() || 'Zero') + ' and ' + inWords(paisePart).trim() + ' Paise Only';
  }
  return result;
};

export const PurchaseOrderDetailPage = () => {
  const { id } = useParams();
  const { user, activeRole } = useAuth();

  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  // Commercial Terms & Declaration State (Purchase Manager)
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [advancePct, setAdvancePct] = useState(0);
  const [creditDays, setCreditDays] = useState(0);
  const [paymentTermsText, setPaymentTermsText] = useState('');
  const [declarationText, setDeclarationText] = useState(DEFAULT_DECLARATION);
  const [savingTerms, setSavingTerms] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [termsSuccess, setTermsSuccess] = useState('');
  const [poPayments, setPoPayments] = useState([]);
  const [copiedDeliveryLink, setCopiedDeliveryLink] = useState(false);

  // Extra Charges State (Delivery, Labour, Other, GST)
  const [deliveryCharges, setDeliveryCharges] = useState(0);
  const [labourCharges, setLabourCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [extraGstPct, setExtraGstPct] = useState(18);
  const [extraNotes, setExtraNotes] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const getDeliveryShareUrl = () => {
    if (!po) return '';
    const sigParam = po.delivery_sig ? `&sig=${po.delivery_sig}` : '';
    return `${window.location.origin}/delivery-schedule/${po.id}?v=${po.vendor_id || ''}${sigParam}`;
  };

  const handleCopyDeliveryLink = () => {
    const url = getDeliveryShareUrl();
    navigator.clipboard.writeText(url);
    setCopiedDeliveryLink(true);
    setTimeout(() => setCopiedDeliveryLink(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!po) return;
    const url = getDeliveryShareUrl();
    const msg = `Hello ${po.vendor_name || 'Vendor'},\n\nPlease specify your expected delivery date and dispatch details for Purchase Order *${po.po_no}* (${po.site_name || 'Site'}):\n${url}\n\nThank you,\nDDPL Purchase Department`;
    const phone = (po.vendor_phone || '').replace(/[^0-9]/g, '');
    const waUrl = phone ? `https://wa.me/91${phone.length === 10 ? phone : phone}?text=${encodeURIComponent(msg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const isPurchaseOrAdmin = ['purchase', 'admin'].includes(activeRole || user?.role);

  const fetchPoDetails = async () => {
    setLoading(true);
    try {
      const [poData, paymentsData] = await Promise.all([
        poService.getPOById(id),
        paymentService.getPaymentsByPo(id).catch(() => [])
      ]);
      setPo(poData);
      setPoPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (err) {
      setError(err.message || 'Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoDetails();
  }, [id]);

  useEffect(() => {
    if (po) {
      const adv = po.payment_terms?.advance_pct !== undefined ? Number(po.payment_terms.advance_pct) : 0;
      const cred = po.payment_terms?.credit_days !== undefined ? Number(po.payment_terms.credit_days) : 0;
      const terms = po.payment_terms?.notes || po.payment_terms?.payment_terms || po.payment_terms?.terms_and_conditions || '';
      const decl = po.declaration_text || DEFAULT_DECLARATION;

      setAdvancePct(adv);
      setCreditDays(cred);
      setPaymentTermsText(terms);
      setDeclarationText(decl);

      const extra = po.extra_charges || {};
      setDeliveryCharges(extra.delivery_charges !== undefined ? Number(extra.delivery_charges) : 0);
      setLabourCharges(extra.labour_charges !== undefined ? Number(extra.labour_charges) : 0);
      setOtherCharges(extra.other_charges !== undefined ? Number(extra.other_charges) : 0);
      setExtraGstPct(extra.gst_pct !== undefined ? Number(extra.gst_pct) : 18);
      setExtraNotes(extra.notes || '');
    }
  }, [po]);

  // Live preview computations
  const dCharge = Number(deliveryCharges) || 0;
  const lCharge = Number(labourCharges) || 0;
  const oCharge = Number(otherCharges) || 0;
  const extraSubtotal = Math.round((dCharge + lCharge + oCharge) * 100) / 100;
  const extraGstAmount = Math.round((extraSubtotal * ((Number(extraGstPct) || 0) / 100)) * 100) / 100;
  const totalExtra = Math.round((extraSubtotal + extraGstAmount) * 100) / 100;

  const matSubtotal = Number(po?.subtotal || 0);
  const matCgst = Number(po?.cgst || 0);
  const matSgst = Number(po?.sgst || 0);
  const matTotal = Math.round((matSubtotal + matCgst + matSgst) * 100) / 100;
  const previewGrandTotal = isEditingTerms ? Math.round((matTotal + totalExtra) * 100) / 100 : Number(po?.total_amount || 0);
  const previewAdvanceAmount = Math.round((previewGrandTotal * ((Number(advancePct) || 0) / 100)) * 100) / 100;

  const handleSaveCommercialTerms = async (e) => {
    if (e) e.preventDefault();
    setTermsError('');
    setTermsSuccess('');

    const adv = Number(advancePct);
    if (isNaN(adv) || adv < 0 || adv > 100) {
      setTermsError('Advance payment percentage must be between 0 and 100%');
      return;
    }

    const cred = Number(creditDays);
    if (isNaN(cred) || !Number.isInteger(cred) || cred < 0) {
      setTermsError('Credit period must be a whole number greater than or equal to 0 days');
      return;
    }

    if (!paymentTermsText.trim()) {
      setTermsError('Payment terms and conditions must not be empty');
      return;
    }

    setSavingTerms(true);
    try {
      const updatedPo = await poService.updateCommercialTerms(id, {
        advance_pct: adv,
        credit_days: cred,
        payment_terms: paymentTermsText.trim(),
        declaration_text: declarationText.trim() || DEFAULT_DECLARATION,
        extra_charges: {
          delivery_charges: dCharge,
          labour_charges: lCharge,
          other_charges: oCharge,
          gst_pct: Number(extraGstPct) || 0,
          notes: extraNotes.trim()
        }
      });

      // Update UI immediately with fresh values without a manual reload
      setPo(updatedPo);
      setTermsSuccess('Commercial terms, extra charges & declaration saved successfully!');
      setIsEditingTerms(false);
      setTimeout(() => setTermsSuccess(''), 4000);
    } catch (err) {
      setTermsError(err.message || 'Failed to save commercial terms');
    } finally {
      setSavingTerms(false);
    }
  };

  const handleIssuePoToVendor = async () => {
    if (!window.confirm(`Issue Purchase Order ${po.po_no} to vendor "${po.vendor_name}"? Once issued, the vendor will be able to access and dispatch this order.`)) {
      return;
    }
    setUpdating(true);
    try {
      await poService.updateStatus(id, 'Issued', '', `Purchase Manager ${user?.name || ''} issued PO to vendor`);
      await fetchPoDetails();
      alert(`Success! Purchase Order ${po.po_no} has been formally issued and sent to ${po.vendor_name}.`);
    } catch (err) {
      alert(err.message || 'Failed to issue PO');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    let invoiceNo = po.invoice_no || '';
    if (newStatus === 'Dispatched' && !invoiceNo) {
      invoiceNo = prompt('Please enter the Vendor Invoice Number / Delivery Challan Number:') || '';
      if (!invoiceNo) return;
    }

    if (!window.confirm(`Update PO status to "${newStatus}"?`)) return;

    setUpdating(true);
    try {
      await poService.updateStatus(id, newStatus, invoiceNo, `Status updated to ${newStatus} by ${user?.name || 'User'}`);
      await fetchPoDetails();
      alert(`PO Status successfully updated to: ${newStatus}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        Loading purchase order details...
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <AlertCircle size={40} style={{ color: 'var(--danger-text)', margin: '0 auto 1rem' }} />
        <h3>Purchase Order Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error || 'Unable to load PO.'}</p>
        <Link to="/orders" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to POs</span>
        </Link>
      </div>
    );
  }

  // Role permissions based on Active Role
  const effectiveRole = activeRole || user?.role;
  const isPriceRestricted = ['pc', 'supervisor'].includes(effectiveRole) || po.total_amount === null;
  const isLineRateRestricted = effectiveRole === 'accounts' || isPriceRestricted;

  return (
    <div>
      <style>{`
        @media print {
          .no-print, nav, header, aside, .btn {
            display: none !important;
          }
          body, #printable-po {
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* Top Action Bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/orders" className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{po.po_no}</h1>
              {po.status === 'Approved' ? (
                <span className="badge badge-warning" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                  Approved (Pending Issue)
                </span>
              ) : (
                <span className={`badge badge-${po.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                  {po.status}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Request: <strong>{po.pr_no}</strong> • Vendor: <strong>{po.vendor_name}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
            <Printer size={16} />
            <span>Print Official PO</span>
          </button>

          {/* Commercial Terms & Declaration (Purchase Manager / Admin Only) */}
          {isPurchaseOrAdmin && (
            <button
              onClick={() => setIsEditingTerms(prev => !prev)}
              className="btn btn-secondary btn-sm"
              style={{
                color: isEditingTerms ? 'var(--primary-800)' : 'var(--primary-700)',
                borderColor: 'var(--primary-300)',
                background: isEditingTerms ? 'var(--primary-50)' : 'transparent',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <FileText size={15} />
              <span>{isEditingTerms ? 'Hide Commercial Terms' : 'Commercial Terms'}</span>
            </button>
          )}

          {/* Purchase Manager / Admin Issues PO to Vendor */}
          {po.status === 'Approved' && isPurchaseOrAdmin && (
            <button
              disabled={updating}
              onClick={handleIssuePoToVendor}
              className="btn btn-primary btn-sm"
              style={{
                background: '#10b981',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Send size={15} />
              <span>Issue PO to Vendor ({po.vendor_name})</span>
            </button>
          )}

          {/* Vendor Acknowledge */}
          {po.status === 'Issued' && (
            <button
              disabled={updating}
              onClick={() => handleStatusChange('Acknowledged')}
              className="btn btn-secondary btn-sm"
              style={{ color: '#38bdf8', borderColor: '#38bdf8' }}
            >
              <Check size={14} />
              <span>Acknowledge Order</span>
            </button>
          )}

          {/* Vendor / Purchase Dispatched */}
          {(po.status === 'Issued' || po.status === 'Acknowledged') && (
            <button
              disabled={updating}
              onClick={() => handleStatusChange('Dispatched')}
              className="btn btn-primary btn-sm"
            >
              <Truck size={15} />
              <span>Mark Dispatched</span>
            </button>
          )}

          {/* Site Supervisor Verification */}
          {po.status === 'Dispatched' && (
            <Link
              to="/deliveries"
              className="btn btn-secondary btn-sm"
              style={{ color: 'var(--success-text)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
            >
              <CheckCircle2 size={15} />
              <span>Record Site Receipt (Deliveries)</span>
            </Link>
          )}
        </div>
      </div>

      {/* Vendor Delivery Schedule & Dispatch Tracking Card */}
      {po.status !== 'Draft' && (
        <div className="card no-print" style={{ marginBottom: '1.5rem', border: '1px solid #bfdbfe', background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e3a8a' }}>
                  Vendor Delivery & Dispatch Tracking
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.2rem' }}>
                  Expected Delivery Date: <strong style={{ color: po.expected_delivery_date ? '#047857' : '#d97706' }}>
                    {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Awaiting Vendor Schedule'}
                  </strong>
                  {po.invoice_no && <span> • Challan / Invoice: <strong>{po.invoice_no}</strong></span>}
                  {po.dispatch_notes && <span> • Info: <strong>{po.dispatch_notes}</strong></span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="btn btn-secondary btn-sm"
                style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>💬 WhatsApp to Vendor</span>
              </button>

              <button
                type="button"
                onClick={handleCopyDeliveryLink}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {copiedDeliveryLink ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                <span>{copiedDeliveryLink ? 'Copied!' : 'Copy Delivery Link'}</span>
              </button>

              <a
                href={getDeliveryShareUrl()}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ExternalLink size={14} />
                <span>Open Portal</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Verified Site Material Delivery & Challan Proof Card */}
      {po.delivery_record && (
        <div className="card no-print" style={{ marginBottom: '1.5rem', background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#166534' }}>
                Site Material Verification & Receipt Proof (Challan & Goods Photos)
              </h3>
            </div>
            {po.delivery_record.challan_no && (
              <span className="badge badge-verified" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                Vendor Challan: {po.delivery_record.challan_no}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#ffffff', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #bbf7d0', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Receipt Date</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {po.delivery_record.received_date ? new Date(po.delivery_record.received_date).toLocaleDateString() : 'Received'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recorded / Inspected By</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{po.delivery_record.received_by_name || 'Site Supervisor'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Supervisor Remarks</div>
              <div style={{ fontSize: '0.85rem' }}>{po.delivery_record.remarks || 'Physical inspection verified'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Condition Status</div>
              {(() => {
                const dmgItems = Array.isArray(po.delivery_record.damaged_items) ? po.delivery_record.damaged_items : [];
                const dmgPhotos = Array.isArray(po.delivery_record.damage_photos) ? po.delivery_record.damage_photos : [];
                const hasDmg = dmgItems.length > 0 || dmgPhotos.length > 0;
                return hasDmg ? (
                  <span className="badge badge-rejected" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    ⚠️ Defect / Damage Reported
                  </span>
                ) : (
                  <span className="badge badge-approved" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    ✓ 100% Intact & Accepted
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Damage notice if defect found */}
          {(() => {
            const dmgItems = Array.isArray(po.delivery_record.damaged_items) ? po.delivery_record.damaged_items : [];
            const dmgPhotos = Array.isArray(po.delivery_record.damage_photos) ? po.delivery_record.damage_photos : [];
            if (dmgItems.length === 0 && dmgPhotos.length === 0) return null;
            return (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#9f1239' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
                  <AlertCircle size={16} />
                  <span>Defects / Damage Logged During Site Verification</span>
                </div>
                {po.delivery_record.damage_remarks && (
                  <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                    <strong>Defect Description:</strong> {po.delivery_record.damage_remarks}
                  </div>
                )}
                {dmgItems.length > 0 && (
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {dmgItems.map((it, idx) => (
                      <span key={idx} style={{ marginRight: '0.75rem', fontWeight: 600 }}>
                        • {it.description}: {it.damaged_qty} {it.unit} damaged
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Photo Galleries Showcase */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {/* Challan Photos */}
            {(() => {
              const chPhotos = Array.isArray(po.delivery_record.challan_photos) ? po.delivery_record.challan_photos : [];
              return (
                <div style={{ background: '#ffffff', borderRadius: '8px', padding: '0.85rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                      📄 Vendor Challan Photos
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chPhotos.length} photo(s)</span>
                  </div>
                  {chPhotos.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No separate challan photos</div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {chPhotos.map((p, idx) => {
                        const src = p.dataUrl || p.url || p;
                        return (
                          <img
                            key={idx}
                            src={src}
                            alt={p.name || `Challan ${idx + 1}`}
                            onClick={() => setPreviewPhoto(src)}
                            style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                            title="Click to zoom challan photo"
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Material Goods Photos */}
            {(() => {
              const matPhotos = Array.isArray(po.delivery_record.material_photos) ? po.delivery_record.material_photos : [];
              return (
                <div style={{ background: '#ffffff', borderRadius: '8px', padding: '0.85rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                      📷 Goods / Material Photos
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{matPhotos.length} photo(s)</span>
                  </div>
                  {matPhotos.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No material photos</div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {matPhotos.map((p, idx) => {
                        const src = p.dataUrl || p.url || p;
                        return (
                          <img
                            key={idx}
                            src={src}
                            alt={p.name || `Material ${idx + 1}`}
                            onClick={() => setPreviewPhoto(src)}
                            style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                            title="Click to zoom material photo"
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Damage Photos */}
            {(() => {
              const dmgPhotos = Array.isArray(po.delivery_record.damage_photos) ? po.delivery_record.damage_photos : [];
              if (dmgPhotos.length === 0) return null;
              return (
                <div style={{ background: '#fff1f2', borderRadius: '8px', padding: '0.85rem', border: '1px solid #fda4af' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#9f1239' }}>
                      ⚠️ Defect / Damage Photos
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#be123c', fontWeight: 600 }}>{dmgPhotos.length} photo(s)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {dmgPhotos.map((p, idx) => {
                      const src = p.dataUrl || p.url || p;
                      return (
                        <img
                          key={idx}
                          src={src}
                          alt={p.name || `Defect ${idx + 1}`}
                          onClick={() => setPreviewPhoto(src)}
                          style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #f43f5e', cursor: 'pointer' }}
                          title="Click to zoom defect photo"
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Commercial Terms & Declaration Edit Panel (Purchase Manager Only) */}
      {isPurchaseOrAdmin && (isEditingTerms || po.status === 'Approved') && (
        <div className="card no-print" style={{ marginBottom: '1.5rem', border: '1px solid var(--primary-300)', background: '#fafcff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--primary-600)' }} />
                Commercial Terms & Declaration
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Specify advance %, credit days, terms & conditions, and PO declaration for <strong>{po.po_no}</strong>.
              </span>
            </div>
            {po.terms_updated_at && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: '#e2e8f0', padding: '0.25rem 0.55rem', borderRadius: '4px' }}>
                Last updated by <strong>{po.terms_updated_by_name || 'Purchase Manager'}</strong> on {po.terms_updated_at}
              </span>
            )}
          </div>

          {termsError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.65rem 0.9rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {termsError}
            </div>
          )}

          {termsSuccess && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.65rem 0.9rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {termsSuccess}
            </div>
          )}

          <form onSubmit={handleSaveCommercialTerms}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {/* Advance % */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Advance Payment (%): <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={advancePct}
                  onChange={(e) => setAdvancePct(e.target.value)}
                  className="form-control"
                  placeholder="0"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Calculated Advance Amount (Read-only) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Calculated Advance Amount (₹):
                </label>
                <input
                  type="text"
                  readOnly
                  value={`₹${previewAdvanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 700, color: 'var(--primary-800)' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Auto-calculated from order total (₹{previewGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </span>
              </div>

              {/* Credit Period */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Credit Period (in days): <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={creditDays}
                  onChange={(e) => setCreditDays(e.target.value)}
                  className="form-control"
                  placeholder="30"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            {/* Extra Charges Section (Delivery, Labour, Other, GST) */}
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span>🚚 Extra Charges (Delivery, Labour, Other & GST)</span>
                </strong>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  These extra charges are included in the final bill / PO total.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Delivery / Freight (₹):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={deliveryCharges}
                    onChange={(e) => setDeliveryCharges(e.target.value)}
                    className="form-control"
                    placeholder="0"
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Labour / Loading (₹):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={labourCharges}
                    onChange={(e) => setLabourCharges(e.target.value)}
                    className="form-control"
                    placeholder="0"
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Other Charges (₹):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={otherCharges}
                    onChange={(e) => setOtherCharges(e.target.value)}
                    className="form-control"
                    placeholder="0"
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    GST on Extra Charges (%):
                  </label>
                  <select
                    value={extraGstPct}
                    onChange={(e) => setExtraGstPct(e.target.value)}
                    className="form-control"
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="0">0% (Nil)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST (Standard)</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Extra Charges Remarks / Description:
                </label>
                <input
                  type="text"
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  className="form-control"
                  placeholder="e.g. Unloading, site crane and freight included"
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              {/* Live Extra Summary Box */}
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '0.65rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#065f46' }}>Extra Subtotal: <strong>₹{extraSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                  <span style={{ margin: '0 0.4rem', color: '#a7f3d0' }}>|</span>
                  <span style={{ color: '#065f46' }}>Extra GST ({extraGstPct}%): <strong>₹{extraGstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                  <span style={{ margin: '0 0.4rem', color: '#a7f3d0' }}>|</span>
                  <span style={{ color: '#047857' }}>Total Extra: <strong>₹{totalExtra.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                </div>
                <div style={{ fontWeight: 800, color: '#0f766e', fontSize: '0.88rem' }}>
                  Bill Total with Extras: ₹{previewGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Payment Terms and Conditions */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Payment Terms & Conditions: <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                rows={2}
                value={paymentTermsText}
                onChange={(e) => setPaymentTermsText(e.target.value)}
                className="form-control"
                placeholder="e.g. 10% advance on PO issuance, balance within 30 days of site receipt verification..."
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            {/* Declaration Text */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                  PO / Bill Declaration Text:
                </label>
                <button
                  type="button"
                  onClick={() => setDeclarationText(DEFAULT_DECLARATION)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <RotateCcw size={12} />
                  <span>Reset to Default Declaration</span>
                </button>
              </div>
              <textarea
                rows={2}
                value={declarationText}
                onChange={(e) => setDeclarationText(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={savingTerms}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
              >
                <Save size={15} />
                <span>{savingTerms ? 'Saving Terms...' : 'Save Commercial Terms'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Director Approved Pending Issuance Banner */}
      {po.status === 'Approved' && (
        <div className="no-print" style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '0.85rem 1.15rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.88rem', color: '#92400e' }}>
          <strong>Director Approved (Pending PO Issuance):</strong> This winning quote was approved by the Director. As Purchase Manager, review/edit the commercial terms above and click <strong>"Issue PO to Vendor"</strong> to release the order to <strong>{po.vendor_name}</strong>.
        </div>
      )}

      {isPriceRestricted && (
        <div className="no-print" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', padding: '0.75rem 1.15rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--primary-700)' }}>
          ℹ️ <strong>Price-Free Role View:</strong> As Project Coordinator / Site Supervisor, financial amounts and vendor line rates are omitted in compliance with DDPL access governance.
        </div>
      )}

      {/* Official DDPL PO Printable Sheet */}
      <div 
        id="printable-po" 
        className="card" 
        style={{ 
          background: '#ffffff', 
          border: '1px solid #cbd5e1', 
          padding: '2.5rem',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          color: 'var(--text-main)'
        }}
      >
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary-600)', fontWeight: 700 }}>
              Invoice To / Buyer
            </span>
            <h2 style={{ fontSize: '1.6rem', color: '#0f172a', margin: '0.2rem 0', fontWeight: 800 }}>Decent Decor Pvt. Ltd</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0.25rem 0', lineHeight: 1.5 }}>
              Plot No.21, Tejaswini Society Lane No.-1, DP Road, Aundh, Pune - 411007, Maharashtra, India.
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              <strong>GSTIN:</strong> 27AAECD7921Q1Z2 • <strong>PAN:</strong> AAECD7921Q
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Email: admin@decentdecorindia.com
            </div>
          </div>

          <div style={{ textAlign: 'right', minWidth: '220px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary-600)', fontWeight: 700 }}>
              Purchase Order Voucher
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-700)', margin: '0.2rem 0' }}>
              {po.po_no}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Date: <strong>{new Date(po.created_at).toLocaleDateString()}</strong>
            </div>
            {po.invoice_no && (
              <div style={{ fontSize: '0.85rem', color: 'var(--warning-text)', marginTop: '0.35rem' }}>
                Challan / Inv No: <strong>{po.invoice_no}</strong>
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Category: {po.pr_category || 'Procurement'}
            </div>
          </div>
        </div>

        {/* Addresses Box: Supplier vs Consignee */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Supplier */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary-600)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>
              Supplier / Bill From
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>{po.vendor_name}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.35rem 0' }}>
              {po.vendor_address || 'Pune, Maharashtra'}
            </p>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              <strong>GSTIN:</strong> {po.vendor_gstin || 'Unregistered'}
            </div>
            {po.vendor_phone && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <strong>Contact:</strong> {po.vendor_phone} {po.vendor_email ? `• ${po.vendor_email}` : ''}
              </div>
            )}
          </div>

          {/* Consignee */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary-600)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>
              Consignee / Ship To (Site)
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {po.site_code} — {po.site_name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.35rem 0' }}>
              {po.site_address || 'Project Site, Pune'}
            </p>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              <strong>Site GSTIN:</strong> {po.site_gstin || '27AAECD7921Q1Z2'}
            </div>
          </div>
        </div>

        {/* Item Table */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: '5%' }}>Sl.</th>
                  <th style={{ width: '38%' }}>Description & Specification</th>
                  <th style={{ width: '12%' }}>Quantity</th>
                  <th style={{ width: '10%' }}>Unit</th>
                  <th style={{ width: '15%' }}>Delivery Window</th>
                  {!isLineRateRestricted && <th style={{ width: '10%' }}>Rate (₹)</th>}
                  {!isPriceRestricted && <th style={{ width: '10%', textAlign: 'right' }}>Amount (₹)</th>}
                </tr>
              </thead>
              <tbody>
                {po.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{item.description}</strong>
                      {item.spec && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Spec: {item.spec}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>{Number(parseFloat(item.qty || 0))}</td>
                    <td>{item.unit}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {item.lead_from && item.lead_to
                        ? `${new Date(item.lead_from).toLocaleDateString()} to ${new Date(item.lead_to).toLocaleDateString()}`
                        : 'Standard'}
                    </td>
                    {!isLineRateRestricted && (
                      <td>₹{Number(item.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    )}
                    {!isPriceRestricted && (
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-700)' }}>
                        ₹{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals & Terms Section */}
        {!isPriceRestricted && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
            <div style={{ maxWidth: '480px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-700)', textTransform: 'uppercase', margin: 0, fontWeight: 700 }}>
                  Payment & Delivery Terms:
                </h4>
                {isPurchaseOrAdmin && (
                  <button
                    onClick={() => setIsEditingTerms(true)}
                    className="no-print"
                    style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                  >
                    <Edit3 size={13} />
                    <span>Edit Terms</span>
                  </button>
                )}
              </div>
              <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', listStyle: 'inside disc', lineHeight: 1.7, margin: 0, padding: 0 }}>
                <li>
                  Advance Payable: <strong>{po.payment_terms?.advance_pct || 0}%</strong> on PO Issuance
                  {Number(po.payment_terms?.advance_pct || 0) > 0 && (
                    <span style={{ color: 'var(--primary-700)', fontWeight: 600 }}>
                      {' '}(Advance Amount: ₹{Number(po.payment_terms?.advance_amount || (Number(po.total_amount || 0) * Number(po.payment_terms?.advance_pct) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                    </span>
                  )}
                </li>
                <li>Credit Balance: <strong>{po.payment_terms?.credit_days || 0} days</strong> credit after Site Verification</li>
                {(po.payment_terms?.notes || po.payment_terms?.payment_terms) && (
                  <li>Payment Terms: {po.payment_terms.notes || po.payment_terms.payment_terms}</li>
                )}
                {po.terms_updated_at && (
                  <li style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Terms verified by {po.terms_updated_by_name || 'Purchase Manager'} ({po.terms_updated_at})
                  </li>
                )}
              </ul>

              <div style={{ marginTop: '1rem', background: 'var(--primary-50)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--primary-200)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-700)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
                  Amount Chargeable (in words):
                </span>
                <strong style={{ fontSize: '0.92rem', color: 'var(--primary-900)' }}>
                  {numberToWordsIndian(Number(po.total_amount))}
                </strong>
              </div>
            </div>

            <div style={{ width: '320px', background: '#f8fafc', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <span>Subtotal (Ex-GST):</span>
                <span style={{ fontWeight: 600 }}>₹{Number(po.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <span>CGST (9%):</span>
                <span style={{ fontWeight: 600 }}>₹{Number(po.cgst).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <span>SGST (9%):</span>
                <span style={{ fontWeight: 600 }}>₹{Number(po.sgst).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Extra Charges Breakdown if present */}
              {po.extra_charges && Number(po.extra_charges.delivery_charges) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.88rem', color: '#1e3a8a' }}>
                  <span>Delivery / Freight:</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(po.extra_charges.delivery_charges).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {po.extra_charges && Number(po.extra_charges.labour_charges) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.88rem', color: '#1e3a8a' }}>
                  <span>Labour / Loading:</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(po.extra_charges.labour_charges).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {po.extra_charges && Number(po.extra_charges.other_charges) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.88rem', color: '#1e3a8a' }}>
                  <span>Other Charges:</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(po.extra_charges.other_charges).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {po.extra_charges && Number(po.extra_charges.gst_amount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.88rem', color: '#1e3a8a' }}>
                  <span>GST on Extra Charges ({po.extra_charges.gst_pct}%):</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(po.extra_charges.gst_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: '0.75rem', fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary-700)' }}>
                <span>Total Amount:</span>
                <span>₹{Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Declarations & Signatures */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '2rem' }}>
          <div style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                Declaration:
              </span>
              {isPurchaseOrAdmin && (
                <button
                  onClick={() => setIsEditingTerms(true)}
                  className="no-print"
                  style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  Edit Declaration
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '0.25rem', whiteSpace: 'pre-line' }}>
              {po.declaration_text || DEFAULT_DECLARATION}
            </p>
          </div>

          <div style={{ textAlign: 'center', minWidth: '200px' }}>
            <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '2.5rem', marginBottom: '0.5rem' }}>
              {/* Signature line space */}
            </div>
            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>For Decent Decor Pvt. Ltd</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authorised Signatory</div>
          </div>
        </div>
      </div>

      {/* Financial Settlement & Payments Card (no-print) */}
      {!isPriceRestricted && (
        <div className="card no-print" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <CreditCard size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Vendor Payments & Disbursement Tracking
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  UTR reference numbers and settlement history against PO {po.po_no}
                </p>
              </div>
            </div>

            {['admin', 'purchase', 'accounts', 'director'].includes(activeRole || user?.role) && (
              <Link 
                to={`/payments?po_id=${po.id}`}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
              >
                <CreditCard size={15} />
                <span>Record Payment for this PO</span>
              </Link>
            )}
          </div>

          {/* Quick Financial Summary */}
          {(() => {
            const totalAmt = Number(po.total_amount || 0);
            const totalPaid = poPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const balanceDue = Math.max(0, totalAmt - totalPaid);
            const advPct = Number(po.payment_terms?.advance_pct || 0);
            const advAmt = Number(po.payment_terms?.advance_amount || (totalAmt * advPct / 100));

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>PO Order Value</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ₹{totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Advance Terms</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e40af' }}>
                    {advPct}% {advPct > 0 ? `(₹${advAmt.toLocaleString()})` : 'Advance'}
                  </div>
                </div>

                <div style={{ background: '#ecfdf5', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#047857', textTransform: 'uppercase', fontWeight: 600 }}>Total Disbursed</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#059669' }}>
                    ₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ background: balanceDue > 0 ? '#fffbeb' : '#ecfdf5', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: `1px solid ${balanceDue > 0 ? '#fde68a' : '#a7f3d0'}` }}>
                  <div style={{ fontSize: '0.72rem', color: balanceDue > 0 ? '#b45309' : '#047857', textTransform: 'uppercase', fontWeight: 600 }}>Balance Outstanding</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: balanceDue > 0 ? '#dc2626' : '#059669' }}>
                    ₹{balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Payments Table */}
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount (₹)</th>
                  <th>Mode</th>
                  <th>Bank UTR / Reference No</th>
                  <th>Recorded By</th>
                  <th>Remarks / Note</th>
                </tr>
              </thead>
              <tbody>
                {poPayments.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No payments disbursed for this PO yet. Click "Record Payment for this PO" to log an advance or settlement payment.
                    </td>
                  </tr>
                ) : (
                  poPayments.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td>
                        <strong style={{ color: '#059669' }}>
                          ₹{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </td>
                      <td><span className="badge badge-issued">{p.mode}</span></td>
                      <td><code>{p.reference_no}</code></td>
                      <td>{p.recorded_by_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.note || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Lightbox / Preview Photo Modal */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: '1rem', cursor: 'zoom-out' }}
        >
          <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewPhoto} 
              alt="Preview" 
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} 
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              style={{ position: 'absolute', top: -12, right: -12, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
