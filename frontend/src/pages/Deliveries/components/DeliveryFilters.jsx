import React from 'react';
import { Truck, Receipt, Plus, Search, Filter } from 'lucide-react';

export const DeliveryFilters = ({
  activeMainTab = 'site-receipts',
  onTabChange,
  totalReceipts = 0,
  canRecordReceipt = false,
  onOpenRecordModal,
  searchQuery = '',
  onSearchChange,
  selectedSite = '',
  onSiteChange,
  sites = [],
  filterCondition = 'all',
  onConditionChange
}) => {
  return (
    <div>
      {/* Page Title & Main Action Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Deliveries & Challans</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Site supervisor material receipts, physical verification proofs, and vendor commercial billed challans.
          </p>
        </div>

        {activeMainTab === 'site-receipts' && canRecordReceipt && (
          <button 
            type="button"
            onClick={onOpenRecordModal} 
            className="btn btn-primary"
            style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={18} />
            <span>Record Site Material Receipt</span>
          </button>
        )}
      </div>

      {/* Main Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onTabChange('site-receipts')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: activeMainTab === 'site-receipts' ? '#2563eb' : '#f1f5f9',
            color: activeMainTab === 'site-receipts' ? '#ffffff' : '#475569',
            boxShadow: activeMainTab === 'site-receipts' ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
          }}
        >
          <Truck size={17} />
          <span>1. Site Delivery Receipts & Inspections ({totalReceipts})</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('vendor-challans')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: activeMainTab === 'vendor-challans' ? '#2563eb' : '#f1f5f9',
            color: activeMainTab === 'vendor-challans' ? '#ffffff' : '#475569',
            boxShadow: activeMainTab === 'vendor-challans' ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
          }}
        >
          <Receipt size={17} />
          <span>2. Vendor Billed Challans (Commercial & Taxes)</span>
        </button>
      </div>

      {/* Search & Secondary Filter Bar (Active on site-receipts tab) */}
      {activeMainTab === 'site-receipts' && (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search PO#, Challan#, Supplier, or Site..."
                className="form-control"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="form-control"
                value={selectedSite}
                onChange={(e) => onSiteChange(e.target.value)}
                style={{ fontSize: '0.85rem', width: 'auto', minWidth: '160px' }}
              >
                <option value="">All Project Sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>

              <select
                className="form-control"
                value={filterCondition}
                onChange={(e) => onConditionChange(e.target.value)}
                style={{ fontSize: '0.85rem', width: 'auto' }}
              >
                <option value="all">All Conditions</option>
                <option value="intact">✓ 100% Intact Only</option>
                <option value="damaged">⚠️ Defects / Damaged Only</option>
              </select>
            </div>
          </div>

          {/* Workflow Explainer Banner */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', flexShrink: 0 }}>
                <Truck size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                  Incoming Shipments & Scheduled Deliveries Workflow:
                </strong>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                  1. PO Approved & Issued ➔ 2. Click <strong>Share Link</strong> to send dispatch portal to Vendor ➔ 3. Vendor fills <strong>Expected Arrival Date & Challan</strong> ➔ 4. Site Supervisor verifies receipt below.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DeliveryFilters;
