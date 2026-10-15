import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { poService } from '../../services/po.service.js';
import { requisitionService } from '../../services/requisition.service.js';
import { masterService } from '../../services/master.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Plus, Trash2, ArrowLeft, Save, AlertCircle, ShoppingCart, Shield } from 'lucide-react';

export const PurchaseOrderFormPage = () => {
  const navigate = useNavigate();
  const { activeRole, user, currentRoleInfo } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Master data states
  const [requisitions, setRequisitions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [sites, setSites] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // PO Header State
  const [requisitionId, setRequisitionId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [advancePct, setAdvancePct] = useState(0);
  const [creditDays, setCreditDays] = useState(30);
  const [paymentNotes, setPaymentNotes] = useState('Payment within 30 days after delivery verification');

  // Extra Charges State (Delivery, Labour, Other, GST)
  const [deliveryCharges, setDeliveryCharges] = useState(0);
  const [labourCharges, setLabourCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [extraGstPct, setExtraGstPct] = useState(18);
  const [extraNotes, setExtraNotes] = useState('');

  // Line Items State
  const [items, setItems] = useState([
    {
      description: 'OPC 53 Grade Cement, 50 Kg Bag',
      spec: 'IS 12269',
      unit: 'Bag',
      qty: 25,
      rate: 400
    }
  ]);

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [reqsData, vendorsData, sitesData, materialsData] = await Promise.all([
          requisitionService.getRequisitions({ limit: 100 }).catch(() => ({ data: [] })),
          masterService.getVendors().catch(() => []),
          masterService.getSites().catch(() => []),
          masterService.getMaterials().catch(() => [])
        ]);

        const reqList = reqsData.items || reqsData.data || (Array.isArray(reqsData) ? reqsData : []);
        setRequisitions(reqList);
        if (reqList.length > 0) {
          setRequisitionId(reqList[0].id);
          // If PR has a site_id, default siteId
          if (reqList[0].site_id) setSiteId(reqList[0].site_id);
        }

        setVendors(vendorsData || []);
        if (vendorsData && vendorsData.length > 0) {
          setVendorId(vendorsData[0].id);
        }

        setSites(sitesData || []);
        if (sitesData && sitesData.length > 0 && !siteId) {
          setSiteId(sitesData[0].id);
        }

        setMaterials(materialsData || []);
      } catch (err) {
        console.error('Failed to load master lists for PO:', err);
      } finally {
        setLoadingMasters(false);
      }
    };
    loadMasters();
  }, []);

  const handleRequisitionChange = (selectedPrId) => {
    setRequisitionId(selectedPrId);
    const selectedPr = requisitions.find((r) => String(r.id) === String(selectedPrId));
    if (selectedPr) {
      if (selectedPr.site_id) setSiteId(selectedPr.site_id);
      if (selectedPr.items && Array.isArray(selectedPr.items) && selectedPr.items.length > 0) {
        setItems(
          selectedPr.items.map((it) => ({
            description: it.description,
            spec: it.spec || '',
            unit: it.unit || 'Bag',
            qty: Number(it.quantity) || 1,
            rate: Number(it.est_rate) || 0
          }))
        );
      }
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: '',
        spec: '',
        unit: 'Bag',
        qty: 1,
        rate: 0
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) {
      alert('PO must contain at least one item');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleDescriptionChange = (index, value) => {
    const updated = [...items];
    updated[index].description = value;

    const matched = materials.find(
      (m) => m.description.toLowerCase().trim() === value.toLowerCase().trim()
    );
    if (matched) {
      if (matched.unit) updated[index].unit = matched.unit;
      if (matched.ref_rate) updated[index].rate = matched.ref_rate;
      if (matched.spec) updated[index].spec = matched.spec;
    }

    setItems(updated);
  };

  // Live Calculations
  const subtotal = items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
  const cgst = subtotal * 0.09;
  const sgst = subtotal * 0.09;
  const materialsTotal = subtotal + cgst + sgst;

  const dCharge = Number(deliveryCharges) || 0;
  const lCharge = Number(labourCharges) || 0;
  const oCharge = Number(otherCharges) || 0;
  const extraSubtotal = Math.round((dCharge + lCharge + oCharge) * 100) / 100;
  const extraGstAmount = Math.round((extraSubtotal * ((Number(extraGstPct) || 0) / 100)) * 100) / 100;
  const totalExtra = Math.round((extraSubtotal + extraGstAmount) * 100) / 100;

  const grandTotal = Math.round((materialsTotal + totalExtra) * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!siteId) {
      setError('Please select a project site');
      return;
    }
    if (!vendorId) {
      setError('Please select a vendor');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].description.trim()) {
        setError(`Please enter a description for Item #${i + 1}`);
        return;
      }
      if (Number(items[i].qty) <= 0 || Number(items[i].rate) <= 0) {
        setError(`Quantity and Rate for Item #${i + 1} must be positive numbers`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        requisition_id: requisitionId ? Number(requisitionId) : null,
        vendor_id: Number(vendorId),
        site_id: Number(siteId),
        payment_terms: {
          advance_pct: Number(advancePct),
          credit_days: Number(creditDays),
          notes: paymentNotes
        },
        extra_charges: {
          delivery_charges: dCharge,
          labour_charges: lCharge,
          other_charges: oCharge,
          gst_pct: Number(extraGstPct) || 0,
          notes: extraNotes.trim()
        },
        items: items.map((i) => ({
          description: i.description,
          spec: i.spec,
          unit: i.unit,
          qty: Number(i.qty),
          rate: Number(i.rate)
        }))
      };

      const created = await poService.createPO(payload);
      alert(`Purchase Order ${created.po_no} issued successfully! Total: ₹${created.total_amount.toLocaleString()}`);
      navigate('/orders');
    } catch (err) {
      setError(err.message || 'Failed to issue purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const effectiveRole = activeRole || user?.role || 'admin';

  if (!['purchase', 'admin'].includes(effectiveRole)) {
    return (
      <div>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/orders" className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} />
            <span>Back to Orders</span>
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Generate Purchase Order (PO)</h1>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', maxWidth: '680px', margin: '2rem auto' }}>
          <Shield size={48} style={{ color: 'var(--primary-600)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            Access Restricted to Purchase Department
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Direct PO creation is restricted to the <strong>Purchase Department</strong> and <strong>Administrator</strong>. Winning vendor quotations are approved by the Director from RFQ comparison matrices to automatically create purchase orders.
            <br /><br />
            As <strong>{currentRoleInfo?.title || 'User'}</strong>, please view awarded orders or manage site deliveries.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/orders" className="btn btn-primary">
              <span>View Purchase Orders</span>
            </Link>
            <Link to="/requisitions" className="btn btn-secondary">
              <span>Go to Requests</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to="/orders" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          <span>Back to POs</span>
        </Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Generate Purchase Order (PO)</h1>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Header Section */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>1. Order & Vendor Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Linked Request (PR)</label>
              <select
                className="form-control"
                value={requisitionId}
                onChange={(e) => handleRequisitionChange(e.target.value)}
              >
                <option value="">Direct PO (No PR link)</option>
                {requisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.pr_no} ({r.site_code} - {r.category}) [{r.status}]
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Vendor (Supplier) *</label>
              <select
                className="form-control"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
              >
                {loadingMasters ? (
                  <option value="">Loading vendors...</option>
                ) : vendors.length === 0 ? (
                  <option value="">No vendors found (Add in Vendors Master)</option>
                ) : (
                  vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.phone ? `(${v.phone})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Delivery Project Site *</label>
              <select
                className="form-control"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                required
              >
                {loadingMasters ? (
                  <option value="">Loading sites...</option>
                ) : sites.length === 0 ? (
                  <option value="">No sites found (Add in Sites Master)</option>
                ) : (
                  sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} ({s.name})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginTop: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">Advance Payment (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="form-control"
                value={advancePct}
                onChange={(e) => setAdvancePct(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Credit Days</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={creditDays}
                onChange={(e) => setCreditDays(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Payment Terms & Notes</label>
              <input
                type="text"
                className="form-control"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Dynamic Line Items Section */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>2. Ordered Line Items</h3>
            <button type="button" onClick={handleAddItem} className="btn btn-secondary btn-sm">
              <Plus size={16} />
              <span>Add Item</span>
            </button>
          </div>

          <datalist id="materials-po-datalist">
            {materials.map((m) => (
              <option key={m.id} value={m.description}>
                {m.category} — Ref ₹{m.ref_rate}/{m.unit}
              </option>
            ))}
          </datalist>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Description *</th>
                  <th style={{ width: '15%' }}>Specification</th>
                  <th style={{ width: '12%' }}>Unit *</th>
                  <th style={{ width: '12%' }}>Quantity *</th>
                  <th style={{ width: '14%' }}>Rate (₹) *</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ width: '5%', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const itemAmount = (Number(item.qty || 0) * Number(item.rate || 0)).toFixed(2);
                  return (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          required
                          className="form-control"
                          list="materials-po-datalist"
                          value={item.description}
                          onChange={(e) => handleDescriptionChange(index, e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Grade 53"
                          value={item.spec}
                          onChange={(e) => handleItemChange(index, 'spec', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="form-control"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        >
                          <option value="Bag">Bag</option>
                          <option value="Brass">Brass</option>
                          <option value="Kg">Kg</option>
                          <option value="Liter">Liter</option>
                          <option value="Box">Box</option>
                          <option value="Nos">Nos</option>
                          <option value="Sq.Ft">Sq.Ft</option>
                          <option value="Rmt">Rmt</option>
                          <option value="Ton">Ton</option>
                          <option value="Set">Set</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="form-control"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="form-control"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{Number(itemAmount).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="btn btn-danger btn-sm"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Extra Charges Section (Delivery, Labour, Other, GST) */}
          <div style={{ marginTop: '1.5rem', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.95rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span>🚚 Additional Charges (Freight, Labour / Loading, Other Expenses & GST)</span>
              </strong>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Included in the final generated bill / purchase order
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
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
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
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
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
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
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  GST on Extra Charges (%):
                </label>
                <select
                  value={extraGstPct}
                  onChange={(e) => setExtraGstPct(e.target.value)}
                  className="form-control"
                >
                  <option value="0">0% (Nil)</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST (Standard)</option>
                  <option value="28">28% GST</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Extra Charges Notes / Breakdown:
              </label>
              <input
                type="text"
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                className="form-control"
                placeholder="e.g. Unloading up to 2nd floor, freight included"
              />
            </div>
          </div>

          {/* Tax & Extra Charges Summary Box */}
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '340px', background: 'var(--bg-card-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: 'var(--text-secondary)' }}>
                <span>Materials Subtotal:</span>
                <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: 'var(--text-secondary)' }}>
                <span>CGST (9%):</span>
                <span style={{ fontWeight: 600 }}>₹{cgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: 'var(--text-secondary)' }}>
                <span>SGST (9%):</span>
                <span style={{ fontWeight: 600 }}>₹{sgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {dCharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: '#1e3a8a' }}>
                  <span>Delivery / Freight:</span>
                  <span style={{ fontWeight: 600 }}>₹{dCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {lCharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: '#1e3a8a' }}>
                  <span>Labour / Loading:</span>
                  <span style={{ fontWeight: 600 }}>₹{lCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {oCharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: '#1e3a8a' }}>
                  <span>Other Charges:</span>
                  <span style={{ fontWeight: 600 }}>₹{oCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {extraGstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: '#1e3a8a' }}>
                  <span>GST on Extra Charges ({extraGstPct}%):</span>
                  <span style={{ fontWeight: 600 }}>₹{extraGstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', paddingTop: '0.75rem', fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary-700)' }}>
                <span>Total Amount:</span>
                <span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
          <Link to="/orders" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            <Save size={18} />
            <span>{submitting ? 'Generating PO...' : 'Issue Purchase Order'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
