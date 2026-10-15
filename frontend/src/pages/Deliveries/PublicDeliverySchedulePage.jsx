import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  Building2, 
  CheckCircle2, 
  FileText, 
  AlertCircle, 
  Clock, 
  Send, 
  Check, 
  Copy, 
  Truck, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  Phone,
  Package,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { poService } from '../../services/po.service.js';

export const PublicDeliverySchedulePage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const vendorIdFromQuery = searchParams.get('v') || searchParams.get('vendor_id') || '';
  const sigFromQuery = searchParams.get('sig') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [poData, setPoData] = useState(null);

  // Form State
  const [expectedDate, setExpectedDate] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('Dispatched'); // 'Dispatched' | 'Scheduled'
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [challanNo, setChallanNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transportName, setTransportName] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadPoDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await poService.getPublicDelivery(id, vendorIdFromQuery, sigFromQuery);
      setPoData(data);
      if (data.expected_delivery_date) {
        setExpectedDate(new Date(data.expected_delivery_date).toISOString().split('T')[0]);
      }
      if (data.dispatch_date) {
        setDispatchDate(new Date(data.dispatch_date).toISOString().split('T')[0]);
      }
      if (data.invoice_no) {
        setChallanNo(data.invoice_no);
      }
      if (data.status === 'Dispatched') {
        setDeliveryStatus('Dispatched');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load Purchase Order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPoDetails();
  }, [id, vendorIdFromQuery, sigFromQuery]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!expectedDate) {
      alert('Please specify the Expected Delivery Date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        vendor_id: vendorIdFromQuery || (poData && poData.vendor_id),
        sig: sigFromQuery,
        expected_delivery_date: expectedDate,
        delivery_status: deliveryStatus,
        challan_no: challanNo.trim(),
        dispatch_date: deliveryStatus === 'Dispatched' ? dispatchDate : null,
        vehicle_no: vehicleNo.trim(),
        transport_name: transportName.trim(),
        driver_contact: driverContact.trim(),
        remarks: remarks.trim()
      };

      const res = await poService.submitPublicDelivery(id, payload);
      setSubmittedReceipt({
        success: true,
        message: 'Delivery schedule & dispatch details successfully recorded!',
        po_no: poData?.po_no,
        expected_date: expectedDate,
        status: deliveryStatus,
        challan_no: challanNo
      });
      loadPoDetails();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to submit delivery schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Loading Delivery Information...</p>
        </div>
      </div>
    );
  }

  if (error || !poData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1rem' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: '#ffffff', borderRadius: '12px', padding: '2rem', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', border: '1px solid #fee2e2' }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.5rem' }}>Delivery Link Unavailable</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {error || 'This delivery link is invalid or has expired. Please contact the DDPL Purchase Department.'}
          </p>
          <button onClick={() => window.location.reload()} className="btn btn-secondary">
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingBottom: '3rem' }}>
      {/* Brand Header */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 800 }}>
              <Truck size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                DDPL GROUP
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                Vendor Delivery & Dispatch Portal
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleCopyLink}
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {copiedLink ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              {copiedLink ? 'Link Copied!' : 'Copy Link'}
            </button>
            <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <ShieldCheck size={14} /> Official DDPL PO
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main style={{ maxWidth: '960px', margin: '1.5rem auto 0', padding: '0 1rem' }}>

        {/* Success Confirmation Toast/Banner */}
        {submittedReceipt && (
          <div style={{ background: '#ecfdf5', border: '1.5px solid #34d399', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)' }}>
            <CheckCircle2 size={28} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#065f46', margin: '0 0 0.35rem 0' }}>
                Delivery Schedule Successfully Submitted!
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#047857', margin: 0, lineHeight: 1.5 }}>
                Thank you! The DDPL Purchase Department and Project Site Supervisor have been notified. 
                Expected Delivery Date: <strong>{new Date(submittedReceipt.expected_date).toLocaleDateString()}</strong>
                {submittedReceipt.challan_no && ` • Challan #${submittedReceipt.challan_no}`}.
              </p>
            </div>
          </div>
        )}

        {/* Existing Dispatch Status Alert if Already Scheduled */}
        {poData.expected_delivery_date && !submittedReceipt && (
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Clock size={20} color="#0284c7" />
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0369a1' }}>Active Delivery Status on Record:</strong>
                <div style={{ fontSize: '0.82rem', color: '#0c4a6e' }}>
                  Scheduled for: <strong>{new Date(poData.expected_delivery_date).toLocaleDateString()}</strong> 
                  {poData.invoice_no ? ` • Challan / Invoice: ${poData.invoice_no}` : ''}
                  {poData.status === 'Dispatched' ? ' • (Dispatched & En Route)' : ''}
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.78rem', background: '#0284c7', color: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 600 }}>
              Status: {poData.status}
            </span>
          </div>
        )}

        {/* PO & Site Summary Card */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {poData.po_no}
                </h1>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                  Purchase Order
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Requisition Ref: <strong>{poData.pr_no || 'Direct PO'}</strong> • Issued to: <strong>{poData.vendor_name}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>DESTINATION SITE</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', marginTop: '0.15rem' }}>
                <MapPin size={16} color="#ef4444" />
                {poData.site_name} ({poData.site_code})
              </div>
              {poData.site_address && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: '300px', marginTop: '0.2rem' }}>
                  {poData.site_address}
                </div>
              )}
            </div>
          </div>

          {/* Quick Notice */}
          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', color: '#475569' }}>
            <Package size={18} color="#3b82f6" style={{ flexShrink: 0 }} />
            <span>
              Please confirm the <strong>expected delivery date</strong> and vehicle/dispatch details so the site store team can arrange unloading space and manpower.
            </span>
          </div>
        </div>

        {/* Ordered Items Table */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <FileText size={18} color="#2563eb" />
            Materials & Items to Deliver ({poData.items?.length || 0})
          </h3>

          <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ width: '8%', padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: '#64748b' }}>#</th>
                  <th style={{ width: '62%', padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: '#64748b' }}>MATERIAL DESCRIPTION & SPECIFICATION</th>
                  <th style={{ width: '30%', padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: '#64748b', textAlign: 'right' }}>ORDERED QUANTITY</th>
                </tr>
              </thead>
              <tbody>
                {(poData.items || []).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.85rem', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#1e293b', display: 'block' }}>
                        {item.description}
                      </strong>
                      {item.spec && (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Spec: {item.spec}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        {item.qty}
                      </span>{' '}
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.unit || 'Nos'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vendor Dispatch & Delivery Submission Form */}
        <form onSubmit={handleSubmit} style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #bfdbfe', padding: '1.75rem', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
            <Truck size={22} color="#2563eb" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Update Delivery & Dispatch Schedule
            </h2>
          </div>

          {/* Form Fields Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Expected Delivery Date (MANDATORY) */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                Expected Arrival Date at Site *
              </label>
              <input
                type="date"
                required
                className="form-control"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                style={{ fontSize: '0.92rem', padding: '0.55rem 0.75rem', borderColor: '#3b82f6' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                When will material physically reach site?
              </span>
            </div>

            {/* Dispatch Status */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                Current Dispatch Status *
              </label>
              <select
                className="form-control"
                value={deliveryStatus}
                onChange={(e) => setDeliveryStatus(e.target.value)}
                style={{ fontSize: '0.92rem', padding: '0.55rem 0.75rem' }}
              >
                <option value="Dispatched">🚚 Dispatched / In Transit (Left factory/store)</option>
                <option value="Scheduled">📅 Scheduled (Will dispatch by scheduled date)</option>
              </select>
            </div>

            {/* Delivery Challan / Invoice No */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                Delivery Challan / Invoice No.
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. DC-2026/892 or INV-449"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                style={{ fontSize: '0.92rem', padding: '0.55rem 0.75rem' }}
              />
            </div>

            {/* Actual Dispatch Date */}
            {deliveryStatus === 'Dispatched' && (
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                  Material Dispatch Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  style={{ fontSize: '0.92rem', padding: '0.55rem 0.75rem' }}
                />
              </div>
            )}

            {/* Vehicle Number */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                Vehicle Number
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. MH-12-RN-4820"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                style={{ fontSize: '0.92rem', padding: '0.55rem 0.75rem' }}
              />
            </div>

            {/* Transport / Courier Name */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                Transporter / Courier Name
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Direct Tempo / VRL / Self"
                value={transportName}
                onChange={(e) => setTransportName(e.target.value)}
                style={{ fontSize: '0.92rem', padding: '0.55rem 0.75rem' }}
              />
            </div>

            {/* Driver Contact Number */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                Driver / Dispatch Contact No.
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 9823456789"
                value={driverContact}
                onChange={(e) => setDriverContact(e.target.value)}
                style={{ fontSize: '0.92rem', padding: '0.55rem 0.75rem' }}
              />
            </div>
          </div>

          {/* Remarks */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
              Dispatch Remarks & Unloading Instructions (Optional)
            </label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. 4 bundles, driver will arrive before 4 PM, requires forklift for heavy boxes..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{ fontSize: '0.9rem', padding: '0.55rem 0.75rem' }}
            />
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                padding: '0.75rem 1.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
              }}
            >
              {isSubmitting ? (
                <>Submitting Schedule...</>
              ) : (
                <>
                  <Send size={18} />
                  Submit Delivery Schedule
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
          DDPL Procurement System • Secure Dispatch Scheduling Link
        </div>
      </main>
    </div>
  );
};
