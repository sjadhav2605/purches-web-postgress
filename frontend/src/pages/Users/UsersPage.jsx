import React, { useState, useEffect } from 'react';
import { userService } from '../../services/user.service.js';
import { masterService } from '../../services/master.service.js';
import { Users as UsersIcon, Shield, Building2, UserCheck, AlertCircle, Plus, X, Lock, Mail, Phone, UserPlus, Pencil, Check } from 'lucide-react';

// Same rules as the backend (user.routes.js updateUserSchema)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s\-()]{6,19}$/;
const validateUserDetails = ({ name, email, phone }) => {
  const errs = {};
  if (!name.trim()) errs.name = 'Name is required';
  else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
  if (!email.trim()) errs.email = 'Email is required';
  else if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address';
  if (phone.trim() && !PHONE_RE.test(phone.trim())) errs.phone = 'Enter a valid phone number (7-20 digits)';
  return errs;
};

export const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sites, setSites] = useState([]);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('supervisor');
  const [defaultSiteId, setDefaultSiteId] = useState('');
  const [password, setPassword] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);

  const fetchUsersAndSites = async () => {
    setLoading(true);
    try {
      const [usersData, sitesData] = await Promise.all([
        userService.getUsers(),
        masterService.getSites()
      ]);
      setUsers(usersData || []);
      setSites(sitesData || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndSites();
  }, []);

  // Inline user-details editing (one row at a time)
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' });
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (u) => {
    // Starting another row's edit discards any unsaved edit in progress (same as Cancel)
    setEditingId(u.id);
    setDraft({ name: u.name || '', email: u.email || '', phone: u.phone || '' });
    setEditErrors({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditErrors({});
  };

  const updateDraft = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setEditErrors((er) => ({ ...er, [field]: undefined, form: undefined }));
  };

  const saveEdit = async (u) => {
    if (savingEdit) return;
    const errs = validateUserDetails(draft);
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    const payload = { name: draft.name.trim(), email: draft.email.trim().toLowerCase(), phone: draft.phone.trim() };
    setSavingEdit(true);
    try {
      const updated = await userService.updateUser(u.id, payload);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
      setEditingId(null);
      setEditErrors({});
    } catch (e) {
      const first = Array.isArray(e.errors) && e.errors[0];
      if (first && first.field && ['name', 'email', 'phone'].includes(first.field)) {
        setEditErrors({ [first.field]: first.message });
      } else {
        setEditErrors({ form: e.message || 'Failed to update user' });
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEditKeyDown = (e, u) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(u); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await userService.updateUser(userId, { role: newRole });
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      alert('User role updated successfully');
    } catch (e) {
      alert(e.message);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await userService.updateUser(userId, { status: nextStatus });
      setUsers(users.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSiteAssign = async (userId, siteId) => {
    try {
      await userService.updateUser(userId, { default_site_id: siteId ? Number(siteId) : null });
      fetchUsersAndSites();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert('Full Name and Email are required.');
      return;
    }
    if (password.trim().length < 8) {
      alert('Initial password is required (minimum 8 characters).');
      return;
    }

    setSubmittingUser(true);
    try {
      await userService.createUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role,
        default_site_id: defaultSiteId ? Number(defaultSiteId) : null,
        password: password.trim()
      });
      alert(`User ${name.trim()} (${role.toUpperCase()}) created successfully!`);
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setRole('supervisor');
      setDefaultSiteId('');
      setPassword('');
      fetchUsersAndSites();
    } catch (err) {
      alert(err.message || 'Failed to create user');
    } finally {
      setSubmittingUser(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Users & Access Control</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Manage staff roles (Admin, Purchase, Director, Accounts, Supervisor), assigned sites, and account status.
          </p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)} 
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
        >
          <UserPlus size={18} />
          <span>Add User / Supervisor</span>
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Assigned Project Site</th>
                <th>Status</th>
                <th>Created Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <UsersIcon size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600 }}>No users found</div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {editingId === u.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '220px' }}>
                          {[
                            { field: 'name', type: 'text', placeholder: 'Full name', label: 'Name' },
                            { field: 'email', type: 'email', placeholder: 'Email address', label: 'Email' },
                            { field: 'phone', type: 'tel', placeholder: 'Phone number (optional)', label: 'Phone' }
                          ].map(({ field, type, placeholder, label }) => (
                            <div key={field}>
                              <input
                                type={type}
                                className="form-control"
                                aria-label={label}
                                placeholder={placeholder}
                                value={draft[field]}
                                autoFocus={field === 'name'}
                                disabled={savingEdit}
                                onChange={(e) => updateDraft(field, e.target.value)}
                                onKeyDown={(e) => handleEditKeyDown(e, u)}
                                style={{
                                  padding: '0.3rem 0.5rem',
                                  fontSize: '0.85rem',
                                  fontWeight: field === 'name' ? 600 : 400,
                                  borderColor: editErrors[field] ? 'var(--danger-text, #dc2626)' : undefined
                                }}
                              />
                              {editErrors[field] && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--danger-text, #dc2626)', marginTop: '0.15rem' }}>
                                  {editErrors[field]}
                                </div>
                              )}
                            </div>
                          ))}
                          {editErrors.form && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--danger-text, #dc2626)' }}>{editErrors.form}</div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                          {u.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📞 {u.phone}</div>}
                        </>
                      )}
                    </td>
                    <td>
                      <select
                        className="form-control"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '135px', fontWeight: 600 }}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="admin">Administrator</option>
                        <option value="supervisor">Site Supervisor</option>
                        <option value="pc">Project Coordinator</option>
                        <option value="purchase">Purchase Manager</option>
                        <option value="director">Director</option>
                        <option value="accounts">Senior Accounts</option>
                        <option value="vendor">Vendor / Supplier</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <select
                          className="form-control"
                          style={{ 
                            padding: '0.35rem 0.5rem', 
                            fontSize: '0.85rem', 
                            width: '210px',
                            borderColor: u.default_site_id ? 'var(--primary-400)' : 'var(--border-color)',
                            background: u.default_site_id ? '#f0fdf4' : '#ffffff',
                            fontWeight: u.default_site_id ? 600 : 400
                          }}
                          value={u.default_site_id || ''}
                          onChange={(e) => handleSiteAssign(u.id, e.target.value)}
                        >
                          <option value="">All Sites / Global Access</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>
                              📍 {s.code} - {s.name}
                            </option>
                          ))}
                        </select>
                        {u.default_site_id && (
                          <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                            ✓ Scoped to this project site
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-approved' : 'badge-rejected'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'flex-start', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {editingId === u.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(u)}
                              disabled={savingEdit}
                              className="btn btn-sm btn-primary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <Check size={14} />
                              <span>{savingEdit ? 'Saving...' : 'Save'}</span>
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={savingEdit}
                              className="btn btn-sm btn-secondary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <X size={14} />
                              <span>Cancel</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(u)}
                            className="btn btn-sm btn-secondary"
                            title="Edit name, email and phone"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Pencil size={14} />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleStatusToggle(u.id, u.status)}
                          disabled={editingId === u.id}
                          className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User / Supervisor Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <button 
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'var(--primary-100)', color: 'var(--primary-700)', padding: '0.5rem', borderRadius: '8px' }}>
                <UserPlus size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Add New User / Staff</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Create Site Supervisor, Project Coordinator, or Department account with assigned site
                </p>
              </div>
            </div>

            <form onSubmit={handleAddUserSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Site Supervisor Ramesh"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      className="form-control"
                      placeholder="e.g. ramesh@ddpl.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>User Role *</label>
                    <select
                      className="form-control"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      style={{ fontWeight: 600 }}
                    >
                      <option value="supervisor">Site Supervisor</option>
                      <option value="pc">Project Coordinator</option>
                      <option value="purchase">Purchase Manager</option>
                      <option value="director">Director</option>
                      <option value="accounts">Accounts</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Initial Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Assign Project Site (Mandatory for Supervisor/PC)
                  </label>
                  <select
                    className="form-control"
                    value={defaultSiteId}
                    onChange={(e) => setDefaultSiteId(e.target.value)}
                    style={{ borderColor: 'var(--primary-400)', background: '#f8fafc' }}
                  >
                    <option value="">-- Select Project Site to Assign --</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        📍 {s.code} - {s.name} ({s.address || 'Pune'})
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    The supervisor or coordinator will only have access to view and create requests for this assigned site.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn btn-secondary"
                    disabled={submittingUser}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingUser}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  >
                    <UserPlus size={16} />
                    <span>{submittingUser ? 'Adding User...' : 'Add User & Assign Site'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
