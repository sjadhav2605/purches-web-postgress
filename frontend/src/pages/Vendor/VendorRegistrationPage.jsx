import React, { useState } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  Upload, 
  FileText, 
  X, 
  AlertCircle, 
  Eye, 
  CreditCard, 
  ShieldCheck, 
  Check, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  Layers, 
  FileCheck
} from 'lucide-react';
import axios from 'axios';

// Available categories for multi-select
const POPULAR_CATEGORIES = [
  'Cement & Concrete',
  'Steel & TMT Bars',
  'Electrical & Cables',
  'Plumbing & Sanitaryware',
  'Tiles & Natural Stones',
  'Plywood & Timber',
  'Paints, Putty & Primers',
  'Hardware & Fasteners',
  'Aluminium & Glass',
  'Fabrication & Welding',
  'Safety PPE & Equipment',
  'Ready-Mix Concrete (RMC)',
  'Waterproofing & Chemicals',
  'Modular Furniture & Decor'
];

const REQUIRED_DOC_TYPES = [
  { id: 'gst_certificate', label: 'GST Registration Certificate', required: true, hint: 'Form REG-06 or GST Certificate' },
  { id: 'pan_card', label: 'PAN Card Copy', required: true, hint: 'Company or Proprietor PAN' },
  { id: 'cancelled_cheque', label: 'Cancelled Cheque / Bank Passbook', required: true, hint: 'For Bank Account & IFSC verification' },
  { id: 'msme_certificate', label: 'MSME / Udyam Registration (Optional)', required: false, hint: 'If registered under MSME / Udyam' },
  { id: 'other_document', label: 'Company Profile / Catalog (Optional)', required: false, hint: 'Product brochure or credentials' }
];

