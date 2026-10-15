import React, { useState, useEffect } from 'react';
import { auditService } from '../../services/audit.service.js';
import { History, Search, ShieldCheck, User } from 'lucide-react';

export const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await auditService.getAuditLogs();
      setLogs(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      (l.actor_email && l.actor_email.toLowerCase().includes(q)) ||
      (l.entity_type && l.entity_type.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>System Audit Trail</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Immutable activity log tracking request approvals, bid selections, and PO issuances.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '300px', width: '100%' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search audit trail..."
              className="form-control"
              style={{ paddingLeft: '2.25rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
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
                <th>Timestamp</th>
                <th>Actor / User</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Record ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <History size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600 }}>No audit logs recorded</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Actions performed by users will appear here automatically.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {new Date(l.created_at).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(l.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <User size={14} style={{ color: 'var(--primary-600)' }} />
                        {l.actor_email || `User #${l.user_id}`}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-draft">{l.entity_type}</span>
                    </td>
                    <td>
                      <strong style={{ color: l.action === 'CREATE' ? 'var(--primary-600)' : l.action === 'APPROVE' || l.action === 'AWARD' ? 'var(--success-text)' : 'var(--text-main)' }}>
                        {l.action}
                      </strong>
                    </td>
                    <td>
                      <code>#{l.entity_id}</code>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '300px', wordBreak: 'break-word' }}>
                      {typeof l.details === 'object' ? JSON.stringify(l.details) : l.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
