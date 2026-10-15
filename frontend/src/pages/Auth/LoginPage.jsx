import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedUser = await login(email, password);
      if (loggedUser?.role === 'vendor') {
        navigate('/vendor-portal');
      } else if (loggedUser?.role === 'accounts') {
        navigate('/payments');
      } else {
        navigate('/requisitions');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillRoleCredentials = (roleEmail) => {
    setEmail(roleEmail);
    setPassword('Admin@123');
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: '440px' }}>
        <div className="login-header">
          <div className="logo-badge" style={{ margin: '0 auto', width: '48px', height: '48px', fontSize: '1.4rem' }}>
            D
          </div>
          <h1>DDPL Portal</h1>
          <p>Decent Decor Pvt. Ltd — Procurement System</p>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-bg)',
            color: 'var(--danger-text)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                className="form-control"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
              <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}
          >
            <span>{submitting ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="demo-credentials" style={{ marginTop: '1.5rem', background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-md)', padding: '0.9rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-700)', marginBottom: '0.5rem' }}>
            💡 Quick Demo Login (Click to Autofill):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => fillRoleCredentials('admin@ddpl.com')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem' }}
            >
              👑 Administrator
            </button>
            <button
              type="button"
              onClick={() => fillRoleCredentials('supervisor@ddpl.com')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem' }}
            >
              👷 Site Supervisor
            </button>
            <button
              type="button"
              onClick={() => fillRoleCredentials('pc@ddpl.com')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem' }}
            >
              📋 Project Coord.
            </button>
            <button
              type="button"
              onClick={() => fillRoleCredentials('purchase@ddpl.com')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem' }}
            >
              🛒 Purchase Dept
            </button>
            <button
              type="button"
              onClick={() => fillRoleCredentials('director1@ddpl.com')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem' }}
            >
              🏛️ Director 1
            </button>
            <button
              type="button"
              onClick={() => fillRoleCredentials('director2@ddpl.com')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem' }}
            >
              🏛️ Director 2
            </button>
            <button
              type="button"
              onClick={() => fillRoleCredentials('director3@ddpl.com')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem' }}
            >
              🏛️ Director 3
            </button>
            <button
              type="button"
              onClick={() => fillRoleCredentials('accounts@ddpl.com')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem' }}
            >
              💳 Accounts
            </button>
            <button
              type="button"
              onClick={() => fillRoleCredentials('vendor@ddpl.com')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem', gridColumn: 'span 2' }}
            >
              🏪 Vendor Portal
            </button>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
            Password for all accounts: <code>Admin@123</code> (or <code>admin@123</code>)
          </div>
        </div>
      </div>
    </div>
  );
};