export const VendorRegistrationPage = () => {
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    constitution: 'Sole Proprietorship',
    year_established: '',
    years_in_business: '',
    website: '',
    employees: '1-10',

    // Tax
    gstin: '',
    gst_treatment: 'Regular',
    pan: '',

    // Contact
    contact_person: '',
    designation: 'Proprietor / Director',
    phone: '',
    email: '',
    landline: '',

    // Address
    address: '',
    city: '',
    state: 'Maharashtra',
    pin: '',

    // Bank
    account_holder: '',
    bank_name: '',
    branch: '',
    account_no: '',
    confirm_account_no: '',
    account_type: 'Current',
    ifsc: '',
    micr: '',
    advance_pct: 0,
    credit_days: 30,

    // Scope
    categories: [],
    goods_services: '',
    brands: '',

    declaration: false
  });

  // Uploaded documents state: array of { typeId, typeLabel, name, dataUrl, size }
  const [documents, setDocuments] = useState([]);
  const [uploadingDocId, setUploadingDocId] = useState(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const toggleCategory = (cat) => {
    setFormData(prev => {
      const exists = prev.categories.includes(cat);
      return {
        ...prev,
        categories: exists 
          ? prev.categories.filter(c => c !== cat)
          : [...prev.categories, cat]
      };
    });
  };

  // Compress / read file helper
  const handleFileUpload = (docType, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('File size exceeds 8MB limit. Please choose a smaller file.');
      return;
    }

    setUploadingDocId(docType.id);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1200;
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

          addOrReplaceDoc({
            typeId: docType.id,
            typeLabel: docType.label,
            name: file.name,
            dataUrl,
            size: Math.round((dataUrl.length * 3) / 4)
          });
          setUploadingDocId(null);
        };
        img.onerror = () => {
          alert('Could not read image file.');
          setUploadingDocId(null);
        };
        img.src = event.target.result;
      };
      reader.onerror = () => setUploadingDocId(null);
      reader.readAsDataURL(file);
    } else {
      // PDF or other documents
      const reader = new FileReader();
      reader.onload = () => {
        addOrReplaceDoc({
          typeId: docType.id,
          typeLabel: docType.label,
          name: file.name,
          dataUrl: reader.result,
          size: file.size
        });
        setUploadingDocId(null);
      };
      reader.onerror = () => setUploadingDocId(null);
      reader.readAsDataURL(file);
    }
  };

  const addOrReplaceDoc = (newDoc) => {
    setDocuments(prev => {
      const filtered = prev.filter(d => d.typeId !== newDoc.typeId);
      return [...filtered, newDoc];
    });
  };

  const removeDoc = (typeId) => {
    setDocuments(prev => prev.filter(d => d.typeId !== typeId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.name.trim()) {
      setErrorMessage('Please enter Vendor / Company legal name');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage('Please enter Contact mobile number');
      return;
    }
    if (!formData.email.trim()) {
      setErrorMessage('Please enter Official email address');
      return;
    }
    if (formData.account_no && formData.confirm_account_no && formData.account_no !== formData.confirm_account_no) {
      setErrorMessage('Bank account numbers do not match! Please verify.');
      return;
    }
    if (!formData.declaration) {
      setErrorMessage('Please accept the accuracy declaration checkbox before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      // Build payload for public registration
      const payload = {
        name: formData.name.trim(),
        constitution: formData.constitution,
        year_established: formData.year_established || null,
        years_in_business: formData.years_in_business ? Number(formData.years_in_business) : null,
        website: formData.website || null,
        employees: formData.employees,

        gstin: formData.gstin ? formData.gstin.trim().toUpperCase() : null,
        gst_treatment: formData.gst_treatment,
        pan: formData.pan ? formData.pan.trim().toUpperCase() : null,

        contact_person: formData.contact_person || null,
        designation: formData.designation || null,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        landline: formData.landline || null,

        address: `${formData.address}${formData.city ? ', ' + formData.city : ''}${formData.state ? ', ' + formData.state : ''}${formData.pin ? ' - ' + formData.pin : ''}`,
        city: formData.city || null,
        state: formData.state || null,
        pin: formData.pin || null,

        account_holder: formData.account_holder || formData.name,
        bank_name: formData.bank_name || null,
        branch: formData.branch || null,
        account_no: formData.account_no || null,
        account_type: formData.account_type || 'Current',
        ifsc: formData.ifsc ? formData.ifsc.trim().toUpperCase() : null,
        micr: formData.micr || null,
        advance_pct: Number(formData.advance_pct) || 0,
        credit_days: Number(formData.credit_days) || 30,

        categories: formData.categories,
        goods_services: formData.goods_services || null,
        brands: formData.brands || null,
        documents: documents
      };

      // Direct post to backend public endpoint
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const response = await axios.post(`${baseUrl}/public/vendors/register`, payload);

      if (response.data && response.data.success) {
        setSubmittedData({ ...payload, id: response.data.data?.id });
        setSubmittedSuccess(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error(response.data?.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Vendor registration error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to submit registration. Please try again.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION VIEW
  if (submittedSuccess && submittedData) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          {/* Top Brand Banner */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: '#ffffff', padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-full)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                D
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Decent Decor Pvt. Ltd.</span>
            </div>
          </div>

          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', boxShadow: 'var(--shadow-xl)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle2 size={44} />
            </div>

            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Vendor Registration Submitted!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.75rem', lineHeight: '1.6' }}>
              Thank you, <strong>{submittedData.name}</strong>. Your business details, banking KYC, and documents have been recorded successfully in the DDPL Procurement System.
            </p>

            <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', textAlign: 'left', marginBottom: '1.75rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Company Name:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{submittedData.name}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Constitution:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{submittedData.constitution}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>GSTIN:</span>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--primary-700)' }}>{submittedData.gstin || 'Unregistered'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Contact Person:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{submittedData.contact_person || '—'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Mobile / Phone:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{submittedData.phone}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Email:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{submittedData.email}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Bank & IFSC:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{submittedData.bank_name || '—'} ({submittedData.ifsc || '—'})</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>KYC Documents:</span>
                  <div style={{ fontWeight: 600, color: 'var(--success-text)' }}>{documents.length} File(s) Attached</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success-text)', fontSize: '0.85rem' }}>
                <Check size={16} />
                <span>Our purchase team will verify your documents and initiate RFQs / Orders.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSubmittedSuccess(false);
                  setSubmittedData(null);
                  setDocuments([]);
                  setFormData({
                    name: '',
                    constitution: 'Sole Proprietorship',
                    year_established: '',
                    years_in_business: '',
                    website: '',
                    employees: '1-10',
                    gstin: '',
                    gst_treatment: 'Regular',
                    pan: '',
                    contact_person: '',
                    designation: 'Proprietor / Director',
                    phone: '',
                    email: '',
                    landline: '',
                    address: '',
                    city: '',
                    state: 'Maharashtra',
                    pin: '',
                    account_holder: '',
                    bank_name: '',
                    branch: '',
                    account_no: '',
                    confirm_account_no: '',
                    account_type: 'Current',
                    ifsc: '',
                    micr: '',
                    advance_pct: 0,
                    credit_days: 30,
                    categories: [],
                    goods_services: '',
                    brands: '',
                    declaration: false
                  });
                }}
                className="btn btn-secondary"
                style={{ marginTop: '0.5rem', width: '100%', maxWidth: '280px' }}
              >
                Submit Another Registration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        
        {/* Top Header Banner */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: '#ffffff', padding: '0.55rem 1.35rem', borderRadius: 'var(--radius-full)', boxShadow: 'var(--shadow-sm)', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              D
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>DECENT DECOR PVT. LTD.</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procurement & Supply Chain</div>
            </div>
          </div>

          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
            Vendor & Supplier Registration Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '620px', margin: '0 auto' }}>
            Please fill in your company credentials, statutory GST/PAN details, bank settlement KYC, and upload verification documents for vendor empanelment.
          </p>
        </div>

        {errorMessage && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-text)', color: 'var(--danger-text)', padding: '0.9rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* SECTION 1: Company Profile */}
          <div className="card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>1. Company & Business Profile</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Legal entity details and establishment background</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.15rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Vendor / Company Legal Name *</label>
                <input
                  type="text"
                  required
                  name="name"
                  placeholder="e.g. UltraTech Concrete Solutions Pvt Ltd"
                  className="form-control"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Constitution / Entity Type *</label>
                <select
                  name="constitution"
                  className="form-control"
                  value={formData.constitution}
                  onChange={handleInputChange}
                >
                  <option value="Sole Proprietorship">Sole Proprietorship</option>
                  <option value="Partnership Firm">Partnership Firm</option>
                  <option value="Private Limited Company">Private Limited Company</option>
                  <option value="Public Limited Company">Public Limited Company</option>
                  <option value="Limited Liability Partnership (LLP)">Limited Liability Partnership (LLP)</option>
                  <option value="Joint Venture">Joint Venture</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Year Established</label>
                <input
                  type="text"
                  name="year_established"
                  placeholder="e.g. 2012"
                  className="form-control"
                  value={formData.year_established}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Years in Business</label>
                <input
                  type="number"
                  min="0"
                  name="years_in_business"
                  placeholder="e.g. 12"
                  className="form-control"
                  value={formData.years_in_business}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Total Employee Strength</label>
                <select
                  name="employees"
                  className="form-control"
                  value={formData.employees}
                  onChange={handleInputChange}
                >
                  <option value="1-10">1 - 10 Employees</option>
                  <option value="11-50">11 - 50 Employees</option>
                  <option value="51-200">51 - 200 Employees</option>
                  <option value="200+">200+ Employees</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Website URL (Optional)</label>
                <input
                  type="url"
                  name="website"
                  placeholder="https://www.example.com"
                  className="form-control"
                  value={formData.website}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Tax & Statutory */}
          <div className="card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileCheck size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>2. Statutory & Tax Registration</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Goods and Services Tax (GST) & Permanent Account Number (PAN)</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.15rem' }}>
              <div className="form-group">
                <label className="form-label">GSTIN (15 Digits)</label>
                <input
                  type="text"
                  name="gstin"
                  maxLength={15}
                  placeholder="27AAACG0000A1Z5"
                  className="form-control"
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 600 }}
                  value={formData.gstin}
                  onChange={handleInputChange}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Required for registered GST taxpayers</span>
              </div>

              <div className="form-group">
                <label className="form-label">GST Treatment</label>
                <select
                  name="gst_treatment"
                  className="form-control"
                  value={formData.gst_treatment}
                  onChange={handleInputChange}
                >
                  <option value="Regular">Regular Taxpayer</option>
                  <option value="Composition">Composition Scheme</option>
                  <option value="Unregistered">Unregistered Business</option>
                  <option value="SEZ">Special Economic Zone (SEZ)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">PAN Number (10 Digits) *</label>
                <input
                  type="text"
                  required
                  name="pan"
                  maxLength={10}
                  placeholder="AAACG0000A"
                  className="form-control"
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 600 }}
                  value={formData.pan}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Authorized Contact & Location */}
          <div className="card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Phone size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>3. Contact Person & Office Address</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Primary contact details for communication, enquiries, and purchase orders</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.15rem' }}>
              <div className="form-group">
                <label className="form-label">Contact Person Name *</label>
                <input
                  type="text"
                  required
                  name="contact_person"
                  placeholder="e.g. Ramesh Sharma"
                  className="form-control"
                  value={formData.contact_person}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Designation</label>
                <input
                  type="text"
                  name="designation"
                  placeholder="e.g. Managing Director / Sales Manager"
                  className="form-control"
                  value={formData.designation}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile / WhatsApp Number *</label>
                <input
                  type="tel"
                  required
                  name="phone"
                  placeholder="+91 98220 00000"
                  className="form-control"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Official Email Address *</label>
                <input
                  type="email"
                  required
                  name="email"
                  placeholder="sales@vendorcompany.com"
                  className="form-control"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Office / Billing Address *</label>
                <textarea
                  rows="2"
                  required
                  name="address"
                  placeholder="Plot No., Industrial Area, Street, Landmark..."
                  className="form-control"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">City *</label>
                <input
                  type="text"
                  required
                  name="city"
                  placeholder="Pune / Mumbai"
                  className="form-control"
                  value={formData.city}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">State *</label>
                <input
                  type="text"
                  required
                  name="state"
                  placeholder="Maharashtra"
                  className="form-control"
                  value={formData.state}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">PIN Code *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  name="pin"
                  placeholder="411001"
                  className="form-control"
                  value={formData.pin}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Bank Account & Settlement KYC */}
          <div className="card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>4. Bank Account & Settlement Details (KYC)</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Direct bank transfer details for RTGS / NEFT payments</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.15rem' }}>
              <div className="form-group">
                <label className="form-label">Bank Name *</label>
                <input
                  type="text"
                  required
                  name="bank_name"
                  placeholder="e.g. HDFC Bank / State Bank of India"
                  className="form-control"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Branch Name</label>
                <input
                  type="text"
                  name="branch"
                  placeholder="e.g. Shivaji Nagar Branch, Pune"
                  className="form-control"
                  value={formData.branch}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Beneficiary Name *</label>
                <input
                  type="text"
                  required
                  name="account_holder"
                  placeholder="Exact Name as registered with Bank"
                  className="form-control"
                  value={formData.account_holder}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Type</label>
                <select
                  name="account_type"
                  className="form-control"
                  value={formData.account_type}
                  onChange={handleInputChange}
                >
                  <option value="Current">Current Account</option>
                  <option value="Savings">Savings Account</option>
                  <option value="Cash Credit / OD">Cash Credit / Overdraft</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Account Number *</label>
                <input
                  type="text"
                  required
                  name="account_no"
                  placeholder="e.g. 50200012345678"
                  className="form-control"
                  style={{ fontFamily: 'monospace', fontWeight: 600 }}
                  value={formData.account_no}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Re-enter Account Number *</label>
                <input
                  type="text"
                  required
                  name="confirm_account_no"
                  placeholder="Re-enter Account Number"
                  className="form-control"
                  style={{ fontFamily: 'monospace', fontWeight: 600 }}
                  value={formData.confirm_account_no}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">IFSC Code (11 Digits) *</label>
                <input
                  type="text"
                  required
                  maxLength={11}
                  name="ifsc"
                  placeholder="HDFC0000001"
                  className="form-control"
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 600 }}
                  value={formData.ifsc}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">MICR Code (Optional)</label>
                <input
                  type="text"
                  name="micr"
                  placeholder="e.g. 411240002"
                  className="form-control"
                  value={formData.micr}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Proposed Advance %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  name="advance_pct"
                  placeholder="0"
                  className="form-control"
                  value={formData.advance_pct}
                  onChange={handleInputChange}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>0% for standard terms</span>
              </div>

              <div className="form-group">
                <label className="form-label">Offered Credit Days</label>
                <input
                  type="number"
                  min="0"
                  name="credit_days"
                  placeholder="30"
                  className="form-control"
                  value={formData.credit_days}
                  onChange={handleInputChange}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Standard is 30 days</span>
              </div>
            </div>
          </div>

          {/* SECTION 5: Products & Scope */}
          <div className="card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>5. Materials, Scope & Categories</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Select the categories and supplies your company provides</p>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ marginBottom: '0.6rem' }}>Supply Categories (Select all that apply)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {POPULAR_CATEGORIES.map(cat => {
                  const isSelected = formData.categories.includes(cat);
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        border: isSelected ? '1px solid var(--primary-600)' : '1px solid var(--border-color)',
                        background: isSelected ? 'var(--primary-50)' : '#ffffff',
                        color: isSelected ? 'var(--primary-700)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isSelected && <Check size={14} color="var(--primary-600)" />}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.15rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Goods & Services Summary</label>
                <textarea
                  rows="2"
                  name="goods_services"
                  placeholder="Briefly describe products, material grades, or services offered..."
                  className="form-control"
                  value={formData.goods_services}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Brands Represented / Authorized Dealerships</label>
                <input
                  type="text"
                  name="brands"
                  placeholder="e.g. UltraTech, Tata Tiscon, Finolex, Asian Paints, Jaquar"
                  className="form-control"
                  value={formData.brands}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* SECTION 6: KYC Document Attachments */}
          <div className="card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>6. Mandatory KYC Document Attachments</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Upload clear scan or PDF copy of statutory and banking records</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {REQUIRED_DOC_TYPES.map(docType => {
                const uploaded = documents.find(d => d.typeId === docType.id);
                const isUploading = uploadingDocId === docType.id;

                return (
                  <div
                    key={docType.id}
                    style={{
                      border: uploaded ? '1px solid var(--success-text)' : '1px dashed var(--border-color)',
                      background: uploaded ? 'var(--success-bg)' : 'var(--bg-card-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: uploaded ? '#d1fae5' : '#ffffff', color: uploaded ? 'var(--success-text)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                        {uploaded ? <CheckCircle2 size={20} /> : <FileText size={20} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {docType.label} {docType.required && <span style={{ color: 'var(--danger-text)' }}>*</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {uploaded ? `${uploaded.name} (${(uploaded.size / 1024).toFixed(1)} KB)` : docType.hint}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {uploaded ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(uploaded)}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem' }}
                          >
                            <Eye size={14} />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDoc(docType.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--danger-text)', padding: '0.35rem 0.65rem' }}
                          >
                            <X size={14} />
                            <span>Remove</span>
                          </button>
                        </>
                      ) : (
                        <label
                          className="btn btn-secondary btn-sm"
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.45rem 0.85rem',
                            margin: 0
                          }}
                        >
                          <Upload size={14} />
                          <span>{isUploading ? 'Uploading...' : 'Choose File (PDF/Image)'}</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            style={{ display: 'none' }}
                            disabled={isUploading}
                            onChange={(e) => handleFileUpload(docType, e)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 7: Declaration & Submit */}
          <div className="card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <input
                type="checkbox"
                id="declaration"
                name="declaration"
                style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                checked={formData.declaration}
                onChange={handleInputChange}
              />
              <label htmlFor="declaration" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.5' }}>
                <strong>Declaration & Authentication:</strong> I / We confirm that the details furnished above and documents attached are true, authentic, and accurate. I/we authorize <strong>Decent Decor Pvt. Ltd. (DDPL)</strong> to verify credentials with banks and tax authorities for vendor registration and future commercial dealings.
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  fontSize: '1rem',
                  padding: '0.75rem 2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  fontWeight: 700
                }}
              >
                {submitting ? (
                  <>Submitting Registration & Documents...</>
                ) : (
                  <>
                    <ShieldCheck size={20} />
                    <span>Submit Vendor Registration</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

        {/* Modal Document Preview */}
        {previewDoc && (
          <div className="modal-backdrop" onClick={() => setPreviewDoc(null)}>
            <div className="modal-dialog-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
              <div className="modal-header-custom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{previewDoc.typeLabel}: {previewDoc.name}</h3>
                <button onClick={() => setPreviewDoc(null)} className="close-btn"><X size={20} /></button>
              </div>
              <div style={{ textAlign: 'center', maxHeight: '70vh', overflow: 'auto' }}>
                {previewDoc.dataUrl?.startsWith('data:image/') ? (
                  <img src={previewDoc.dataUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 'var(--radius-sm)' }} />
                ) : (
                  <div style={{ padding: '2rem' }}>
                    <FileText size={48} style={{ color: 'var(--primary-600)', marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 600 }}>PDF Document: {previewDoc.name}</p>
                    <a href={previewDoc.dataUrl} download={previewDoc.name} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                      Download & View File
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          © {new Date().getFullYear()} Decent Decor Pvt. Ltd. (DDPL). All rights reserved. Secure Vendor Portal.
        </div>
      </div>
    </div>
  );
};

export default VendorRegistrationPage;
