import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { poService } from '../../services/po.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  AlertCircle,
  Send,
  CreditCard
} from 'lucide-react';

export const PurchaseOrderListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || '';

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [error, setError] = useState('');

  const { user, activeRole } = useAuth();
  const navigate = useNavigate();

  const fetchOrders = async (page = 1, filter = urlStatus) => {
    setLoading(true);
    setError('');
    try {
      const data = await poService.getPOs({
        page,
        limit: 10,
        search: search.trim(),
        status: filter
      });
      setOrders(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  // Immediate sync when URL query param changes
  useEffect(() => {
    setStatusFilter(urlStatus);
    fetchOrders(1, urlStatus);
  }, [urlStatus]);

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    if (val) {
      setSearchParams({ status: val });
    } else {
      setSearchParams({});
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders(1);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved': return <span className="badge badge-warning" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>Approved (Pending Issue)</span>;
      case 'Issued': return <span className="badge badge-raised">Issued</span>;
      case 'Acknowledged': return <span className="badge badge-issued">Acknowledged</span>;
      case 'Dispatched': return <span className="badge badge-draft">Dispatched</span>;
      case 'Partially Received': return <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>Partially Received</span>;
      case 'Site Verified': return <span className="badge badge-verified">Site Verified</span>;
      case 'Cancelled': return <span className="badge badge-rejected">Cancelled</span>;
      default: return <span className="badge badge-draft">{status}</span>;
    }
  };

  return (
    <div>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Purchase Orders (PO)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Official purchase orders issued to vendors with GST, terms, and delivery tracking.
          </p>
        </div>

        {['admin', 'purchase'].includes(activeRole || user?.role) && (
          <Link to="/orders/new" className="btn btn-primary">
            <Plus size={18} />
            <span>Generate New PO</span>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by PO No, Vendor, Site, or Invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <div style={{ width: '220px' }}>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Approved">Approved (Pending Issue)</option>
              <option value="Issued">Issued</option>
              <option value="Acknowledged">Acknowledged</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Partially Received">Partially Received</option>
              <option value="Site Verified">Site Verified</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            <span>Filter</span>
          </button>
        </form>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Request</th>
                <th>Vendor</th>
                <th>Project Site</th>
                <th>Total (inc. GST)</th>
                <th>Payment Terms</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Loading purchase orders...</div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <ShoppingCart size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No purchase orders found</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Generate a new PO from an approved request.</p>
                  </td>
                </tr>
              ) : (
                orders.map((po) => {
                  let terms = {};
                  try {
                    terms = typeof po.payment_terms === 'string' ? JSON.parse(po.payment_terms || '{}') : (po.payment_terms || {});
                  } catch {
                    terms = {};
                  }
                  const advPct = Number(terms.advance_pct || 0);
                  const credDays = Number(terms.credit_days || 0);

                  return (
                    <tr key={po.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary-600)' }}>{po.po_no}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{po.pr_no}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{po.vendor_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GSTIN: {po.vendor_gstin || 'Unregistered'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{po.site_code}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹{Number(po.total_amount).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: advPct > 0 ? '#1e40af' : 'var(--text-secondary)' }}>
                          Advance: <strong>{advPct}%</strong>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Credit: <strong>{credDays}d</strong>
                        </div>
                      </td>
                      <td>{getStatusBadge(po.status)}</td>
                      <td>{new Date(po.created_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {po.status === 'Approved' && ['purchase', 'admin'].includes(activeRole || user?.role) && (
                            <button
                              onClick={() => navigate(`/orders/${po.id}`)}
                              className="btn btn-primary btn-sm"
                              style={{ 
                                background: '#10b981', 
                                border: 'none', 
                                color: '#fff', 
                                fontWeight: 600, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.3rem' 
                              }}
                              title="Review and Issue PO to Vendor"
                            >
                              <Send size={13} />
                              <span>Issue PO</span>
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/payments?po_id=${po.id}`)}
                            className="btn btn-secondary btn-sm"
                            title="View / Record Payments for this PO"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <CreditCard size={14} />
                            <span>Payment</span>
                          </button>
                          <button
                            onClick={() => navigate(`/orders/${po.id}`)}
                            className="btn btn-secondary btn-sm"
                            title="View PO Details"
                          >
                            <Eye size={15} />
                            <span>View</span>
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

        {/* Pagination Bar */}
        {!loading && pagination.totalPages > 1 && (
          <div className="pagination" style={{ padding: '1rem 1.5rem', margin: 0 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalItems} total POs)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={pagination.currentPage <= 1}
                onClick={() => fetchOrders(pagination.currentPage - 1)}
                className="btn btn-secondary btn-sm"
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <button
                disabled={pagination.currentPage >= pagination.totalPages}
                onClick={() => fetchOrders(pagination.currentPage + 1)}
                className="btn btn-secondary btn-sm"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
