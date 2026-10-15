import React, { useState } from 'react';
import { 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Camera, 
  Phone, 
  ChevronRight, 
  Check 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const SupervisorView = () => {
  const [deliveries, setDeliveries] = useState([
    {
      id: 101,
      po_no: 'PO-2026-0891',
      vendor: 'UltraTech Cement Ltd.',
      material: 'Ready Mix Concrete (RMC) M30 Grade',
      qty: '220 m³',
      vehicle: 'MH-14-BT-1102',
      driver: 'Ganesh More',
      phone: '+91 9890123456',
      challan: 'CH-RMC-802',
      site: 'Kharadi IT Park (Block 2)',
      condition: 'Pending Inspection',
      time: 'Gate Arrived (10 mins ago)',
      status: 'Awaiting Inspection'
    },
    {
      id: 102,
      po_no: 'PO-2026-0887',
      vendor: 'Tata Steel Tubes & TMT',
      material: 'Fe 550D TMT Reinforcement Bars',
      qty: '28 MT',
      vehicle: 'MH-12-RN-9921',
      driver: 'Ramesh Shinde',
      phone: '+91 9822114455',
      challan: 'CH-4091',
      site: 'Baner Commercial Tower',
      condition: '100% OK',
      time: 'Today 09:30 AM',
      status: 'Verified & Accepted'
    },
    {
      id: 103,
      po_no: 'PO-2026-0862',
      vendor: 'Rajputana Granites',
      material: 'Polished Black Granite Slabs 18mm',
      qty: '120 Slabs',
      vehicle: 'MH-12-PQ-4412',
      driver: 'Sunil Patil',
      phone: '+91 9766554433',
      challan: 'GR-110',
      site: 'Dhayri Phase-1 Heights',
      condition: 'Defect Flagged',
      time: 'Yesterday',
      status: '4 Slabs Broken'
    },
    {
      id: 104,
      po_no: 'PO-2026-0884',
      vendor: 'Finolex Cables Ltd.',
      material: 'FRLS Copper Armoured Electrical Cables',
      qty: '12 Drums',
      vehicle: 'MH-12-KJ-7711',
      driver: 'Sachin Pawar',
      phone: '+91 9922334455',
      challan: 'FIN-902',
      site: 'Wakad Residential Enclave',
      condition: 'In-Transit',
      time: 'ETA Today 04:30 PM',
      status: 'Dispatched from Chakan'
    }
  ]);

  const [toastMessage, setToastMessage] = useState(null);

  const [photoPreview, setPhotoPreview] = useState(null);
  const [checklist, setChecklist] = useState({
    stamp: true,
    count: true,
    unloading: true
  });

  const handleInspectAccept = (id) => {
    setDeliveries(deliveries.map(d => d.id === id ? { ...d, condition: '100% OK', status: 'Verified & Accepted' } : d));
    setToastMessage({
      type: 'success',
      text: 'Physical site inspection completed. GRN receipt verified with 0 defects.'
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleFlagDefect = (id) => {
    setDeliveries(deliveries.map(d => d.id === id ? { ...d, condition: 'Defect Flagged', status: 'Damage Logged' } : d));
    setToastMessage({
      type: 'warning',
      text: 'Quality defect flagged! Notice generated for vendor credit note.'
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSimulatePhotoUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview({
          name: file.name,
          url: reader.result,
          size: '280 KB (WebP Compressed)'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`bento-toast ${toastMessage.type === 'success' ? 'bento-toast-success' : 'bento-toast-warning'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={16} />
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Main Bento Layout: 8-Col Gate Deliveries + 4-Col Side Camera Card */}
      <div className="bento-layout-grid">
        {/* Main Card: Physical Gate Deliveries & Inspection Queue (8 cols) */}
        <div className="bento-col-8 bento-card">
          <div>
            <div className="bento-card-header">
              <div>
                <h2 className="bento-card-title">
                  <span>Physical Gate Deliveries &amp; Inward Queue</span>
                  <span className="bento-badge bento-badge-success">Site Security Verified</span>
                </h2>
                <p className="bento-card-subtitle">
                  Verify vehicle numbers, physical goods count against vendor challan, and log defect photos.
                </p>
              </div>

              <Link to="/deliveries" className="bento-btn bento-btn-secondary bento-btn-sm">
                <span>Record New Receipt</span>
                <ChevronRight size={13} />
              </Link>
            </div>

            {/* Delivery Items Table */}
            <div className="bento-table-wrapper">
              <table className="bento-table">
                <thead>
                  <tr>
                    <th>Vehicle / Driver</th>
                    <th>PO &amp; Challan</th>
                    <th>Material &amp; Site</th>
                    <th>Physical Condition</th>
                    <th style={{ textAlign: 'right' }}>Inspection Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((item) => {
                    const isOk = item.condition === '100% OK';
                    const isDefect = item.condition === 'Defect Flagged';
                    const isPending = item.condition === 'Pending Inspection';

                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Truck size={14} style={{ color: '#64748b' }} />
                            <span>{item.vehicle}</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                            <Phone size={10} style={{ color: '#94a3b8' }} />
                            <span>{item.driver} ({item.phone})</span>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 700, color: '#2563eb' }}>{item.po_no}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                            Challan: <strong style={{ color: '#0f172a' }}>{item.challan}</strong>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.material}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                            Qty: <strong style={{ color: '#0f172a' }}>{item.qty}</strong> • {item.site}
                          </div>
                        </td>

                        <td>
                          {isOk && (
                            <span className="bento-badge bento-badge-success">
                              <CheckCircle2 size={12} />
                              <span>100% Intact</span>
                            </span>
                          )}

                          {isDefect && (
                            <span className="bento-badge bento-badge-danger">
                              <AlertTriangle size={12} />
                              <span>Defect Flagged</span>
                            </span>
                          )}

                          {isPending && (
                            <span className="bento-badge bento-badge-warning">
                              <Clock size={12} />
                              <span>Gate Arrived</span>
                            </span>
                          )}

                          {item.condition === 'In-Transit' && (
                            <span className="bento-badge bento-badge-info">
                              <span>In-Transit</span>
                            </span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => handleInspectAccept(item.id)}
                                className="bento-btn bento-btn-success bento-btn-sm"
                              >
                                <Check size={12} />
                                <span>Accept</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFlagDefect(item.id)}
                                className="bento-btn bento-btn-danger-outline bento-btn-sm"
                              >
                                <span>Defect</span>
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>{item.status}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bento-card-footer">
            <span>Standard Operating Procedure: All receipts require physical stamp &amp; photo upload</span>
            <strong style={{ color: '#334155' }}>Site Supervisor Protocol</strong>
          </div>
        </div>

        {/* Side Card: Challan Camera Photo Upload (4 cols) */}
        <div className="bento-col-4 bento-card">
          <div>
            <div className="bento-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Challan Camera Scan</h3>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Mobile photo with auto-compression</p>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div style={{ marginTop: '1rem' }}>
              <label 
                htmlFor="supervisor-file-upload" 
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '1.25rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: '#f8fafc',
                  transition: 'all 0.2s ease'
                }}
              >
                <input
                  id="supervisor-file-upload"
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleSimulatePhotoUpload}
                />

                {photoPreview ? (
                  <div style={{ width: '100%' }}>
                    <img 
                      src={photoPreview.url} 
                      alt="Uploaded Challan" 
                      style={{ maxHeight: '130px', margin: '0 auto', borderRadius: '8px', objectFit: 'contain', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                    />
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', marginTop: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {photoPreview.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, marginTop: '0.15rem' }}>
                      {photoPreview.size}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                      <Camera size={20} />
                    </div>
                    <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>
                      Snap Delivery Challan Photo
                    </strong>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      Tap to open camera or drop photo (Max 15MB)
                    </div>
                  </>
                )}
              </label>
            </div>

            {/* Verification Checklist */}
            <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                Site Material Verification Checklist
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.75rem', color: '#334155' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checklist.stamp}
                    onChange={(e) => setChecklist({ ...checklist, stamp: e.target.checked })}
                    style={{ accentColor: '#2563eb' }}
                  />
                  <span>Challan stamped &amp; signed by supervisor</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checklist.count}
                    onChange={(e) => setChecklist({ ...checklist, count: e.target.checked })}
                    style={{ accentColor: '#2563eb' }}
                  />
                  <span>Physical bag / piece count verified</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checklist.unloading}
                    onChange={(e) => setChecklist({ ...checklist, unloading: e.target.checked })}
                    style={{ accentColor: '#2563eb' }}
                  />
                  <span>Goods unloaded at assigned site bay</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bento-card-footer">
            <span>Automated GPS site tag appended</span>
            <strong style={{ color: '#059669' }}>Proof Locked</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorView;
