import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { requisitionService } from '../../services/requisition.service.js';
import { masterService } from '../../services/master.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Save, 
  AlertCircle, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Sparkles, 
  HelpCircle,
  CheckCircle2,
  FileText
} from 'lucide-react';

// Client-side image compression down to max 1600px
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      // PDF or non-image
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, size: file.size });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({
          name: file.name,
          dataUrl,
          size: Math.round((dataUrl.length * 3) / 4)
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const CATEGORIES = [
  'Civil / Structural',
  'Plaster & Masonry',
  'Paint & Finishing',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Carpentry & Hardware',
  'Safety & Consumables',
  'General / Other'
];

export const RequisitionFormPage = () => {
  const navigate = useNavigate();
  const { user, activeRole } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Master data
  const [sites, setSites] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Form Header State
  const [siteId, setSiteId] = useState('');
  const [category, setCategory] = useState('Civil / Structural');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Line items
  const [items, setItems] = useState([
    {
      material_id: null,
      description: '',
      category: 'Civil / Structural',
      spec: '',
      unit: 'Bag',
      quantity: 1,
      est_rate: 0,
      remarks: '',
      is_custom: false,
      justification: '',
      photos: []
    }
  ]);

  // Custom Item Modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState({
    description: '',
    category: 'Civil / Structural',
    spec: '',
    unit: 'Nos',
    quantity: 1,
    justification: '',
    photos: []
  });

  // Load Sites first
  useEffect(() => {
    const loadSites = async () => {
      try {
        const sitesData = await masterService.getSites();
        setSites(sitesData || []);
        if (sitesData && sitesData.length > 0) {
          // If user has default site, use it, else first site
          const defaultSite = user?.default_site_id 
            ? sitesData.find(s => s.id === user.default_site_id) 
            : sitesData[0];
          setSiteId(defaultSite ? defaultSite.id : sitesData[0].id);
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      } finally {
        setLoadingMasters(false);
      }
    };
    loadSites();
  }, [user]);

  // Load materials (common + site-specific) whenever siteId changes or on initial load
  useEffect(() => {
    const loadSiteMaterials = async () => {
      try {
        const mats = await masterService.getMaterials('', siteId ? Number(siteId) : null, null, true);
        setMaterials(mats || []);
      } catch (err) {
        console.error('Failed to load materials for site:', err);
      }
    };
    loadSiteMaterials();
  }, [siteId]);

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    // If only one item and it's not custom, update its category and default unit
    if (items.length === 1 && !items[0].is_custom && !items[0].material_id) {
      const defaultUnit = newCat === 'Paint & Finishing' ? 'Liter' : (['Civil / Structural', 'Plaster & Masonry'].includes(newCat) ? 'Bag' : 'Nos');
      setItems([{
        ...items[0],
        category: newCat,
        unit: defaultUnit,
        description: '',
        spec: ''
      }]);
    }
  };

  const handleSiteChange = (newSiteId) => {
    if (items.length > 1 || (items.length === 1 && items[0].description)) {
      if (!window.confirm('Changing project site will refresh available catalog materials. Do you wish to proceed?')) {
        return;
      }
    }
    setSiteId(newSiteId);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        material_id: null,
        description: '',
        category: category || 'Civil / Structural',
        spec: '',
        unit: 'Bag',
        quantity: 1,
        est_rate: 0,
        remarks: '',
        is_custom: false,
        justification: '',
        photos: []
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) {
      alert('A request must contain at least one item');
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

    // Check against catalogue
    const matched = materials.find(
      (m) => m.description.toLowerCase().trim() === value.toLowerCase().trim()
    );
    if (matched) {
      updated[index].material_id = matched.id;
      if (matched.unit) updated[index].unit = matched.unit;
      if (matched.spec) updated[index].spec = matched.spec;
      if (matched.category) updated[index].category = matched.category;
      if (matched.ref_rate) updated[index].est_rate = matched.ref_rate;
    }
    setItems(updated);
  };

  // Photo handlers
  const handlePhotoUpload = async (index, files) => {
    if (!files || files.length === 0) return;
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        uploaded.push(compressed);
      }
      const updated = [...items];
      updated[index].photos = [...(updated[index].photos || []), ...uploaded];
      setItems(updated);
    } catch (e) {
      alert('Failed to process image: ' + e.message);
    }
  };

  const handleRemovePhoto = (itemIndex, photoIndex) => {
    const updated = [...items];
    updated[itemIndex].photos = updated[itemIndex].photos.filter((_, i) => i !== photoIndex);
    setItems(updated);
  };

  // Custom Item Modal Handlers
  const handleCustomModalSubmit = (e) => {
    e.preventDefault();
    if (!customForm.description.trim()) {
      alert('Please enter material description');
      return;
    }
    if (!customForm.justification.trim()) {
      alert('Justification is REQUIRED for custom items not in the site catalog.');
      return;
    }

    setItems([
      ...items,
      {
        material_id: null,
        description: customForm.description.trim(),
        category: customForm.category,
        spec: customForm.spec.trim(),
        unit: customForm.unit,
        quantity: Number(customForm.quantity) || 1,
        est_rate: 0,
        remarks: 'Custom non-catalog item',
        is_custom: true,
        justification: customForm.justification.trim(),
        photos: customForm.photos || []
      }
    ]);

    // Reset and close
    setCustomForm({
      description: '',
      category: category || 'Civil / Structural',
      spec: '',
      unit: 'Nos',
      quantity: 1,
      justification: '',
      photos: []
    });
    setShowCustomModal(false);
  };

  const handleCustomPhotoUpload = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        uploaded.push(compressed);
      }
      setCustomForm(prev => ({
        ...prev,
        photos: [...prev.photos, ...uploaded]
      }));
    } catch (e) {
      alert('Failed to process image: ' + e.message);
    }
  };

  const isSupervisor = activeRole === 'supervisor';
  const isPC = activeRole === 'pc';
  const showRates = ['purchase', 'admin'].includes(activeRole);

  const handleSave = async (submitStatus = null) => {
    setError('');

    let finalStatus = submitStatus;
    if (!finalStatus) {
      finalStatus = isSupervisor ? 'Pending PC Approval' : 'PR Raised';
    }

    if (!siteId) {
      setError('Please select a project site');
      return;
    }

    // Validate line items
    for (let i = 0; i < items.length; i++) {
      if (!items[i].description.trim()) {
        setError(`Please enter description for Item #${i + 1}`);
        return;
      }
      if (Number(items[i].quantity) <= 0) {
        setError(`Quantity for Item #${i + 1} must be greater than zero`);
        return;
      }
      if (items[i].is_custom && !items[i].justification?.trim()) {
        setError(`Item #${i + 1} is a custom item and requires a justification`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        site_id: Number(siteId),
        category,
        status: finalStatus,
        required_by_date: requiredByDate || null,
        remarks,
        items: items.map((item) => ({
          material_id: item.material_id || null,
          description: item.description,
          category: item.category || category,
          spec: item.spec || null,
          unit: item.unit,
          quantity: Number(item.quantity),
          est_rate: showRates ? (Number(item.est_rate) || 0) : 0,
          remarks: item.remarks || null,
          is_custom: Boolean(item.is_custom),
          justification: item.justification || null,
          photos: item.photos || []
        }))
      };

      const created = await requisitionService.createRequisition(payload);
      alert(`Request ${created.pr_no} successfully saved as [${finalStatus}]!`);
      navigate('/requisitions');
    } catch (err) {
      setError(err.message || 'Failed to save request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/requisitions" className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} />
            <span>Back to List</span>
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Raise Purchase Request (PR)</h1>
        </div>

        <button
          type="button"
          onClick={() => setShowCustomModal(true)}
          className="btn btn-secondary"
          style={{ borderColor: 'var(--primary-100)', color: 'var(--primary-100)' }}
        >
          <Sparkles size={16} />
          <span>Add Custom Item (Non-Catalog)</span>
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <div>
        {/* Section 1: Header */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>1. Request Header & Project Site</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Project Site Code *</label>
              <select
                className="form-control"
                value={siteId}
                onChange={(e) => handleSiteChange(e.target.value)}
                required
              >
                {loadingMasters ? (
                  <option value="">Loading sites...</option>
                ) : sites.length === 0 ? (
                  <option value="">No active sites available</option>
                ) : (
                  sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))
                )}
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Auto-loads materials specific to this site plus company-wide common items.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Primary Request Category *</label>
              <select
                className="form-control"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                required
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary-600)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                ✨ {materials.filter(m => m.category === category).length} catalog materials ready for {category}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Required By Date</label>
              <input
                type="date"
                className="form-control"
                value={requiredByDate}
                onChange={(e) => setRequiredByDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Site Remarks / Justification</label>
            <textarea
              rows="2"
              className="form-control"
              placeholder="State requirement urgency, milestone or delivery location remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* Section 2: Material Items */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>2. Material Line Items ({items.length})</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                Requests can mix categories. Deleting one line never affects the others.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => setShowCustomModal(true)} className="btn btn-secondary btn-sm">
                <Sparkles size={14} />
                <span>+ Custom Item</span>
              </button>
              <button type="button" onClick={handleAddItem} className="btn btn-primary btn-sm">
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>
          </div>

          {/* Datalist for site materials */}
          <datalist id="materials-datalist">
            {materials.map((m) => (
              <option key={m.id} value={m.description}>
                {m.category} — {m.unit} {m.spec ? `(${m.spec})` : ''}
              </option>
            ))}
          </datalist>

          <div className="table-responsive">
            <table className="table" style={{ verticalAlign: 'top' }}>
              <thead>
                <tr>
                  <th style={{ width: showRates ? '30%' : '36%' }}>Material Description *</th>
                  <th style={{ width: showRates ? '16%' : '20%' }}>Specification</th>
                  <th style={{ width: showRates ? '10%' : '14%' }}>Unit *</th>
                  <th style={{ width: showRates ? '10%' : '12%' }}>Quantity *</th>
                  {showRates && <th style={{ width: '12%' }}>Ref. Rate (₹)</th>}
                  <th style={{ width: showRates ? '16%' : '12%' }}>Photos / Attachments</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const effectiveCategory = item.category || category;
                  const itemCategoryMaterials = materials.filter(m => m.category === effectiveCategory);
                  const itemOtherMaterials = materials.filter(m => m.category !== effectiveCategory);

                  return (
                    <tr key={index} style={{ background: item.is_custom ? 'rgba(56, 189, 248, 0.04)' : 'transparent' }}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {!item.is_custom ? (
                            <>
                              {/* Quick Category Material Selector Dropdown */}
                              <select
                                className="form-control"
                                style={{
                                  fontSize: '0.84rem',
                                  fontWeight: 600,
                                  color: item.description ? 'var(--primary-700)' : 'var(--text-secondary)',
                                  backgroundColor: '#f0f9ff',
                                  borderColor: item.description ? 'var(--primary-300)' : '#bae6fd',
                                  cursor: 'pointer'
                                }}
                                value={materials.some(m => m.description === item.description) ? item.description : ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleDescriptionChange(index, e.target.value);
                                  }
                                }}
                              >
                                <option value="">
                                  ▼ Select from {effectiveCategory} catalog ({itemCategoryMaterials.length} items)...
                                </option>
                                {itemCategoryMaterials.map((m) => (
                                  <option key={m.id} value={m.description}>
                                    {m.description} {m.spec ? `(${m.spec})` : ''} — {m.unit}
                                  </option>
                                ))}
                                {itemOtherMaterials.length > 0 && (
                                  <optgroup label="Other Categories">
                                    {itemOtherMaterials.map((m) => (
                                      <option key={m.id} value={m.description}>
                                        [{m.category}] {m.description}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>

                              {/* Direct text input with autocomplete datalist */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input
                                  type="text"
                                  required
                                  className="form-control"
                                  list={`materials-datalist-${index}`}
                                  placeholder="Or type / edit material description..."
                                  value={item.description}
                                  onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                  style={{ flex: 1, fontSize: '0.84rem' }}
                                />
                                <datalist id={`materials-datalist-${index}`}>
                                  {itemCategoryMaterials.map((m) => (
                                    <option key={m.id} value={m.description}>
                                      {m.category} — {m.unit} {m.spec ? `(${m.spec})` : ''}
                                    </option>
                                  ))}
                                  {itemOtherMaterials.map((m) => (
                                    <option key={m.id} value={m.description}>
                                      [{m.category}] {m.unit}
                                    </option>
                                  ))}
                                </datalist>
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                {item.description}
                              </span>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span className="badge badge-issued" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
                                  Custom Item
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={item.justification}>
                                  Justification: {item.justification}
                                </span>
                              </div>
                            </div>
                          )}

                          <input
                            type="text"
                            className="form-control"
                            placeholder="Item specific remarks / notes..."
                            value={item.remarks || ''}
                            onChange={(e) => handleItemChange(index, 'remarks', e.target.value)}
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', marginTop: '0.1rem' }}
                          />
                        </div>
                      </td>

                    <td>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Grade, thickness, make"
                        value={item.spec || ''}
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
                        <option value="Piece">Piece</option>
                      </select>
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        className="form-control"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      />
                    </td>

                    {showRates && (
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          placeholder="0.00"
                          value={item.est_rate || ''}
                          onChange={(e) => handleItemChange(index, 'est_rate', e.target.value)}
                        />
                      </td>
                    )}

                    <td>
                      {/* Photo widget with thumbnail preview, remove and replace */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'fit-content' }}>
                          <Upload size={12} />
                          <span>Add Photo</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) => handlePhotoUpload(index, e.target.files)}
                          />
                        </label>

                        {item.photos && item.photos.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {item.photos.map((p, pIdx) => (
                              <div key={pIdx} style={{ position: 'relative', display: 'inline-block' }}>
                                <img
                                  src={p.dataUrl}
                                  alt={p.name}
                                  style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(index, pIdx)}
                                  style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger-bg)', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                  title="Remove photo"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="btn btn-danger btn-sm"
                        title="Delete this line"
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
        </div>

        {/* Action Buttons: Save Draft vs Submit PR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem' }}>
          <Link to="/requisitions" className="btn btn-secondary">
            Cancel
          </Link>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave('Draft')}
              className="btn btn-secondary"
              style={{ fontWeight: 600 }}
            >
              <Save size={16} />
              <span>Save as Draft</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave(isSupervisor ? 'Pending PC Approval' : 'PR Raised')}
              className="btn btn-primary"
              style={{ fontWeight: 600 }}
            >
              <CheckCircle2 size={16} />
              <span>
                {submitting
                  ? 'Submitting...'
                  : isSupervisor
                  ? 'Submit for PC Approval'
                  : isPC
                  ? 'Submit Request (Send to Purchase)'
                  : 'Submit Request (PR Raised)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Custom Item Modal */}
      {showCustomModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '560px', width: '100%', margin: 0, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                  <Sparkles size={16} style={{ color: 'var(--primary-600)' }} />
                  <span>Add Custom Non-Catalog Material</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Use this for items not available in the site master. Requires justification and admin review.
                </p>
              </div>
              <button onClick={() => setShowCustomModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCustomModalSubmit}>
              <div className="form-group">
                <label className="form-label">Material Name / Description *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. Acoustic Foam Panels 50mm"
                  value={customForm.description}
                  onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-control"
                    value={customForm.category}
                    onChange={(e) => setCustomForm({ ...customForm, category: e.target.value })}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure *</label>
                  <select
                    className="form-control"
                    value={customForm.unit}
                    onChange={(e) => setCustomForm({ ...customForm, unit: e.target.value })}
                  >
                    <option value="Nos">Nos</option>
                    <option value="Bag">Bag</option>
                    <option value="Brass">Brass</option>
                    <option value="Kg">Kg</option>
                    <option value="Liter">Liter</option>
                    <option value="Box">Box</option>
                    <option value="Sq.Ft">Sq.Ft</option>
                    <option value="Rmt">Rmt</option>
                    <option value="Set">Set</option>
                    <option value="Piece">Piece</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Specification</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Density, color, grade"
                    value={customForm.spec}
                    onChange={(e) => setCustomForm({ ...customForm, spec: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Required Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="form-control"
                    value={customForm.quantity}
                    onChange={(e) => setCustomForm({ ...customForm, quantity: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--warning-text)' }}>
                  Mandatory Justification *
                </label>
                <textarea
                  rows="2"
                  required
                  className="form-control"
                  placeholder="Explain why this item is required and why catalog items cannot be used..."
                  value={customForm.justification}
                  onChange={(e) => setCustomForm({ ...customForm, justification: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sample Photos / Specification Sheet (Optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="form-control"
                  onChange={(e) => handleCustomPhotoUpload(e.target.files)}
                />
                {customForm.photos && customForm.photos.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {customForm.photos.map((p, i) => (
                      <img key={i} src={p.dataUrl} alt={p.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <button type="button" onClick={() => setShowCustomModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add to Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
