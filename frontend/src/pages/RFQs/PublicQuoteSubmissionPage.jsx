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
  Percent, 
  CreditCard, 
  ShieldCheck, 
  HelpCircle,
  ChevronDown,
  Info,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Award
} from 'lucide-react';
import { rfqService } from '../../services/rfq.service.js';

export const PublicQuoteSubmissionPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const vendorIdFromQuery = searchParams.get('v') || searchParams.get('vendor_id') || '';
  const sigFromQuery = searchParams.get('sig') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rfqData, setRfqData] = useState(null);
  
  // Selected Vendor State
  const [selectedVendorId, setSelectedVendorId] = useState(vendorIdFromQuery);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showVendorSelector, setShowVendorSelector] = useState(!vendorIdFromQuery);

  // Line items quote state
  const [quotedItems, setQuotedItems] = useState([]);

  // Commercial terms state
  const [gstRate, setGstRate] = useState(18);
  const [freightType, setFreightType] = useState('included'); // 'included' | 'extra'
  const [freightAmount, setFreightAmount] = useState(0);
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [paymentTerms, setPaymentTerms] = useState('30 Days Credit');
  const [vendorRemarks, setVendorRemarks] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dispatch & Delivery State (Challan, Bill, Expected Arrival Date, Vehicle)
  const [dispatchExpectedDate, setDispatchExpectedDate] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [dispatchChallanNo, setDispatchChallanNo] = useState('');
  const [dispatchBillNo, setDispatchBillNo] = useState('');
  const [dispatchVehicleNo, setDispatchVehicleNo] = useState('');
  const [dispatchTransportName, setDispatchTransportName] = useState('');
  const [dispatchDriverContact, setDispatchDriverContact] = useState('');
  const [dispatchRemarks, setDispatchRemarks] = useState('');
  const [savingDispatch, setSavingDispatch] = useState(false);
  const [dispatchSavedSuccess, setDispatchSavedSuccess] = useState(false);

  // Fetch RFQ Details
  const loadRfqDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await rfqService.getPublicQuote(id, selectedVendorId, sigFromQuery);
      setRfqData(data);

      // Pre-select vendor if matched
      if (data.selected_vendor) {
        setSelectedVendor(data.selected_vendor);
        setSelectedVendorId(String(data.selected_vendor.id));
        setShowVendorSelector(false);
      } else if (selectedVendorId) {
        const found = (data.invited_vendors || []).concat(data.all_vendors || []).find(v => String(v.id) === String(selectedVendorId));
        if (found) {
          setSelectedVendor(found);
          setShowVendorSelector(false);
        }
      }

      // Default payment terms from RFQ if provided
      if (data.payment_terms) {
        setPaymentTerms(data.payment_terms);
      }

      // Pre-fill dispatch info if present on RFQ
      if (data.dispatch_info) {
        if (data.dispatch_info.expected_delivery_date) {
          setDispatchExpectedDate(String(data.dispatch_info.expected_delivery_date).split('T')[0]);
        }
        if (data.dispatch_info.dispatch_date) {
          setDispatchDate(String(data.dispatch_info.dispatch_date).split('T')[0]);
        }
        if (data.dispatch_info.challan_no) setDispatchChallanNo(data.dispatch_info.challan_no);
        if (data.dispatch_info.bill_no) setDispatchBillNo(data.dispatch_info.bill_no);
        if (data.dispatch_info.vehicle_no) setDispatchVehicleNo(data.dispatch_info.vehicle_no);
        if (data.dispatch_info.transport_name) setDispatchTransportName(data.dispatch_info.transport_name);
        if (data.dispatch_info.driver_contact) setDispatchDriverContact(data.dispatch_info.driver_contact);
        if (data.dispatch_info.remarks) setDispatchRemarks(data.dispatch_info.remarks);
      }

      // Populate quote items
      if (data.items && Array.isArray(data.items)) {
        // If vendor already has an existing quote submitted, prefill previous rates
        const prevItemsMap = {};
        if (data.existing_quote && Array.isArray(data.existing_quote.items)) {
          data.existing_quote.items.forEach(it => {
            if (it.id) prevItemsMap[it.id] = it;
          });
          if (data.existing_quote.delivery_days) {
            setDeliveryDays(data.existing_quote.delivery_days);
          }
        }

        const items = data.items.map(item => {
          const prev = prevItemsMap[item.id] || {};
          const targetPrice = item.revised_rate !== undefined && item.revised_rate !== null ? Number(item.revised_rate) : null;
          const origPrice = item.original_rate !== undefined && item.original_rate !== null 
            ? Number(item.original_rate) 
            : (prev.rate !== undefined && prev.rate !== null && prev.rate !== '' ? Number(prev.rate) : '');

          return {
            id: item.id,
            description: item.description,
            spec: item.spec || '',
            unit: item.unit || 'Nos',
            quantity: Number(item.quantity) || 1,
            // Pre-fill rate with target price if revision is active, otherwise vendor's previous rate
            rate: targetPrice !== null ? targetPrice : (prev.rate !== undefined ? Number(prev.rate) : ''),
            original_rate: origPrice,
            revised_rate: targetPrice,
            availability: prev.availability || 'Available',
            remarks: prev.remarks || ''
          };
        });
        setQuotedItems(items);
      }
    } catch (err) {
      setError(err.message || 'Failed to load quotation request details. Link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfqDetails();
  }, [id]);

  // Handle vendor select
  const handleSelectVendor = (vendor) => {
    setSelectedVendor(vendor);
    setSelectedVendorId(String(vendor.id));
    setShowVendorSelector(false);

    // If this vendor already submitted a quote, check if we can prefill their past rates
    if (rfqData?.bids) {
      const existingBid = rfqData.bids.find(b => String(b.vendor_id) === String(vendor.id) && (b.has_submitted || Number(b.quote_amount) > 0));
      if (existingBid && Array.isArray(existingBid.items) && existingBid.items.length > 0) {
        const prevItemsMap = {};
        existingBid.items.forEach(it => {
          if (it.id) prevItemsMap[it.id] = it;
        });
        setQuotedItems(prev => prev.map(item => {
          const prevItem = prevItemsMap[item.id] || {};
          const targetPrice = item.revised_rate !== undefined && item.revised_rate !== null ? Number(item.revised_rate) : null;
          return {
            ...item,
            rate: targetPrice !== null ? targetPrice : (prevItem.rate !== undefined && prevItem.rate !== null && prevItem.rate !== '' ? prevItem.rate : item.rate),
            original_rate: prevItem.original_rate !== undefined ? prevItem.original_rate : prevItem.rate,
            availability: prevItem.availability || item.availability
          };
        }));
        if (existingBid.delivery_days) {
          setDeliveryDays(existingBid.delivery_days);
        }
      }
    }
  };

  // Handle rate input change - store raw value so user can type decimal points
  const handleRateChange = (index, value) => {
    const updated = [...quotedItems];
    // Allow empty string, decimal numbers, or positive digits
    if (value === '' || !isNaN(value)) {
      updated[index].rate = value;
      setQuotedItems(updated);
    }
  };

  // Handle availability change
  const handleAvailabilityChange = (index, value) => {
    const updated = [...quotedItems];
    updated[index].availability = value;
    if (value === 'Not Available') {
      updated[index].rate = '';
    }
    setQuotedItems(updated);
  };

  // Calculations
  const subtotal = quotedItems.reduce((sum, it) => {
    if (it.availability === 'Not Available') return sum;
    const rate = Number(it.rate) || 0;
    const qty = Number(it.quantity) || 0;
    return sum + (rate * qty);
  }, 0);

  const effectiveFreight = freightType === 'extra' ? (Number(freightAmount) || 0) : 0;
  const taxableTotal = subtotal + effectiveFreight;
  const gstAmount = (taxableTotal * (Number(gstRate) || 0)) / 100;
  const grandTotal = taxableTotal + gstAmount;

  // Handle Quotation Submission
  const handleSubmitQuotation = async (e) => {
    e.preventDefault();
    if (!selectedVendor) {
      alert('Please select your vendor / supplier company profile before submitting.');
      setShowVendorSelector(true);
      return;
    }

    if (rfqData?.is_closed) {
      alert(`This RFQ is closed (Status: ${rfqData.status}). Bidding has concluded and new quotations cannot be accepted.`);
      return;
    }

    if (rfqData?.is_expired) {
      alert('The submission deadline for this RFQ has expired.');
      return;
    }

    // Check if at least one available item has a rate
    const hasValidRate = quotedItems.some(it => 
      it.availability !== 'Not Available' && Number(it.rate) > 0
    );

    if (!hasValidRate) {
      alert('Please enter a unit rate for at least one item.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        rfq_id: Number(id),
        vendor_id: Number(selectedVendor.id),
        sig: sigFromQuery,
        vendor_name: selectedVendor.name,
        delivery_days: Number(deliveryDays) || 3,
        payment_terms: paymentTerms,
        gst_rate: Number(gstRate),
        freight_charges: effectiveFreight,
        notes: vendorRemarks,
        items: quotedItems.map(it => ({
          id: it.id,
          description: it.description,
          spec: it.spec,
          unit: it.unit,
          quantity: it.quantity,
          rate: Number(it.rate) || 0,
          availability: it.availability,
          gst_pct: Number(gstRate),
          freight: effectiveFreight,
          remarks: it.remarks
        }))
      };

      await rfqService.submitPublicQuote(payload);

      setSubmittedReceipt({
        rfq_no: rfqData.rfq_no,
        vendor_name: selectedVendor.name,
        subtotal,
        gst_amount: gstAmount,
        grand_total: grandTotal,
        delivery_days: deliveryDays,
        payment_terms: paymentTerms,
        submitted_at: new Date().toISOString()
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert(err.message || 'Quotation submission failed. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    const fullUrl = window.location.href;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveDispatch = async (e) => {
    if (e) e.preventDefault();

    const cleanExpectedDate = (dispatchExpectedDate || '').trim();
    const cleanChallan = (dispatchChallanNo || '').trim();
    const cleanBill = (dispatchBillNo || '').trim();
    const cleanDate = (dispatchDate || '').trim();
    const cleanVehicle = (dispatchVehicleNo || '').trim();
    const cleanTransport = (dispatchTransportName || '').trim();
    const cleanDriver = (dispatchDriverContact || '').trim();
    const cleanRemarks = (dispatchRemarks || '').trim();

    // Strict validation: ALL required fields must be completely filled!
    if (!cleanExpectedDate) {
      alert('⚠️ कृपया Expected Arrival Date at Site (साईटवर पोहोचण्याची तारीख) निवडा.');
      return;
    }
    if (!cleanChallan) {
      alert('⚠️ कृपया Delivery Challan Number (चलान क्रमांक) भरा. हे अनिवार्य आहे.');
      return;
    }
    if (!cleanBill) {
      alert('⚠️ कृपया Tax Invoice / Bill Number (बिल क्रमांक) भरा. हे अनिवार्य आहे.');
      return;
    }
    if (!cleanDate) {
      alert('⚠️ कृपया Dispatch Date (माल पाठवल्याची तारीख) निवडा. हे अनिवार्य आहे.');
      return;
    }
    if (!cleanVehicle) {
      alert('⚠️ कृपया Vehicle / Truck Number (गाडी क्रमांक) भरा. हे अनिवार्य आहे.');
      return;
    }
    if (!cleanTransport) {
      alert('⚠️ कृपया Transporter Name (ट्रान्सपोर्ट कंपनी किंवा वाहकाचे नाव) भरा. हे अनिवार्य आहे.');
      return;
    }

    setSavingDispatch(true);
    setDispatchSavedSuccess(false);
    try {
      const payload = {
        rfq_id: Number(id),
        vendor_id: selectedVendor?.id ? Number(selectedVendor.id) : (selectedVendorId ? Number(selectedVendorId) : null),
        sig: sigFromQuery,
        expected_delivery_date: cleanExpectedDate,
        dispatch_date: cleanDate,
        challan_no: cleanChallan,
        bill_no: cleanBill,
        vehicle_no: cleanVehicle,
        transport_name: cleanTransport,
        driver_contact: cleanDriver || null,
        remarks: cleanRemarks || null
      };

      await rfqService.submitPublicDispatch(Number(id), payload);
      setDispatchSavedSuccess(true);
      
      setRfqData(prev => ({
        ...prev,
        dispatch_link_reopened: false,
        dispatch_info: {
          ...(prev?.dispatch_info || {}),
          expected_delivery_date: cleanExpectedDate,
          dispatch_date: cleanDate,
          challan_no: cleanChallan,
          bill_no: cleanBill,
          vehicle_no: cleanVehicle,
          transport_name: cleanTransport,
          driver_contact: cleanDriver,
          remarks: cleanRemarks,
          is_dispatched: true,
          is_locked: true
        }
      }));
    } catch (err) {
      alert(err.message || 'Failed to save delivery details. Please try again.');
    } finally {
      setSavingDispatch(false);
    }
  };

  const renderDispatchSection = () => {
    // Link ONLY expires when ALL mandatory fields have actually been submitted and recorded by the server!
    const hasDispatched = Boolean(
      rfqData?.dispatch_info?.challan_no &&
      rfqData?.dispatch_info?.bill_no &&
      rfqData?.dispatch_info?.dispatch_date &&
      rfqData?.dispatch_info?.vehicle_no &&
      rfqData?.dispatch_info?.expected_delivery_date
    );
    const isReopened = Boolean(rfqData?.dispatch_link_reopened);
    // Link expires once fully submitted unless explicitly reopened by Purchase Manager!
    const isLinkExpired = Boolean(hasDispatched && !isReopened);

    if (isLinkExpired) {
      return (
        <div 
          style={{ 
            background: '#ffffff', 
            border: '2px solid #ef4444', 
            borderRadius: '16px', 
            padding: '1.75rem', 
            marginBottom: '1.75rem', 
            boxShadow: '0 8px 24px -4px rgba(239, 68, 68, 0.12)',
            position: 'relative'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #fee2e2', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(239,68,68,0.25)' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>
                  Submission Completed & Link Expired
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: '#7f1d1d' }}>
                  Delivery dispatch details have already been submitted for this order. This submission link is now expired and locked.
                </p>
              </div>
            </div>
            <span style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fca5a5', padding: '0.4rem 0.9rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              🔒 Link Expired
            </span>
          </div>

          {/* Read-only Receipt Summary */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recorded Dispatch Details (Read-Only)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📅 Expected Arrival at Site</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginTop: '0.2rem' }}>
                  {dispatchExpectedDate ? new Date(dispatchExpectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : (rfqData?.dispatch_info?.expected_delivery_date ? new Date(rfqData.dispatch_info.expected_delivery_date).toLocaleDateString('en-IN') : '—')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📄 Delivery Challan No</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2563eb', marginTop: '0.2rem' }}>
                  {dispatchChallanNo || rfqData?.dispatch_info?.challan_no || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🧾 Tax Invoice / Bill No</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginTop: '0.2rem' }}>
                  {dispatchBillNo || rfqData?.dispatch_info?.bill_no || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🚛 Dispatch Date</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginTop: '0.2rem' }}>
                  {dispatchDate ? new Date(dispatchDate).toLocaleDateString('en-IN') : (rfqData?.dispatch_info?.dispatch_date ? new Date(rfqData.dispatch_info.dispatch_date).toLocaleDateString('en-IN') : '—')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🔢 Vehicle / Truck No</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginTop: '0.2rem' }}>
                  {dispatchVehicleNo || rfqData?.dispatch_info?.vehicle_no || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🏢 Transporter</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginTop: '0.2rem' }}>
                  {dispatchTransportName || rfqData?.dispatch_info?.transport_name || '—'}
                </div>
              </div>
            </div>
            {(dispatchRemarks || rfqData?.dispatch_info?.remarks) && (
              <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569' }}>
                <strong>Remarks:</strong> {dispatchRemarks || rfqData?.dispatch_info?.remarks}
              </div>
            )}
          </div>

          {/* Need Corrections Info Box */}
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <AlertCircle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: '1.5' }}>
              <strong>Need to update or correct these details?</strong><br />
              If any incorrect information was entered by mistake, please contact the <strong>DDPL Purchase Department</strong>. The Purchase Manager can re-open and re-share the submission link with you so you can submit the corrected information.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        style={{ 
          background: '#ffffff', 
          border: isReopened ? '2px solid #f59e0b' : '2px solid #2563eb', 
          borderRadius: '16px', 
          padding: '1.5rem', 
          marginBottom: '1.75rem', 
          boxShadow: isReopened ? '0 8px 24px -4px rgba(245, 158, 11, 0.15)' : '0 8px 24px -4px rgba(37, 99, 235, 0.12)',
          position: 'relative'
        }}
      >
        {/* Reopened Alert Banner if active */}
        {isReopened && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '0.85rem 1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <RefreshCw size={20} style={{ color: '#d97706', flexShrink: 0 }} />
            <div style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: '1.45' }}>
              <strong>⚠️ Submission Link Reopened for Corrections:</strong> DDPL Purchase Department has reopened this link so you can update and correct your delivery challan, bill, or dispatch details below.
            </div>
          </div>
        )}

        {/* Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: isReopened ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' : 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(37,99,235,0.25)' }}>
              <Truck size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {isReopened ? 'Update Delivery Dispatch, Challan & Bill Details' : 'Delivery Dispatch, Challan & Bill Details'}
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                Enter Delivery Challan, Tax Invoice / Bill, Dispatch Date, Vehicle, and Expected Arrival Date at Site
              </p>
            </div>
          </div>

          <div>
            <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '0.35rem 0.8rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={13} /> {isReopened ? 'Awaiting Corrected Details' : 'Awaiting Dispatch Schedule'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveDispatch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            
            {/* 1. Expected Arrival Date at Site */}
            <div style={{ background: '#eff6ff', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #93c5fd' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '0.35rem' }}>
                📅 Expected Arrival at Site <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="date"
                required
                className="form-control"
                value={dispatchExpectedDate}
                onChange={(e) => setDispatchExpectedDate(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #3b82f6', fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', background: '#fff' }}
              />
              <span style={{ fontSize: '0.73rem', color: '#1e40af', display: 'block', marginTop: '0.3rem', fontWeight: 500 }}>
                Material will arrive at project site on this date
              </span>
            </div>

            {/* 2. Delivery Challan No */}
            <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                📄 Delivery Challan No. <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text"
                required
                className="form-control"
                placeholder="e.g. DC-2026-089"
                value={dispatchChallanNo}
                onChange={(e) => setDispatchChallanNo(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
              />
              <span style={{ fontSize: '0.73rem', color: '#64748b', display: 'block', marginTop: '0.3rem' }}>
                Delivery Challan number sent with vehicle
              </span>
            </div>

            {/* 3. Bill / Tax Invoice No */}
            <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                🧾 Tax Invoice / Bill No. <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text"
                required
                className="form-control"
                placeholder="e.g. INV-2026-410"
                value={dispatchBillNo}
                onChange={(e) => setDispatchBillNo(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
              />
              <span style={{ fontSize: '0.73rem', color: '#64748b', display: 'block', marginTop: '0.3rem' }}>
                GST Tax Invoice or Bill number
              </span>
            </div>

            {/* 4. Dispatch Date */}
            <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                🚛 Dispatch Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="date"
                required
                className="form-control"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
              />
              <span style={{ fontSize: '0.73rem', color: '#64748b', display: 'block', marginTop: '0.3rem' }}>
                Date goods left factory / godown
              </span>
            </div>

            {/* 5. Vehicle No */}
            <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                🔢 Vehicle / Truck No. <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text"
                required
                className="form-control"
                placeholder="e.g. MH-12-AB-1234"
                value={dispatchVehicleNo}
                onChange={(e) => setDispatchVehicleNo(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
              />
            </div>

            {/* 6. Transporter Name */}
            <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                🏢 Transporter Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text"
                required
                className="form-control"
                placeholder="e.g. VRL Logistics / Local Tempo"
                value={dispatchTransportName}
                onChange={(e) => setDispatchTransportName(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
              />
            </div>

            {/* 7. Driver Mobile */}
            <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                📞 Driver Mobile No.
              </label>
              <input 
                type="tel"
                className="form-control"
                placeholder="e.g. 9822000000"
                value={dispatchDriverContact}
                onChange={(e) => setDispatchDriverContact(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
              />
            </div>

            {/* 8. Remarks */}
            <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                📝 Delivery Remarks
              </label>
              <input 
                type="text"
                className="form-control"
                placeholder="e.g. 100 pcs loaded, driver will call 1 hour prior to arrival"
                value={dispatchRemarks}
                onChange={(e) => setDispatchRemarks(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              ℹ️ Submitting these details will immediately notify DDPL Site Supervisor and Purchase Team.
            </div>

            <button 
              type="submit"
              disabled={savingDispatch}
              className="btn btn-primary"
              style={{ 
                background: dispatchSavedSuccess ? '#16a34a' : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)', 
                border: 'none',
                padding: '0.7rem 1.6rem', 
                fontSize: '0.92rem', 
                fontWeight: 700, 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37,99,235,0.28)',
                borderRadius: '10px',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              {savingDispatch ? (
                <>
                  <RefreshCw size={17} className="spin" />
                  <span>Updating Dispatch Info...</span>
                </>
              ) : dispatchSavedSuccess ? (
                <>
                  <CheckCircle2 size={17} />
                  <span>✓ Dispatch Details Saved Successfully!</span>
                </>
              ) : (
                <>
                  <Truck size={17} />
                  <span>🚚 Save & Confirm Delivery Details</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.25rem' }}></div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>Loading RFQ Quotation Form...</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Retrieving requirements and project specifications from DDPL</p>
        </div>
      </div>
    );
  }

  if (error || !rfqData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1.5rem' }}>
        <div style={{ maxWidth: '520px', width: '100%', background: '#fff', borderRadius: '16px', padding: '2.5rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '64px', height: '64px', background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <AlertCircle size={32} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Quote Request Not Found</h2>
          <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
            {error || 'This quotation link may be invalid, closed, or already processed.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => window.location.reload()} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              <RefreshCw size={16} /> Try Again
            </button>
            <Link to="/login" style={{ color: '#2563eb', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 500 }}>
              Go to DDPL Procurement Login &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // LOCKED QUOTATION SCREEN: When vendor has already submitted and no revision is active
  if (rfqData?.is_submitted_and_locked && !submittedReceipt) {
    const existing = rfqData.existing_quote || {};
    const quotedVendorName = rfqData.selected_vendor?.name || 'Your Company';
    const totalQuoted = Number(existing.quote_amount || 0);
    const isShortlisted = Boolean(
      rfqData.can_submit_dispatch || 
      (rfqData.is_shortlisted && (rfqData.is_winner_vendor || !rfqData.winner_vendor_id)) ||
      rfqData.dispatch_info?.is_dispatched
    );

    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', background: '#fff', borderRadius: '20px', boxShadow: '0 20px 35px -10px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          
          {/* Header Banner */}
          <div style={{ 
            background: isShortlisted ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', 
            color: '#fff', 
            padding: '2.5rem 2rem', 
            textAlign: 'center' 
          }}>
            <div style={{ width: '68px', height: '68px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {isShortlisted ? <Award size={38} style={{ color: '#fff' }} /> : <ShieldCheck size={38} style={{ color: '#fff' }} />}
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0 }}>
              {isShortlisted ? 'Quotation Approved & Order Awarded' : 'Quotation Submitted & Locked'}
            </h1>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '0.95rem' }}>
              {isShortlisted ? 'Official order confirmation on record for ' : 'Official quotation on record for '}
              <strong>{rfqData.rfq_no}</strong> ({rfqData.pr_no || 'Requisition'})
            </p>
          </div>

          <div style={{ padding: '2rem' }}>
            {/* Status notice */}
            <div style={{ 
              background: isShortlisted ? '#ecfdf5' : '#f0fdf4', 
              border: `1px solid ${isShortlisted ? '#a7f3d0' : '#86efac'}`, 
              borderRadius: '14px', 
              padding: '1rem 1.25rem', 
              marginBottom: '1.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.85rem' 
            }}>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                background: isShortlisted ? '#059669' : '#22c55e', 
                color: '#fff', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexShrink: 0 
              }}>
                {isShortlisted ? <Award size={20} /> : <Check size={20} />}
              </div>
              <div>
                <strong style={{ color: isShortlisted ? '#065f46' : '#15803d', fontSize: '0.95rem' }}>
                  {isShortlisted 
                    ? `Congratulations ${quotedVendorName}! Quotation Approved & Shortlisted` 
                    : 'Submission Received — Link Locked for Review'}
                </strong>
                <div style={{ fontSize: '0.82rem', color: isShortlisted ? '#047857' : '#166534', marginTop: '0.15rem' }}>
                  {isShortlisted 
                    ? `DDPL Management and Purchase Department have reviewed and approved your quotation for RFQ ${rfqData.rfq_no}. Your order is confirmed. Please review your order details and submit the delivery dispatch schedule below.`
                    : `Thank you, ${quotedVendorName}! Your quotation was recorded on ${existing.submitted_at ? new Date(existing.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'record'}. To preserve quotation integrity, this link is locked while DDPL Purchase Department evaluates your bid.`
                  }
                </div>
              </div>
            </div>

            {/* Quote Summary Metrics */}
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.75rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Quoting Supplier</div>
                  <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>{quotedVendorName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>RFQ Reference</div>
                  <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#2563eb', marginTop: '0.2rem' }}>{rfqData.rfq_no}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Delivery Commitment</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', marginTop: '0.2rem' }}>{existing.delivery_days || 3} Days</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Payment Terms</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', marginTop: '0.2rem' }}>{rfqData.payment_terms || 'Net 30 Days Credit'}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '1.25rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Total Quotation Value:</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
                    ₹{totalQuoted.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  {isShortlisted ? (
                    <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Award size={14} /> Order Awarded / Shortlisted
                    </span>
                  ) : (
                    <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={14} /> Under Purchase Evaluation
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quoted Items Table */}
            {Array.isArray(existing.items) && existing.items.length > 0 && (
              <div style={{ marginBottom: '1.75rem' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.65rem' }}>
                  {isShortlisted ? 'Awarded Material Items & Rates:' : 'Submitted Material Items & Rates:'}
                </h4>
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>#</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Material</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Quoted Unit Rate</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existing.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#94a3b8' }}>{idx + 1}</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{it.description}</div>
                            {it.spec && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{it.spec}</div>}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 600 }}>{it.qty || it.quantity || 1} {it.unit || ''}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>₹{Number(it.rate || 0).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#059669' }}>₹{Number((Number(it.qty || it.quantity || 1) * Number(it.rate || 0))).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Delivery Dispatch, Challan & Bill Details - ONLY shown when shortlisted/awarded */}
            {isShortlisted && renderDispatchSection()}

            {/* Note on revisions / Order Fulfillment */}
            {isShortlisted ? (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '1rem', marginBottom: '1.75rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <CheckCircle2 size={20} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.85rem', color: '#065f46', lineHeight: '1.45' }}>
                  <strong>Order Fulfillment Instructions:</strong> Please ensure supply strictly complies with approved rates and site specifications. Enter your Delivery Challan, Tax Invoice, and Vehicle details above before dispatching materials to site.
                </div>
              </div>
            ) : (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1rem', marginBottom: '1.75rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <Info size={20} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.85rem', color: '#1e40af', lineHeight: '1.45' }}>
                  <strong>Price Revision Notice:</strong> If the DDPL Purchase Department proposes a price negotiation, target rate, or revision request, this quote link will automatically unlock to show the updated target price.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                type="button" 
                onClick={() => window.print()} 
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <FileText size={16} /> Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SUCCESS RECEIPT SCREEN
  if (submittedReceipt) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', background: '#fff', borderRadius: '20px', boxShadow: '0 20px 35px -10px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Header Banner */}
          <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <CheckCircle2 size={42} style={{ color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0 }}>Quotation Submitted!</h1>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '0.95rem' }}>
              Official quotation submitted for <strong>{submittedReceipt.rfq_no}</strong>
            </p>
          </div>

          {/* Receipt Body */}
          <div style={{ padding: '2rem' }}>
            <div style={{ background: '#f1f5f9', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Quoting Supplier</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>{submittedReceipt.vendor_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>RFQ Reference</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb', marginTop: '0.2rem' }}>{submittedReceipt.rfq_no}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Delivery Commitment</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', marginTop: '0.2rem' }}>{submittedReceipt.delivery_days} Days</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Payment Terms</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', marginTop: '0.2rem' }}>{submittedReceipt.payment_terms}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '1rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Total Quotation (Incl. GST):</span>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669' }}>
                    ₹{submittedReceipt.grand_total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Status</span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#dcfce7', color: '#166534', padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                    <Check size={12} /> Bids In
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <ShieldCheck size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
              <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                <strong>Link Locked & Completed:</strong> Your quotation is now locked for review by DDPL Purchase Department. If a rate revision or counter-offer is requested, you will receive an updated link with proposed target rates.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={() => window.print()} 
                className="btn btn-secondary" 
                style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <FileText size={16} /> Print Confirmation
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem 1rem' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        
        {/* Top Navbar / Branding */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 10px rgba(37,99,235,0.25)' }}>
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>DDPL GROUP</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>Vendor Direct Quotation Portal</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleCopyLink}
              className="btn btn-secondary btn-sm"
              style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#334155' }}
              title="Copy quote portal link"
            >
              {copiedLink ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>
            {rfqData.is_verified_vendor ? (
              <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <ShieldCheck size={14} /> Verified Vendor Link
              </span>
            ) : (
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <ShieldCheck size={13} /> Official Procurement Link
              </span>
            )}
          </div>
        </header>

        {/* RFQ Meta Header Card */}
        <div style={{ background: '#fff', borderRadius: '18px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px -3px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {rfqData.rfq_no}
                </h1>
                <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                  Request for Quotation
                </span>
                {rfqData.is_closed ? (
                  <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                    Closed ({rfqData.status})
                  </span>
                ) : rfqData.is_expired ? (
                  <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                    Deadline Expired
                  </span>
                ) : (
                  <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                    Active Request
                  </span>
                )}
              </div>
              <div style={{ marginTop: '0.4rem', fontSize: '0.88rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span>Requisition: <strong>{rfqData.pr_no || 'Standard PR'}</strong></span>
                {rfqData.deadline && (
                  <>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#d97706', fontWeight: 600 }}>
                      <Clock size={13} /> Due: {new Date(rfqData.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Delivery Location</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                <MapPin size={16} style={{ color: '#dc2626' }} />
                <span>{rfqData.site_name || 'Project Site'}</span>
              </div>
              {rfqData.site_address && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: '300px' }}>
                  {rfqData.site_address}
                </div>
              )}
            </div>
          </div>

          {/* Instructions bar */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Info size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <span style={{ fontSize: '0.82rem', color: '#475569', lineHeight: '1.4' }}>
              Please quote your best competitive unit rates (exclusive or inclusive of taxes as noted), applicable GST percentage, and committed delivery days.
            </span>
          </div>
        </div>

        {/* Closed or Expired RFQ Warnings */}
        {rfqData.is_closed && (
          <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 12px rgba(239,68,68,0.08)' }}>
            <div style={{ width: '44px', height: '44px', background: '#fee2e2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertCircle size={24} style={{ color: '#dc2626' }} />
            </div>
            <div>
              <strong style={{ color: '#991b1b', fontSize: '1rem' }}>RFQ Closed ({rfqData.status})</strong>
              <div style={{ fontSize: '0.84rem', color: '#b91c1c', marginTop: '0.2rem' }}>
                Procurement bidding for this RFQ has concluded. New quotations or price revisions can no longer be accepted.
              </div>
            </div>
          </div>
        )}

        {!rfqData.is_closed && rfqData.is_expired && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 12px rgba(245,158,11,0.08)' }}>
            <div style={{ width: '44px', height: '44px', background: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={24} style={{ color: '#d97706' }} />
            </div>
            <div>
              <strong style={{ color: '#92400e', fontSize: '1rem' }}>Submission Deadline Expired</strong>
              <div style={{ fontSize: '0.84rem', color: '#b45309', marginTop: '0.2rem' }}>
                The quotation submission deadline ({rfqData.deadline ? new Date(rfqData.deadline).toLocaleDateString('en-IN') : 'indicated'}) has passed. This RFQ is no longer accepting new quotes.
              </div>
            </div>
          </div>
        )}

        {/* Active Revision Alert Banner */}
        {rfqData.active_revision && (
          <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', boxShadow: '0 6px 20px rgba(245, 158, 11, 0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.65rem' }}>
              <div style={{ width: '42px', height: '42px', background: '#f59e0b', color: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#92400e' }}>
                  Rate Revision Requested by DDPL Purchase Department (Round {rfqData.active_revision.round})
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: '0.15rem' }}>
                  Purchase Manager has reviewed previous quotes and proposed target counter-offer rates below.
                </div>
              </div>
            </div>

            {rfqData.active_revision.request_remarks && (
              <div style={{ background: '#fef3c7', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #fde68a', margin: '0.65rem 0' }}>
                <div style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: 700, textTransform: 'uppercase' }}>Purchase Remarks:</div>
                <div style={{ color: '#92400e', fontSize: '0.9rem', marginTop: '0.2rem', fontWeight: 600 }}>
                  "{rfqData.active_revision.request_remarks}"
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.84rem', color: '#78350f', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ffffff', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
              <Info size={16} style={{ color: '#d97706', flexShrink: 0 }} />
              <span>
                <strong>How to proceed:</strong> Review the target rates in green badges below. You can accept them or enter your counter rates, then click <strong>"Submit Revised Quotation"</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Existing Quote Banner if vendor already submitted without active revision */}
        {!rfqData.active_revision && rfqData.existing_quote && (
          <div style={{ background: rfqData.is_verified_vendor ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : '#fffbeb', border: '1px solid', borderColor: rfqData.is_verified_vendor ? '#93c5fd' : '#fcd34d', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', background: rfqData.is_verified_vendor ? '#2563eb' : '#d97706', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={18} />
              </div>
              <div>
                <strong style={{ color: rfqData.is_verified_vendor ? '#1e40af' : '#92400e', fontSize: '0.9rem' }}>
                  {rfqData.is_verified_vendor ? 'Previously Submitted Quotation On Record' : 'Official Quotation Already Exists For This Supplier'}
                </strong>
                <div style={{ fontSize: '0.8rem', color: rfqData.is_verified_vendor ? '#3b82f6' : '#b45309' }}>
                  {rfqData.is_verified_vendor 
                    ? `Quoted: ₹${Number(rfqData.existing_quote.quote_amount || 0).toLocaleString('en-IN')}` 
                    : `To revise or overwrite previously submitted rates, please use your personalized vendor quote link sent to your registered contact.`}
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitQuotation}>
          
          {/* VENDOR IDENTIFICATION CARD */}
          <div style={{ background: '#fff', borderRadius: '18px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px -3px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} style={{ color: '#2563eb' }} />
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Supplier / Vendor Details
                </h2>
              </div>
              {selectedVendor && (
                <button
                  type="button"
                  onClick={() => setShowVendorSelector(!showVendorSelector)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {showVendorSelector ? 'Keep Selected' : 'Change Vendor'}
                </button>
              )}
            </div>

            {/* If vendor is selected and selector is hidden */}
            {selectedVendor && !showVendorSelector ? (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{selectedVendor.name}</span>
                    {rfqData.is_verified_vendor ? (
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ShieldCheck size={12} /> Verified Supplier
                      </span>
                    ) : (
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>
                        Direct Entry
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {selectedVendor.phone && <span><Phone size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />{selectedVendor.phone}</span>}
                    {selectedVendor.email && <span><Mail size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />{selectedVendor.email}</span>}
                    {selectedVendor.gstin && <span>GST: <strong>{selectedVendor.gstin}</strong></span>}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                  Select your vendor / business name from the list:
                </label>
                
                {/* Invited vendors quick buttons */}
                {rfqData.invited_vendors && rfqData.invited_vendors.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Invited Vendors for this RFQ:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {rfqData.invited_vendors.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectVendor(v)}
                          style={{
                            background: selectedVendor?.id === v.id ? '#2563eb' : '#f1f5f9',
                            color: selectedVendor?.id === v.id ? '#fff' : '#1e293b',
                            border: '1px solid',
                            borderColor: selectedVendor?.id === v.id ? '#2563eb' : '#cbd5e1',
                            borderRadius: '8px',
                            padding: '0.45rem 0.85rem',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          {selectedVendor?.id === v.id && <Check size={12} />}
                          <span>{v.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dropdown of all vendors */}
                {rfqData.all_vendors && rfqData.all_vendors.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Or choose from DDPL Vendor Directory:
                    </div>
                    <select
                      value={selectedVendorId}
                      onChange={(e) => {
                        const vId = e.target.value;
                        setSelectedVendorId(vId);
                        const found = rfqData.all_vendors.find(v => String(v.id) === String(vId));
                        if (found) {
                          setSelectedVendor(found);
                          setShowVendorSelector(false);
                        }
                      }}
                      className="form-control"
                      style={{ width: '100%', maxWidth: '450px' }}
                    >
                      <option value="">-- Choose your company name --</option>
                      {rfqData.all_vendors.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name}{v.city ? ` (${v.city})` : ''}
                        </option>
                      ))}
                    </select>

                    <div style={{ marginTop: '0.65rem', fontSize: '0.8rem', color: '#64748b' }}>
                      Don't see your business name?{' '}
                      <Link to="/vendor-registration" target="_blank" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                        Register vendor profile here &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MATERIAL QUOTATION ITEMS TABLE */}
          <div style={{ background: '#fff', borderRadius: '18px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px -3px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Materials & Item Quotations
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Please fill your unit rate (₹) for each required material
                </div>
              </div>
              <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                {quotedItems.length} Item(s)
              </span>
            </div>

            {/* Desktop / Tablet Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '650px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem', width: rfqData.active_revision ? '30%' : '38%' }}>Material Description & Spec</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Availability</th>
                    {rfqData.active_revision && (
                      <>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>Your Previous</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#047857' }}>Purchase Target</th>
                      </>
                    )}
                    <th style={{ padding: '0.75rem 1rem', width: rfqData.active_revision ? '24%' : '22%' }}>
                      {rfqData.active_revision ? 'Your Revised Rate (₹) *' : 'Unit Rate (₹)'}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {quotedItems.map((item, idx) => {
                    const isAvailable = item.availability !== 'Not Available';
                    const lineTotal = isAvailable ? ((Number(item.rate) || 0) * (Number(item.quantity) || 0)) : 0;

                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.82rem', verticalAlign: 'middle' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                            {item.description}
                          </div>
                          {item.spec && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                              Spec: {item.spec}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                            {item.quantity}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.35rem' }}>
                            {item.unit}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <select
                            value={item.availability}
                            disabled={!rfqData.active_revision && (rfqData.is_closed || rfqData.is_expired)}
                            onChange={(e) => handleAvailabilityChange(idx, e.target.value)}
                            style={{
                              padding: '0.4rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              background: item.availability === 'Available' ? '#ecfdf5' : '#fef2f2',
                              color: item.availability === 'Available' ? '#065f46' : '#991b1b',
                              cursor: (!rfqData.active_revision && (rfqData.is_closed || rfqData.is_expired)) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="Available">Available</option>
                            <option value="Partial">Partial</option>
                            <option value="Not Available">Not Available</option>
                          </select>
                        </td>

                        {/* Revision Details: Previous Rate & DDPL Target Rate */}
                        {rfqData.active_revision && (
                          <>
                            <td style={{ padding: '1rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: 600, color: '#64748b', fontSize: '0.9rem' }}>
                              ₹{Number(item.original_rate || item.prev_rate || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                              {item.revised_rate !== null && item.revised_rate !== undefined ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.3rem 0.6rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.88rem' }}>
                                  🎯 ₹{Number(item.revised_rate).toLocaleString('en-IN')}
                                </span>
                              ) : '—'}
                            </td>
                          </>
                        )}

                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <span style={{ position: 'absolute', left: '10px', color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>₹</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              disabled={item.availability === 'Not Available' || (!rfqData.active_revision && (rfqData.is_closed || rfqData.is_expired))}
                              placeholder="0.00"
                              value={item.rate}
                              onChange={(e) => handleRateChange(idx, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.5rem 0.75rem 0.5rem 1.65rem',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                color: '#0f172a',
                                outline: 'none',
                                background: item.availability === 'Not Available' ? '#f1f5f9' : '#fff'
                              }}
                            />
                          </div>
                          {rfqData.active_revision && item.revised_rate !== null && item.revised_rate !== undefined && String(item.rate) !== String(item.revised_rate) && (
                            <button
                              type="button"
                              onClick={() => handleRateChange(idx, item.revised_rate)}
                              style={{
                                marginTop: '0.35rem',
                                background: '#ecfdf5',
                                color: '#065f46',
                                border: '1px solid #a7f3d0',
                                borderRadius: '6px',
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <Check size={11} /> Accept Target ₹{Number(item.revised_rate).toLocaleString('en-IN')}
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                          {isAvailable ? `₹${lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>


          {/* COMMERCIAL TERMS & CHARGES */}
          <div style={{ background: '#fff', borderRadius: '18px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px -3px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <CreditCard size={18} style={{ color: '#2563eb' }} />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Taxes, Freight & Commercial Terms
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              {/* GST Rate */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  GST Rate (%)
                </label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  className="form-control"
                  style={{ width: '100%' }}
                >
                  <option value={18}>18% GST (Standard Materials)</option>
                  <option value={12}>12% GST</option>
                  <option value={5}>5% GST (Sand / Aggregates)</option>
                  <option value={28}>28% GST (Cement / Luxury)</option>
                  <option value={0}>0% Exempted / Nil</option>
                </select>
              </div>

              {/* Freight Charges */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Freight / Transportation
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={freightType}
                    onChange={(e) => setFreightType(e.target.value)}
                    className="form-control"
                    style={{ flex: 1 }}
                  >
                    <option value="included">Freight Included (FOR Site)</option>
                    <option value="extra">Freight Extra (Specify ₹)</option>
                  </select>
                  {freightType === 'extra' && (
                    <input
                      type="number"
                      min="0"
                      placeholder="₹ Amount"
                      value={freightAmount}
                      onChange={(e) => setFreightAmount(e.target.value)}
                      className="form-control"
                      style={{ width: '110px' }}
                    />
                  )}
                </div>
              </div>

              {/* Delivery Days */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Delivery Lead Time
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                    className="form-control"
                    style={{ width: '90px' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Days from PO</span>
                </div>
              </div>

              {/* Payment Terms */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Quoted Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="form-control"
                  style={{ width: '100%' }}
                >
                  <option value="Net 30 Days Credit">Net 30 Days Credit</option>
                  <option value="Net 15 Days Credit">Net 15 Days Credit</option>
                  <option value="100% Advance">100% Advance</option>
                  <option value="50% Advance, 50% Against Delivery">50% Advance, 50% on Delivery</option>
                  <option value="Immediate on Delivery (COD)">Immediate on Delivery (COD)</option>
                </select>
              </div>
            </div>

            {/* Special remarks */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Supplier Remarks / Notes (Optional)
              </label>
              <textarea
                rows="2"
                placeholder="e.g. Rates valid for 15 days, loading/unloading by client, delivery subject to stock availability..."
                value={vendorRemarks}
                onChange={(e) => setVendorRemarks(e.target.value)}
                className="form-control"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* REAL-TIME CALCULATION & SUBMIT FOOTER */}
          <div style={{ background: '#fff', borderRadius: '18px', padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 8px 25px -4px rgba(0,0,0,0.06)', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
              
              {/* Financial Breakup */}
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Basic Subtotal</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#334155', marginTop: '0.2rem' }}>
                    ₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>

                {freightType === 'extra' && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Freight</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#334155', marginTop: '0.2rem' }}>
                      ₹{effectiveFreight.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>GST ({gstRate}%)</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#334155', marginTop: '0.2rem' }}>
                    ₹{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#059669', textTransform: 'uppercase', fontWeight: 700 }}>Total Quoted Value</div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#059669', marginTop: '0.1rem' }}>
                    ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="submit"
                  disabled={isSubmitting || subtotal <= 0 || (!rfqData.active_revision && (rfqData.is_closed || rfqData.is_expired))}
                  style={{
                    background: (!rfqData.active_revision && (rfqData.is_closed || rfqData.is_expired)) || subtotal <= 0 ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.85rem 1.75rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: (!rfqData.active_revision && (rfqData.is_closed || rfqData.is_expired)) || subtotal <= 0 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: subtotal > 0 && (rfqData.active_revision || (!rfqData.is_closed && !rfqData.is_expired)) ? '0 4px 14px rgba(37,99,235,0.35)' : 'none'
                  }}
                >
                  <Send size={18} />
                  <span>
                    {isSubmitting 
                      ? 'Submitting...' 
                      : rfqData.active_revision 
                        ? `Submit Revised Rates (Round ${rfqData.active_revision.round})` 
                        : rfqData.is_closed 
                          ? 'RFQ Closed' 
                          : rfqData.is_expired 
                            ? 'Deadline Expired' 
                            : 'Submit Official Quotation'}
                  </span>
                </button>

              </div>
            </div>
          </div>

        </form>

        {/* Footer */}
        <footer style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', marginTop: '2rem', paddingBottom: '2rem' }}>
          &copy; {new Date().getFullYear()} DDPL Group Procurement Division • All quotation data transmitted securely via SSL
        </footer>

      </div>
    </div>
  );
};
