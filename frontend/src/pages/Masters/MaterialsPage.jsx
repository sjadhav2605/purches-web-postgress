import React, { useState, useEffect } from 'react';
import { masterService } from '../../services/master.service.js';
import { Package, Plus, Trash2, Search } from 'lucide-react';

export const MaterialsPage = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Civil / Structural');
  const [unit, setUnit] = useState('Bag');
  const [refRate, setRefRate] = useState(400);
  const [spec, setSpec] = useState('');

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const data = await masterService.getMaterials(search);
      setMaterials(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await masterService.createMaterial({
        description,
        category,
        unit,
        ref_rate: Number(refRate),
        spec
      });
      setShowModal(false);
      setDescription('');
      fetchMaterials();
      alert('Material added to master list!');
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await masterService.deleteMaterial(id);
      fetchMaterials();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Materials Master</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Standard construction and finishing materials catalogue with reference rates.
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} />
          <span>Add Material</span>
        </button>
      </div>

      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
        <form onSubmit={(e) => { e.preventDefault(); fetchMaterials(); }} style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search material description or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Specification</th>
                <th>Ref. Rate (₹)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Loading materials...</td></tr>
              ) : materials.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>No materials found.</td></tr>
              ) : (
                materials.map((m) => (
                  <tr key={m.id}>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{m.description}</strong></td>
                    <td><span className="badge badge-draft">{m.category}</span></td>
                    <td>{m.unit}</td>
                    <td>{m.spec || '—'}</td>
                    <td>₹{Number(m.ref_rate).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleDelete(m.id, m.description)} className="btn btn-danger btn-sm">
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
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', color: 'var(--text-main)' }}>Add Material to Master</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Material Description *</label>
                <input type="text" required placeholder="e.g. River Sand" className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Civil / Structural">Civil / Structural</option>
                  <option value="Plaster & Masonry">Plaster & Masonry</option>
                  <option value="Paint & Finishing">Paint & Finishing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Plumbing">Plumbing</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Unit *</label>
                  <select className="form-control" value={unit} onChange={(e) => setUnit(e.target.value)}>
                    <option value="Bag">Bag</option>
                    <option value="Brass">Brass</option>
                    <option value="Kg">Kg</option>
                    <option value="Liter">Liter</option>
                    <option value="Box">Box</option>
                    <option value="Nos">Nos</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ref Rate (₹)</label>
                  <input type="number" step="0.01" className="form-control" value={refRate} onChange={(e) => setRefRate(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Specification</label>
                <input type="text" placeholder="e.g. IS 12269 standard" className="form-control" value={spec} onChange={(e) => setSpec(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Material</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
