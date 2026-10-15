import React, { useState, useEffect } from 'react';
import { vendorBilledChallanService } from '../../services/vendorBilledChallan.service.js';
import { poService } from '../../services/po.service.js';
import { masterService } from '../../services/master.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  FileText, 
  Plus, 
  Search, 
  Download, 
  Eye, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Truck, 
  Receipt, 
  DollarSign, 
  X, 
  Upload, 
  FileCheck,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Edit2
} from 'lucide-react';

// Client-side image & PDF processor
const processChallanFile = (file) => {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPdf) {
      // Default file reader
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, size: file.size, isPdf: false });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, size: file.size, isPdf: true });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    // Compress image
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          name: file.name,
          dataUrl,
          size: Math.round((dataUrl.length * 3) / 4),
          isPdf: false
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const VendorBilledChallansSection = () => {
  const { user, activeRole } = useAuth();
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');

  // Masters
  const [sites, setSites] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [pos, setPos] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewModalData, setViewModalData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formPoId, setFormPoId] = useState('');
  const [formVendorId, setFormVendorId] = useState('');
  const [formSiteId, setFormSiteId] = useState('');
  const [formChallanNo, setFormChallanNo] = useState('');
  const [formChallanDate, setFormChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [formVehicleNo, setFormVehicleNo] = useState('');
  
  // Financial Charges Breakdown
  const [basicAmount, setBasicAmount] = useState('');
  const [freightCharges, setFreightCharges] = useState('');
  const [loadingCharges, setLoadingCharges] = useState('');
  const [packagingCharges, setPackagingCharges] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [gstPercent, setGstPercent] = useState('18');
  const [notes, setNotes] = useState('');
  const [uploadedDoc, setUploadedDoc] = useState(null);

  const canAdd = ['admin', 'purchase'].includes(activeRole);
  const isDirector = ['director', 'director_1', 'director_2', 'director_3'].includes(activeRole);
  const isAccounts = activeRole === 'accounts';

  // Live total calculations
  const numBasic = Number(basicAmount) || 0;
  const numFreight = Number(freightCharges) || 0;
  const numLoading = Number(loadingCharges) || 0;
  const numPack = Number(packagingCharges) || 0;
  const numOther = Number(otherCharges) || 0;
  const numGstPct = Number(gstPercent) || 0;

  const subtotal = numBasic + numFreight + numLoading + numPack + numOther;
  const calculatedGst = Math.round((subtotal * (numGstPct / 100)) * 100) / 100;
  const grandTotal = subtotal + calculatedGst;

  const fetchChallans = async () => {
    setLoading(true);
    try {
      const data = await vendorBilledChallanService.getChallans({
        search,
        site_id: siteFilter || undefined,
        vendor_id: vendorFilter || undefined
      });
      setChallans(data || []);
    } catch (err) {
      console.error('Failed to fetch vendor billed challans:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = async () => {
    try {
      const [sitesData, vendorsData, posData] = await Promise.all([
        masterService.getSites().catch(() => []),
        masterService.getVendors().catch(() => []),
        poService.getOrders({ limit: 100 }).catch(() => ({ data: [] }))
      ]);
      setSites(sitesData || []);
      setVendors(vendorsData || []);
      const poList = posData.items || posData.data || (Array.isArray(posData) ? posData : []);
      setPos(poList || []);
    } catch (e) {
      console.error('Error loading masters for vendor challans:', e);
    }
  };

  useEffect(() => {
    fetchChallans();
  }, [siteFilter, vendorFilter]);

  useEffect(() => {
    loadMasters();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchChallans();
  };

  // PO Selection Handler: Auto-fill Vendor, Site, Requisition
  const handleSelectPo = (poIdVal) => {
    setFormPoId(poIdVal);
    if (!poIdVal) return;
    const selected = pos.find((p) => String(p.id) === String(poIdVal));
    if (selected) {
      if (selected.vendor_id) setFormVendorId(String(selected.vendor_id));
      if (selected.site_id) setFormSiteId(String(selected.site_id));
      if (selected.invoice_no && !formChallanNo) setFormChallanNo(selected.invoice_no);
      if (selected.subtotal && !basicAmount) setBasicAmount(String(selected.subtotal));
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const processed = await processChallanFile(files[0]);
      setUploadedDoc(processed);
    } catch (err) {
      alert('File processing error: ' + err.message);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formChallanNo.trim()) {
      alert('Please enter the Challan / Bill Number.');
      return;
    }
    if (!formVendorId) {
      alert('Please select the Vendor.');
      return;
    }
    if (!formSiteId) {
      alert('Please select the Project Site.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedPo = pos.find((p) => String(p.id) === String(formPoId));
      await vendorBilledChallanService.createChallan({
        challan_no: formChallanNo.trim(),
        challan_date: formChallanDate,
        po_id: formPoId ? Number(formPoId) : null,
        requisition_id: selectedPo?.requisition_id ? Number(selectedPo.requisition_id) : null,
        vendor_id: Number(formVendorId),
        site_id: Number(formSiteId),
        vehicle_no: formVehicleNo.trim() || null,
        basic_amount: numBasic,
        freight_charges: numFreight,
        loading_unloading_charges: numLoading,
        packaging_charges: numPack,
        other_charges: numOther,
        gst_percent: numGstPct,
        gst_amount: calculatedGst,
        total_amount: grandTotal,
        document_file: uploadedDoc ? uploadedDoc.dataUrl : null,
        document_name: uploadedDoc ? uploadedDoc.name : null,
        notes: notes.trim() || null
      });

      setShowAddModal(false);
      resetForm();
      fetchChallans();
      alert('Vendor Billed Challan saved successfully!');
    } catch (err) {
      alert(err.message || 'Failed to save vendor billed challan');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormPoId('');
    setFormVendorId('');
    setFormSiteId('');
    setFormChallanNo('');
    setFormChallanDate(new Date().toISOString().split('T')[0]);
    setFormVehicleNo('');
    setBasicAmount('');
    setFreightCharges('');
    setLoadingCharges('');
    setPackagingCharges('');
    setOtherCharges('');
    setGstPercent('18');
    setNotes('');
    setUploadedDoc(null);
  };

  const handleDelete = async (id, chNo) => {
    if (!window.confirm(`Are you sure you want to delete Vendor Challan #${chNo}?`)) return;
    try {
      await vendorBilledChallanService.deleteChallan(id);
      fetchChallans();
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleDownloadDoc = (docUrl, docName = 'Vendor_Challan') => {
    if (!docUrl) return;
    const link = document.createElement('a');
    link.href = docUrl;
    link.download = docName || `Vendor_Challan_${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metric Aggregates
  const totalBilledCount = challans.length;
  const sumBasic = challans.reduce((a, b) => a + (Number(b.basic_amount) || 0), 0);
  const sumFreight = challans.reduce((a, b) => a + (Number(b.freight_charges) || 0), 0);
  const sumLoading = challans.reduce((a, b) => a + (Number(b.loading_unloading_charges) || 0), 0);
  const sumTaxes = challans.reduce((a, b) => a + (Number(b.gst_amount) || 0), 0);
  const sumGrandTotal = challans.reduce((a, b) => a + (Number(b.total_amount) || 0), 0);

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Top Banner & Audit Info */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.25rem', 
        flexWrap: 'wrap', 
        gap: '1rem',
        background: '#ffffff',
        padding: '1.25rem',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Vendor Billed Challans & Commercial Invoices
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Final invoices submitted by vendors with Freight, Loading, Handling, and GST breakdown.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isDirector && (
            <div style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={16} />
              <span>Director Audit & Verification Mode</span>
            </div>
          )}
          {isAccounts && (
            <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={16} />
              <span>Accounts Department Clearance View</span>
            </div>
          )}
          {canAdd && (
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
            >
              <Plus size={18} />
              <span>Add Vendor Billed Challan</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Invoices</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>{totalBilledCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Recorded Challans</div>
        </div>

        <div className="card" style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Basic Material Cost</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7', marginTop: '0.25rem' }}>₹{sumBasic.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Excluding transport & tax</div>
        </div>

        <div className="card" style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Freight & Loading</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>₹{(sumFreight + sumLoading).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Freight: ₹{sumFreight.toLocaleString()} | Load: ₹{sumLoading.toLocaleString()}</div>
        </div>

        <div className="card" style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>GST / Taxes (18%)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.25rem' }}>₹{sumTaxes.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Billed Tax Amount</div>
        </div>

        <div className="card" style={{ padding: '1rem', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', border: 'none' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Grand Billed Total</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>₹{sumGrandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Vendor Payable</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.2rem' }}
              placeholder="Search by Challan #, Vendor, Site, PO #, Vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-control"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="">All Project Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-control"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">Search</button>
          {(search || siteFilter || vendorFilter) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSiteFilter(''); setVendorFilter(''); }}
              className="btn btn-secondary"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Dedicated Vendor Billed Challans Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
        <div className="table-responsive">
          <table className="table" style={{ margin: 0 }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ fontWeight: 700, fontSize: '0.8rem' }}>Challan / Bill No</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem' }}>Vendor / Supplier</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem' }}>Project Site</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem' }}>Linked PO / PR</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem', textAlign: 'right' }}>Basic (₹)</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem', textAlign: 'right' }}>Freight (₹)</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem', textAlign: 'right' }}>Loading (₹)</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem', textAlign: 'right' }}>GST (₹)</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem', textAlign: 'right', color: '#0f172a' }}>Grand Total (₹)</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem', textAlign: 'center' }}>Document</th>
                <th style={{ fontWeight: 700, fontSize: '0.8rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
                    Loading vendor billed challans...
                  </td>
                </tr>
              ) : challans.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <div style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 600 }}>No vendor billed challans found</div>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {canAdd ? 'Click "Add Vendor Billed Challan" above to record the first vendor invoice.' : 'No commercial invoices have been attached yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                challans.map((ch) => {
                  const hasDoc = Boolean(ch.document_file);
                  const isPdf = ch.document_file?.includes('.pdf') || ch.document_name?.toLowerCase().endsWith('.pdf');
                  
                  return (
                    <tr key={ch.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td>
                        <strong style={{ color: '#1e40af', fontSize: '0.92rem' }}>{ch.challan_no}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                          📅 {new Date(ch.challan_date).toLocaleDateString()}
                        </div>
                        {ch.vehicle_no && (
                          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.1rem' }}>
                            🚚 {ch.vehicle_no}
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{ch.vendor_name}</div>
                        {ch.vendor_phone && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📞 {ch.vendor_phone}</div>
                        )}
                        {ch.vendor_gstin && (
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>GST: {ch.vendor_gstin}</div>
                        )}
                      </td>

                      <td>
                        <strong style={{ color: '#0f172a' }}>{ch.site_code}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{ch.site_name}</div>
                      </td>

                      <td>
                        {ch.po_no ? (
                          <div>
                            <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.88rem' }}>{ch.po_no}</span>
                            {ch.pr_no && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>PR: {ch.pr_no}</div>
                            )}
                            {ch.po_total_amount && (
                              <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                                PO: ₹{Number(ch.po_total_amount).toLocaleString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Direct Challan</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{Number(ch.basic_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>

                      <td style={{ textAlign: 'right', color: Number(ch.freight_charges) > 0 ? '#b45309' : '#64748b' }}>
                        ₹{Number(ch.freight_charges || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>

                      <td style={{ textAlign: 'right', color: Number(ch.loading_unloading_charges) > 0 ? '#b45309' : '#64748b' }}>
                        ₹{Number(ch.loading_unloading_charges || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>

                      <td style={{ textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>
                        ₹{Number(ch.gst_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({ch.gst_percent || 18}%)</div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '0.96rem', color: '#0f172a', fontWeight: 800 }}>
                          ₹{Number(ch.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </strong>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {hasDoc ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => setViewModalData(ch)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              title="View Document"
                            >
                              <Eye size={13} color="#2563eb" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(ch.document_file, ch.document_name || `Challan_${ch.challan_no}`)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' }}
                              title="Download Original Invoice"
                            >
                              <Download size={13} />
                              <span>Save</span>
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No doc</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => setViewModalData(ch)}
                            className="btn btn-secondary btn-sm"
                            title="Audit & View Full Charges"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                          >
                            Details
                          </button>
                          {canAdd && (
                            <button
                              type="button"
                              onClick={() => handleDelete(ch.id, ch.challan_no)}
                              className="btn btn-danger btn-sm"
                              title="Delete record"
                              style={{ padding: '0.3rem 0.5rem' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD VENDOR BILLED CHALLAN MODAL (For Purchase Manager & Admin) */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '680px', width: '100%', maxHeight: '92vh', overflowY: 'auto', margin: 0, boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={22} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Add Vendor Billed Challan & Tax Invoice
                </h3>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} className="close-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.4rem' }}>×</button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#334155' }}>
                  Link with Purchase Order (Optional - Auto Fills Vendor & Site):
                </label>
                <select
                  className="form-control"
                  value={formPoId}
                  onChange={(e) => handleSelectPo(e.target.value)}
                >
                  <option value="">-- Direct Vendor Challan (No PO Selected) --</option>
                  {pos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.po_no} — {p.vendor_name} ({p.site_code}) - Total: ₹{Number(p.total_amount).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Vendor / Supplier *</label>
                  <select
                    required
                    className="form-control"
                    value={formVendorId}
                    onChange={(e) => setFormVendorId(e.target.value)}
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Destination Site *</label>
                  <select
                    required
                    className="form-control"
                    value={formSiteId}
                    onChange={(e) => setFormSiteId(e.target.value)}
                  >
                    <option value="">Select Project Site...</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Challan / Bill No *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CH-2026-9042"
                    className="form-control"
                    value={formChallanNo}
                    onChange={(e) => setFormChallanNo(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Challan Date *</label>
                  <input
                    type="date"
                    required
                    className="form-control"
                    value={formChallanDate}
                    onChange={(e) => setFormChallanDate(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Vehicle / Transport No</label>
                  <input
                    type="text"
                    placeholder="e.g. MH-12-RN-8821"
                    className="form-control"
                    value={formVehicleNo}
                    onChange={(e) => setFormVehicleNo(e.target.value)}
                  />
                </div>
              </div>

              {/* COMMERCIAL CHARGES BREAKDOWN CARD */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#166534', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <DollarSign size={16} />
                  <span>Commercial Charges & Tax Breakdown</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Basic Material Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="form-control"
                      value={basicAmount}
                      onChange={(e) => setBasicAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Freight / Transport (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="form-control"
                      value={freightCharges}
                      onChange={(e) => setFreightCharges(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Loading / Unloading (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="form-control"
                      value={loadingCharges}
                      onChange={(e) => setLoadingCharges(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Packaging / Other (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="form-control"
                      value={packagingCharges}
                      onChange={(e) => setPackagingCharges(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'center', borderTop: '1px dashed #86efac', paddingTop: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>GST Rate (%)</label>
                    <select
                      className="form-control"
                      value={gstPercent}
                      onChange={(e) => setGstPercent(e.target.value)}
                    >
                      <option value="0">0% (Nil)</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST (Standard)</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Calculated Tax Amount</label>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#7c3aed' }}>
                      ₹{calculatedGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 800 }}>GRAND TOTAL PAYABLE</label>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#15803d' }}>
                      ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* UPLOAD CHALLAN DOCUMENT CARD */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Attach Original Vendor Challan / Tax Invoice Document (PDF or Scan Photo):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="form-control"
                    style={{ flex: 1, minWidth: '240px' }}
                  />
                  {uploadedDoc && (
                    <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileCheck size={16} />
                      <span>{uploadedDoc.name} ({Math.round(uploadedDoc.size / 1024)} KB)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Notes / Remarks</label>
                <textarea
                  rows="2"
                  placeholder="e.g. All charges verified against PO terms and delivered in sound condition."
                  className="form-control"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ fontWeight: 700 }}>
                  <CheckCircle2 size={16} />
                  <span>{submitting ? 'Saving Challan...' : 'Save & Record Challan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW & AUDIT DETAIL MODAL (For Director, Accounts, Purchase, Admin) */}
      {viewModalData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1250, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '780px', width: '100%', maxHeight: '92vh', overflowY: 'auto', margin: 0, boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={22} color="#16a34a" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    Vendor Billed Challan #{viewModalData.challan_no}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Dated: {new Date(viewModalData.challan_date).toLocaleDateString()} • Recorded by: {viewModalData.created_by_name || 'Purchase Department'}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setViewModalData(null)} className="close-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.4rem' }}>×</button>
            </div>

            {/* Vendor & Site Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Vendor / Supplier</div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{viewModalData.vendor_name}</div>
                {viewModalData.vendor_phone && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>📞 {viewModalData.vendor_phone}</div>}
                {viewModalData.vendor_gstin && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>GSTIN: {viewModalData.vendor_gstin}</div>}
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Delivery Location</div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{viewModalData.site_name} ({viewModalData.site_code})</div>
                {viewModalData.site_address && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{viewModalData.site_address}</div>}
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>PO Reference</div>
                <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.95rem' }}>{viewModalData.po_no || 'Direct Invoiced'}</div>
                {viewModalData.po_total_amount && (
                  <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 700 }}>
                    Approved PO Total: ₹{Number(viewModalData.po_total_amount).toLocaleString()}
                  </div>
                )}
                {viewModalData.vehicle_no && (
                  <div style={{ fontSize: '0.78rem', color: '#475569' }}>Vehicle: {viewModalData.vehicle_no}</div>
                )}
              </div>
            </div>

            {/* Charges Detailed Table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.92rem', fontWeight: 800, color: '#334155' }}>
                Full Commercial Charges Audit:
              </h4>
              <table className="table" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Basic Material Value</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      ₹{Number(viewModalData.basic_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td>Freight / Transportation Charges</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: Number(viewModalData.freight_charges) > 0 ? '#b45309' : '#64748b' }}>
                      ₹{Number(viewModalData.freight_charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td>Loading / Unloading Charges (Hamali)</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: Number(viewModalData.loading_unloading_charges) > 0 ? '#b45309' : '#64748b' }}>
                      ₹{Number(viewModalData.loading_unloading_charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {Number(viewModalData.packaging_charges) > 0 && (
                    <tr>
                      <td>Packaging Charges</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{Number(viewModalData.packaging_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  {Number(viewModalData.other_charges) > 0 && (
                    <tr>
                      <td>Other Miscellaneous Charges</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{Number(viewModalData.other_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>GST ({viewModalData.gst_percent || 18}%)</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                      ₹{Number(viewModalData.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr style={{ background: '#f0fdf4', borderTop: '2px solid #86efac' }}>
                    <td style={{ fontWeight: 800, fontSize: '1rem', color: '#166534' }}>NET GRAND TOTAL PAYABLE</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '1.15rem', color: '#15803d' }}>
                      ₹{Number(viewModalData.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Document Preview / Download Section */}
            {viewModalData.document_file && (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={18} color="#2563eb" />
                    <span>Attached Vendor Challan / Invoice Document</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadDoc(viewModalData.document_file, viewModalData.document_name || `Challan_${viewModalData.challan_no}`)}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                  >
                    <Download size={14} />
                    <span>Download Original Document</span>
                  </button>
                </div>

                {viewModalData.document_file.includes('.pdf') || viewModalData.document_name?.toLowerCase().endsWith('.pdf') ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: '#ffffff', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <FileText size={48} color="#ef4444" style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{viewModalData.document_name || 'Vendor_Invoice.pdf'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>PDF Invoice Document Attached</div>
                    <a
                      href={viewModalData.document_file}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <ExternalLink size={13} />
                      <span>Open PDF in New Window</span>
                    </a>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <img
                      src={viewModalData.document_file}
                      alt="Vendor Challan"
                      style={{ maxHeight: '360px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                    />
                  </div>
                )}
              </div>
            )}

            {viewModalData.notes && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                <strong style={{ fontSize: '0.82rem', color: '#92400e' }}>Notes & Terms:</strong>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#78350f' }}>{viewModalData.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <button type="button" onClick={() => setViewModalData(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
