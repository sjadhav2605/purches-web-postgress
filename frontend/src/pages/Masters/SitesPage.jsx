import React, { useState, useEffect } from 'react';
import { masterService } from '../../services/master.service.js';
import { Building2, Plus, Trash2, Search } from 'lucide-react';

export const SitesPage = () => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');

  const fetchSites = async () => {
    setLoading(true);
    try {
      const data = await masterService.getSites(search);
      setSites(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await masterService.createSite({ code, name, address, gstin });
      setShowModal(false);
      setCode('');
      setName('');
      setAddress('');
      setGstin('');
      fetchSites();
      alert('Site added successfully!');
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async (id, siteName) => {
    if (!window.confirm(`Delete ${siteName}?`)) return;
    try {
      await masterService.deleteSite(id);
      fetchSites();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Project Sites Master</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Active construction, office, and commercial project delivery locations.
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} />
          <span>Add Project Site</span>
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Site Code</th>
                <th>Site Name</th>
                <th>Physical Address</th>
                <th>Assigned Staff (Supervisor / PC)</th>
                <th>GSTIN</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Loading sites...</td></tr>
              ) : (
                sites.map((s) => (
                  <tr key={s.id}>
                    <td><strong style={{ color: 'var(--primary-700)' }}>{s.code}</strong></td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.address}</td>
                    <td>
                      <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {s.assigned_supervisors && (
                          <div><span style={{ fontWeight: 600, color: '#e11d48' }}>👷 Sup:</span> {s.assigned_supervisors}</div>
                        )}
                        {s.assigned_pcs && (
                          <div><span style={{ fontWeight: 600, color: '#0284c7' }}>📋 PC:</span> {s.assigned_pcs}</div>
                        )}
                        {!s.assigned_supervisors && !s.assigned_pcs && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None assigned</span>
                        )}
                      </div>
                    </td>
                    <td>{s.gstin || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleDelete(s.id, s.name)} className="btn btn-danger btn-sm">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', margin: 0, boxShadow: 'var(--shadow-xl)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', color: 'var(--text-main)' }}>Add Project Site</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Site Code (Short Name) *</label>
                <input type="text" required placeholder="e.g. INFO-SDB7" className="form-control" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Full Site Name *</label>
                <input type="text" required placeholder="e.g. Infosys Phase-II SDB 7" className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Complete Site Delivery Address *</label>
                <textarea rows="2" required placeholder="Full physical street address..." className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Site GSTIN (Optional)</label>
                <input type="text" placeholder="27AAECD7921Q1Z2" className="form-control" value={gstin} onChange={(e) => setGstin(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Site</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
