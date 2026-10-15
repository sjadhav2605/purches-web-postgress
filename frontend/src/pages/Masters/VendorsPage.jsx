import React, { useState, useEffect } from 'react';
import { masterService } from '../../services/master.service.js';
import { 
  Users, 
  Plus, 
  Trash2, 
  Search, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  X,
  ExternalLink,
  Copy,
  Check,
  Send,
  MessageSquare,
  Share2,
  Download,
  FileCheck,
  ShieldCheck
} from 'lucide-react';

export const VendorsPage = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTab, setAddModalTab] = useState('invite'); // 'invite' | 'manual'
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Invite state
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState({ text: '', type: '' });

  // Manual Form State
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [advancePct, setAdvancePct] = useState(0);
  const [creditDays, setCreditDays] = useState(30);

  const registrationUrl = `${window.location.origin}/vendor-registration`;

  // Backend origin derived from VITE_API_BASE_URL (e.g. https://api.onrender.com/api/v1 -> https://api.onrender.com).
  // Falls back to '' (same-origin, handled by the Vite dev proxy) when the base URL is relative.
  const apiOrigin = (() => {
    try {
      return new URL(import.meta.env.VITE_API_BASE_URL).origin;
    } catch {
      return '';
    }
  })();

  const resolveDocUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `${apiOrigin}${url}`;
    }
    return url;
  };

  const handleDownloadDoc = async (doc) => {
    if (!doc) return;
    const fullUrl = resolveDocUrl(doc.dataUrl);
    const filename = doc.name || 'document';

    if (fullUrl.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = fullUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    try {
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error('File download failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('Direct blob download fallback to window.open:', err);
      window.open(fullUrl, '_blank');
    }
  };

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const data = await masterService.getVendors(search);
      setVendors(data || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVendors();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Copy Link to clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(registrationUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    let cleanPhone = invitePhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const greeting = inviteName ? `Hello ${inviteName.trim()},` : 'Hello,';
    const message = `${greeting} Greetings from Decent Decor Pvt. Ltd. (DDPL) Procurement. Please complete your vendor registration, bank KYC, and upload your documents using this official onboarding link:\n${registrationUrl}\n\nThank you,\nDecent Decor Pvt. Ltd.`;

    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  // Send Email Invite
  const handleSendEmailInvite = async () => {
    if (!inviteEmail || !inviteEmail.trim()) {
      setEmailFeedback({ text: 'Please enter a recipient email address', type: 'error' });
      return;
    }

    setEmailSending(true);
    setEmailFeedback({ text: '', type: '' });
    try {
      await masterService.sendVendorInvite({
        email: inviteEmail.trim(),
        phone: invitePhone.trim(),
        vendorName: inviteName.trim()
      });
      setEmailFeedback({ 
        text: `Invitation email dispatched successfully to ${inviteEmail.trim()}`, 
        type: 'success' 
      });
    } catch (err) {
      // Fallback to mailto link if direct dispatch failed
      setEmailFeedback({ 
        text: `Error sending email: ${err.message}. You can also use the WhatsApp or Copy Link button.`, 
        type: 'error' 
      });
    } finally {
      setEmailSending(false);
    }
  };

  // Direct Manual Create
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await masterService.createVendor({
        name,
        gstin,
        phone,
        email,
        address: `${address}${city ? ', ' + city : ''}${state ? ', ' + state : ''}`,
        city,
        state,
        advance_pct: Number(advancePct),
        credit_days: Number(creditDays),
        categories: []
      });
      setShowAddModal(false);
      setName('');
      setGstin('');
      setPhone('');
      setEmail('');
      setAddress('');
      setCity('');
      fetchVendors();
      alert('Vendor registered successfully!');
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async (id, vendorName) => {
    if (!window.confirm(`Delete ${vendorName}?`)) return;
    try {
      await masterService.deleteVendor(id);
      fetchVendors();
    } catch (e) {
      alert(e.message);
    }
  };

  // Helper to parse vendor documents
  const getVendorDocuments = (vendor) => {
    if (!vendor || !vendor.documents) return [];
    if (Array.isArray(vendor.documents)) return vendor.documents;
    try {
      return JSON.parse(vendor.documents);
    } catch (e) {
      return [];
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0 }}>Vendors & Suppliers Master</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                DDPL registered material suppliers, GSTIN, Bank KYC, and credit payment terms.
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => {
            setAddModalTab('invite');
            setEmailFeedback({ text: '', type: '' });
            setShowAddModal(true);
          }} 
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)' }}
        >
          <Plus size={16} />
          <span>Add New Vendor</span>
        </button>
      </div>

      {/* Filter & Stats Row */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by vendor name, GSTIN, PAN, city, phone, contact..."
              className="form-control"
              style={{ paddingLeft: '2.35rem', fontSize: '0.875rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <span className="badge badge-approved" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
              {vendors.length} Total Registered
            </span>
            <span className="badge badge-issued" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
              {vendors.filter(v => v.active).length} Active
            </span>
            {vendors.some(v => !v.active) && (
              <span className="badge badge-rejected" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                {vendors.filter(v => !v.active).length} On Hold
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Vendor / Company</th>
                <th>GSTIN & PAN</th>
                <th>City & Location</th>
                <th>Contact Details</th>
                <th>Bank & IFSC</th>
                <th>Terms</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading vendor register from database...
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No vendors found matching your search.
                  </td>
                </tr>
              ) : (
                vendors.map((v, idx) => {
                  const docs = getVendorDocuments(v);
                  return (
                    <tr key={v.id} style={{ opacity: v.active ? 1 : 0.75 }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {v.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px', flexWrap: 'wrap' }}>
                            {v.constitution && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {v.constitution}
                              </span>
                            )}
                            {docs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedVendor(v)}
                                style={{ 
                                  fontSize: '0.72rem', 
                                  background: 'var(--success-bg)', 
                                  color: 'var(--success-text)', 
                                  border: '1px solid #a7f3d0',
                                  padding: '2px 7px', 
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer'
                                }}
                                title="Click to view full KYC documents & uploaded images"
                              >
                                <Check size={11} /> 📁 KYC Docs ({docs.length})
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {v.gstin ? (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--primary-700)', fontWeight: 600 }}>
                              {v.gstin}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--warning-text)' }}>Unregistered</span>
                          )}
                          {v.pan && (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              PAN: {v.pan}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {v.city || '—'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {v.state || ''}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.82rem' }}>
                          {v.contact_person && (
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v.contact_person}</span>
                          )}
                          {v.phone && (
                            <span style={{ color: 'var(--text-secondary)' }}>📞 {v.phone}</span>
                          )}
                          {v.email && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>✉️ {v.email}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v.bank_name || '—'}</span>
                          {v.ifsc && (
                            <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              IFSC: {v.ifsc}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-draft" style={{ fontSize: '0.75rem' }}>
                          {v.advance_pct ? `${v.advance_pct}% Adv` : ''} {v.credit_days ? `${v.credit_days}d Credit` : 'Net 30'}
                        </span>
                      </td>
                      <td>
                        {v.active ? (
                          <span className="badge badge-approved" style={{ fontSize: '0.72rem' }}>Active</span>
                        ) : (
                          <span className="badge badge-rejected" style={{ fontSize: '0.72rem' }}>Hold</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          <button
                            onClick={() => setSelectedVendor(v)}
                            className="btn btn-secondary btn-sm"
                            title="View Full Vendor & Bank KYC Details"
                            style={{ padding: '0.35rem 0.55rem' }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(v.id, v.name)}
                            className="btn btn-danger btn-sm"
                            title="Delete Vendor"
                            style={{ padding: '0.35rem 0.55rem' }}
                          >
                            <Trash2 size={15} />
                          </button>
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

      {/* Vendor KYC & Bank Details Modal */}
      {selectedVendor && (() => {
        const vendorDocs = getVendorDocuments(selectedVendor);
        return (
          <div className="modal-backdrop" onClick={() => setSelectedVendor(null)}>
            <div className="modal-dialog-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
              <div className="modal-header-custom" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {selectedVendor.name}
                    </h2>
                    {selectedVendor.active ? (
                      <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>Active</span>
                    ) : (
                      <span className="badge badge-rejected" style={{ fontSize: '0.7rem' }}>On Hold</span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
                    {selectedVendor.constitution || 'Vendor'} • GST Treatment: {selectedVendor.gst_treatment || 'Standard'} • {selectedVendor.form_submitted || 'Registered'}
                  </p>
                </div>
                <button onClick={() => setSelectedVendor(null)} className="close-btn" title="Close">
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
                
                {/* Registration & Tax */}
                <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileCheck size={16} /> Tax & Business Profile
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', fontSize: '0.82rem' }}>
                    <div><strong>GSTIN:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedVendor.gstin || 'None (Unregistered)'}</span></div>
                    <div><strong>PAN:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedVendor.pan || '—'}</span></div>
                    <div><strong>Established:</strong> <span>{selectedVendor.year_established || '—'}</span></div>
                    <div><strong>Employees:</strong> <span>{selectedVendor.employees || '—'}</span></div>
                    {selectedVendor.website && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <strong>Website:</strong> <a href={selectedVendor.website} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-600)' }}>{selectedVendor.website}</a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bank & Payment Details */}
                <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--primary-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CreditCard size={16} /> Bank Account & Settlement Details (KYC)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', fontSize: '0.82rem' }}>
                    <div><strong>Bank Name:</strong> <span>{selectedVendor.bank_name || '—'}</span></div>
                    <div><strong>Branch:</strong> <span>{selectedVendor.branch || '—'}</span></div>
                    <div><strong>Account Holder:</strong> <span>{selectedVendor.account_holder || selectedVendor.name}</span></div>
                    <div><strong>Account Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedVendor.account_no || '—'}</span></div>
                    <div><strong>Account Type:</strong> <span>{selectedVendor.account_type || 'Current'}</span></div>
                    <div><strong>IFSC Code:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-700)' }}>{selectedVendor.ifsc || '—'}</span></div>
                    {selectedVendor.micr && <div><strong>MICR:</strong> <span>{selectedVendor.micr}</span></div>}
                    <div><strong>Agreed Terms:</strong> <span>{selectedVendor.advance_pct || 0}% Advance / {selectedVendor.credit_days || 30} Days Credit</span></div>
                  </div>
                </div>

                {/* Contact & Location */}
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Phone size={16} /> Contact Information & Address
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', fontSize: '0.82rem' }}>
                    <div><strong>Contact Person:</strong> <span>{selectedVendor.contact_person || '—'} {selectedVendor.designation ? `(${selectedVendor.designation})` : ''}</span></div>
                    <div><strong>Mobile:</strong> <span>{selectedVendor.phone || '—'}</span></div>
                    <div><strong>Email:</strong> <span>{selectedVendor.email || '—'}</span></div>
                    {selectedVendor.landline && <div><strong>Landline:</strong> <span>{selectedVendor.landline}</span></div>}
                    <div style={{ gridColumn: 'span 2' }}>
                      <strong>Registered Address:</strong> <span>{selectedVendor.address || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Uploaded KYC Documents */}
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={16} color="var(--primary-600)" />
                    <span>Uploaded KYC Documents & Attachments ({vendorDocs.length})</span>
                  </h4>
                  {vendorDocs.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0, fontStyle: 'italic' }}>
                      No KYC documents attached for this vendor. (Registered directly or awaiting verification documents).
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {vendorDocs.map((doc, dIdx) => (
                        <div
                          key={dIdx}
                          style={{
                            background: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.65rem 0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.5rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {(doc.dataUrl?.startsWith('data:image/') || (/\.(jpeg|jpg|png|webp|gif)$/i).test(doc.dataUrl || '') || (/\.(jpeg|jpg|png|webp|gif)$/i).test(doc.name || '')) ? (
                              <img
                                src={resolveDocUrl(doc.dataUrl)}
                                alt={doc.name}
                                onClick={() => setPreviewDoc(doc)}
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '6px',
                                  objectFit: 'cover',
                                  border: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                  boxShadow: 'var(--shadow-sm)'
                                }}
                                title="Click to view full image"
                              />
                            ) : (
                              <div style={{ width: '44px', height: '44px', borderRadius: '6px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--primary-100)' }}>
                                <FileText size={20} />
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                                {doc.typeLabel || doc.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {doc.name} {doc.size ? `• ${(doc.size / 1024).toFixed(1)} KB` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem' }}
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(doc)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem' }}
                              title="Download original document"
                            >
                              <Download size={13} />
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Scope & Products */}
                {(selectedVendor.goods_services || selectedVendor.brands || selectedVendor.review_note) && (
                  <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                    {selectedVendor.goods_services && (
                      <div style={{ marginBottom: '0.4rem' }}>
                        <strong>Offered Goods & Services:</strong> <span>{selectedVendor.goods_services}</span>
                      </div>
                    )}
                    {selectedVendor.brands && (
                      <div style={{ marginBottom: '0.4rem' }}>
                        <strong>Brands Represented:</strong> <span>{selectedVendor.brands}</span>
                      </div>
                    )}
                    {selectedVendor.review_note && (
                      <div style={{ color: 'var(--danger-text)' }}>
                        <strong>Audit / Review Note:</strong> <span>{selectedVendor.review_note}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <button onClick={() => setSelectedVendor(null)} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Vendor / Onboarding Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px', width: '100%', margin: 0, boxShadow: 'var(--shadow-xl)', borderRadius: 'var(--radius-lg)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Add / Onboard Vendor
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Generate vendor onboarding link or add vendor credentials manually
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="close-btn" title="Close">
                <X size={20} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setAddModalTab('invite')}
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: addModalTab === 'invite' ? '2px solid var(--primary-600)' : '2px solid transparent',
                  color: addModalTab === 'invite' ? 'var(--primary-600)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <Share2 size={16} />
                <span>Share Registration Link (WhatsApp & Email)</span>
              </button>

              <button
                type="button"
                onClick={() => setAddModalTab('manual')}
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: addModalTab === 'manual' ? '2px solid var(--primary-600)' : '2px solid transparent',
                  color: addModalTab === 'manual' ? 'var(--primary-600)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <Plus size={16} />
                <span>Quick Manual Entry</span>
              </button>
            </div>

            {/* TAB 1: INVITE & SHARE LINK */}
            {addModalTab === 'invite' && (
              <div>
                {/* Onboarding Link Display Card */}
                <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-800)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      🔗 Vendor Registration Link
                    </span>
                    <a
                      href={registrationUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '0.78rem', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}
                    >
                      <span>Open Link</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={registrationUrl}
                      className="form-control"
                      style={{ background: '#ffffff', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 500 }}
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="btn btn-primary"
                      style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem' }}
                    >
                      {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                  <p style={{ margin: '0.45rem 0 0', fontSize: '0.75rem', color: 'var(--primary-700)' }}>
                    Vendors can open this link to fill complete profile details, bank KYC, and upload documents directly.
                  </p>
                </div>

                {/* Form to enter vendor Contact Number & Email */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Vendor / Company Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Building Solutions"
                      className="form-control"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">WhatsApp / Phone Number</label>
                      <input
                        type="tel"
                        placeholder="e.g. 9820243165"
                        className="form-control"
                        value={invitePhone}
                        onChange={(e) => setInvitePhone(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Vendor Email Address</label>
                      <input
                        type="email"
                        placeholder="e.g. sales@vendor.com"
                        className="form-control"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Status Feedback */}
                {emailFeedback.text && (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: emailFeedback.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                      color: emailFeedback.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
                      border: `1px solid ${emailFeedback.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)'}`
                    }}
                  >
                    {emailFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{emailFeedback.text}</span>
                  </div>
                )}

                {/* Action Buttons to Share */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    style={{
                      background: '#25D366',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.65rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <MessageSquare size={16} />
                    <span>Share on WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendEmailInvite}
                    disabled={emailSending}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 1rem'
                    }}
                  >
                    <Send size={16} />
                    <span>{emailSending ? 'Sending Email...' : 'Send via Email'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: MANUAL DIRECT ENTRY */}
            {addModalTab === 'manual' && (
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label className="form-label">Vendor Company Name *</label>
                  <input type="text" required placeholder="e.g. UltraTech Concrete Solutions" className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input type="text" placeholder="27AAACG0000A1Z5" className="form-control" value={gstin} onChange={(e) => setGstin(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input type="text" placeholder="+91 98220 00000" className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input type="text" placeholder="Pune" className="form-control" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input type="text" placeholder="Maharashtra" className="form-control" value={state} onChange={(e) => setState(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" placeholder="sales@vendor.com" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Office / Billing Address</label>
                  <textarea rows="2" placeholder="Street, Industrial Area, PIN..." className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Advance %</label>
                    <input type="number" min="0" max="100" className="form-control" value={advancePct} onChange={(e) => setAdvancePct(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Days</label>
                    <input type="number" min="0" className="form-control" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Vendor</button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* Preview Document Modal */}
      {previewDoc && (
        <div className="modal-backdrop" onClick={() => setPreviewDoc(null)}>
          <div className="modal-dialog-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header-custom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{previewDoc.typeLabel || previewDoc.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDoc)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem' }}
                  title="Download File"
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
                <button onClick={() => setPreviewDoc(null)} className="close-btn" title="Close"><X size={20} /></button>
              </div>
            </div>
            <div style={{ textAlign: 'center', maxHeight: '70vh', overflow: 'auto' }}>
              {(previewDoc.dataUrl?.startsWith('data:image/') || (/\.(jpeg|jpg|png|webp|gif)$/i).test(previewDoc.dataUrl || '') || (/\.(jpeg|jpg|png|webp|gif)$/i).test(previewDoc.name || '')) ? (
                <div style={{ padding: '0.5rem' }}>
                  <img
                    src={resolveDocUrl(previewDoc.dataUrl)}
                    alt={previewDoc.name}
                    style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div style={{ padding: '2rem' }}>
                  <FileText size={48} style={{ color: 'var(--primary-600)', marginBottom: '1rem' }} />
                  <p style={{ fontWeight: 600 }}>Document: {previewDoc.name}</p>
                  <button
                    type="button"
                    onClick={() => handleDownloadDoc(previewDoc)}
                    className="btn btn-primary"
                    style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Download size={16} /> Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default VendorsPage;
