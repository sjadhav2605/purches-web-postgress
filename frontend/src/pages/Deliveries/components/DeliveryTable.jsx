import React from 'react';
import { 
  Truck, 
  Calendar, 
  Share2, 
  Receipt, 
  Download, 
  Eye, 
  Edit2, 
  Plus 
} from 'lucide-react';
import { formatWorkflowDate, handleDownloadAllPhotos, handleDownloadPhoto, formatCurrency } from '@/utils';

export const DeliveryTable = ({
  deliveries = [],
  loading = false,
  pos = [],
  billedChallans = [],
  canUploadBill = false,
  copiedLinkPoId = null,
  onOpenReceiptForPo,
  onSharePo,
  onOpenUploadBill,
  onViewBill,
  onOpenPhotoGallery,
  onOpenVendorNotice,
  searchQuery = '',
  selectedSite = '',
  filterCondition = 'all'
}) => {
  // Filter incoming/active POs
  const activeIncomingPos = pos.filter((p) => {
    const isPending = ['Dispatched', 'Acknowledged', 'Issued'].includes(p.status);
    if (!isPending) return false;
    if (selectedSite && String(p.site_id) !== String(selectedSite)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchPo = (p.po_no || '').toLowerCase().includes(q);
      const matchVendor = (p.vendor_name || '').toLowerCase().includes(q);
      const matchSite = (p.site_code || '').toLowerCase().includes(q) || (p.site_name || '').toLowerCase().includes(q);
      const matchChallan = (p.invoice_no || '').toLowerCase().includes(q);
      if (!matchPo && !matchVendor && !matchSite && !matchChallan) return false;
    }
    return true;
  });

  // Filter verified deliveries
  const filteredDeliveries = deliveries.filter((del) => {
    if (selectedSite && String(del.site_id) !== String(selectedSite)) return false;
    
    const damagedItems = Array.isArray(del.damaged_items) ? del.damaged_items : [];
    const dmgPhotos = Array.isArray(del.damage_photos) ? del.damage_photos : [];
    const hasDamage = damagedItems.reduce((acc, it) => acc + (Number(it.damaged_qty) || 0), 0) > 0 || dmgPhotos.length > 0;

    if (filterCondition === 'intact' && hasDamage) return false;
    if (filterCondition === 'damaged' && !hasDamage) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchPo = (del.po_no || '').toLowerCase().includes(q);
      const matchChallan = (del.challan_no || '').toLowerCase().includes(q);
      const matchVendor = (del.vendor_name || '').toLowerCase().includes(q);
      const matchSite = (del.site_code || '').toLowerCase().includes(q) || (del.site_name || '').toLowerCase().includes(q);
      if (!matchPo && !matchChallan && !matchVendor && !matchSite) return false;
    }
    return true;
  });

  return (
    <>
      {/* 1. Incoming & In-Transit Deliveries Section */}
      <div className="card" style={{ marginBottom: '1.75rem', border: '1px solid #bfdbfe', background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#1e3a8a' }}>
              <Truck size={20} style={{ color: '#0284c7' }} />
              <span>Incoming Shipments & Scheduled Deliveries</span>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                {activeIncomingPos.length} Active
              </span>
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Shipments dispatched or scheduled by vendors with expected arrival dates at project site.
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ background: '#ffffff', borderRadius: 'var(--radius-sm)' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th>PO Number</th>
                <th>Supplier / Vendor</th>
                <th>Project Site</th>
                <th>Expected Delivery Date</th>
                <th>Vendor Challan</th>
                <th>Dispatch Info</th>
                <th>Delivery Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeIncomingPos.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No incoming or dispatched shipments right now.
                  </td>
                </tr>
              ) : (
                activeIncomingPos.map((p) => {
                  const isDispatched = p.status === 'Dispatched';
                  return (
                    <tr key={p.id} style={{ background: isDispatched ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}>
                      <td>
                        <strong style={{ color: 'var(--primary-700)' }}>{p.po_no}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          PR: {p.pr_no || '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.vendor_name}</div>
                        {p.vendor_phone && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📞 {p.vendor_phone}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.site_code}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.site_name}</div>
                      </td>
                      <td>
                        {p.expected_delivery_date ? (
                          <span 
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              background: '#ecfdf5', 
                              color: '#047857', 
                              border: '1px solid #a7f3d0', 
                              padding: '0.3rem 0.6rem', 
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              fontSize: '0.85rem'
                            }}
                          >
                            <Calendar size={13} />
                            <span>{new Date(p.expected_delivery_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Awaiting Dispatch
                          </span>
                        )}
                      </td>
                      <td>
                        {p.invoice_no ? (
                          <span className="badge badge-draft" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {p.invoice_no}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>
                          {p.dispatch_date && (
                            <div>Dispatched: {new Date(p.dispatch_date).toLocaleDateString()}</div>
                          )}
                          {p.dispatch_notes && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                              🚚 {p.dispatch_notes}
                            </div>
                          )}
                          {!p.dispatch_date && !p.dispatch_notes && '—'}
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${p.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                          {isDispatched ? '🚚 Dispatched / In Transit' : p.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => onSharePo(p)}
                            className="btn btn-secondary btn-sm"
                            title="Share Delivery Schedule Link with Vendor"
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.3rem',
                              fontSize: '0.78rem',
                              padding: '0.35rem 0.6rem',
                              color: '#1d4ed8',
                              borderColor: '#bfdbfe'
                            }}
                          >
                            <Share2 size={13} />
                            <span>{copiedLinkPoId === p.id ? 'Copied!' : 'Share Link'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenReceiptForPo(p)}
                            className="btn btn-primary btn-sm"
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              padding: '0.35rem 0.7rem'
                            }}
                          >
                            <Truck size={14} />
                            <span>Verify Receipt</span>
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
      </div>

      {/* 2. Recorded Site Material Receipts Section */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
          Verified Site Receipts & Physical Challans
        </h4>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {filteredDeliveries.length} {filteredDeliveries.length === 1 ? 'Record' : 'Records'}
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Challan No</th>
                <th>Project Site</th>
                <th>Supplier / Vendor</th>
                <th>Receipt Date</th>
                <th>Photos & Proof</th>
                <th>Commercial Billed Challan</th>
                <th>Condition</th>
                <th>Recorded By</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading deliveries...
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '3.5rem' }}>
                    <Truck size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600 }}>No site deliveries found</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Try adjusting your search filters or record a new receipt.</p>
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((del) => {
                  const chPhotos = Array.isArray(del.challan_photos) ? del.challan_photos : [];
                  const matPhotos = Array.isArray(del.material_photos) ? del.material_photos : [];
                  const dmgPhotos = Array.isArray(del.damage_photos) ? del.damage_photos : [];
                  const damagedItems = Array.isArray(del.damaged_items) ? del.damaged_items : [];
                  const totalDamagedPcs = damagedItems.reduce((acc, it) => acc + (Number(it.damaged_qty) || 0), 0);
                  const hasDamage = totalDamagedPcs > 0 || dmgPhotos.length > 0;
                  const linkedBill = billedChallans.find(b => String(b.po_id) === String(del.po_id) || (del.po_no && b.po_no === del.po_no));

                  return (
                    <tr key={del.id}>
                      <td><strong style={{ color: 'var(--primary-700)' }}>{del.po_no}</strong></td>
                      <td>
                        <span className="badge badge-verified" style={{ fontWeight: 600 }}>
                          {del.challan_no || 'VERIFIED'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{del.site_code}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{del.site_name}</div>
                      </td>
                      <td>{del.vendor_name}</td>
                      <td>{formatWorkflowDate(del.received_date)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {chPhotos.length > 0 && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: '#eff6ff', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                              <button
                                type="button"
                                onClick={() => onOpenPhotoGallery({ title: `📄 Delivery Challan Photos (${chPhotos.length})`, po_no: del.po_no, challan_no: del.challan_no, photos: chPhotos })}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', border: 'none', background: 'transparent' }}
                                title="View Challan Photos"
                              >
                                <span>📄 Challan ({chPhotos.length})</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadAllPhotos(chPhotos, `Challan_${del.challan_no || del.po_no || 'doc'}`);
                                }}
                                style={{
                                  background: '#2563eb',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  padding: '0.15rem 0.35rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 600
                                }}
                                title="Download Challan Document"
                              >
                                <Download size={11} />
                                <span>Save</span>
                              </button>
                            </div>
                          )}
                          {matPhotos.length > 0 && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: '#f0fdf4', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                              <button
                                type="button"
                                onClick={() => onOpenPhotoGallery({ title: `📷 Received Material Photos (${matPhotos.length})`, po_no: del.po_no, challan_no: del.challan_no, photos: matPhotos })}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', border: 'none', background: 'transparent' }}
                                title="View Goods Photos"
                              >
                                <span>📷 Goods ({matPhotos.length})</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadAllPhotos(matPhotos, `Goods_${del.challan_no || del.po_no || 'doc'}`);
                                }}
                                style={{
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  padding: '0.15rem 0.35rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 600
                                }}
                                title="Download Goods Material Photos"
                              >
                                <Download size={11} />
                                <span>Save</span>
                              </button>
                            </div>
                          )}
                          {dmgPhotos.length > 0 && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: '#fef2f2', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid #fecaca' }}>
                              <button
                                type="button"
                                onClick={() => onOpenPhotoGallery({ title: `⚠️ Defective/Damage Photos (${dmgPhotos.length})`, po_no: del.po_no, challan_no: del.challan_no, photos: dmgPhotos })}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', border: 'none', background: 'transparent', color: '#b91c1c' }}
                                title="View Damage Photos"
                              >
                                <span>⚠️ Damage ({dmgPhotos.length})</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadAllPhotos(dmgPhotos, `Damage_${del.challan_no || del.po_no || 'doc'}`);
                                }}
                                style={{
                                  background: '#dc2626',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  padding: '0.15rem 0.35rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 600
                                }}
                                title="Download Damage Photos"
                              >
                                <Download size={11} />
                                <span>Save</span>
                              </button>
                            </div>
                          )}
                          {chPhotos.length === 0 && matPhotos.length === 0 && dmgPhotos.length === 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </div>
                      </td>
                      {/* Commercial Billed Challan Column */}
                      <td>
                        {linkedBill ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <span
                                className="badge"
                                style={{
                                  background: '#f5f3ff',
                                  color: '#6d28d9',
                                  border: '1px solid #ddd6fe',
                                  fontWeight: 700,
                                  fontSize: '0.74rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                                title={`Billed Challan: ${linkedBill.challan_no}`}
                              >
                                <Receipt size={11} />
                                <span>{linkedBill.challan_no}</span>
                              </span>
                              <strong style={{ fontSize: '0.78rem', color: '#047857' }}>
                                {formatCurrency(linkedBill.total_amount)}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginTop: '0.1rem' }}>
                              {linkedBill.document_file && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onViewBill(linkedBill)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                    title="View Commercial Bill"
                                  >
                                    <Eye size={11} />
                                    <span>View</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadPhoto({ dataUrl: linkedBill.document_file, name: linkedBill.document_name }, `Bill_${linkedBill.challan_no}`)}
                                    style={{
                                      background: '#7c3aed',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '3px',
                                      padding: '0.15rem 0.35rem',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      fontSize: '0.7rem',
                                      fontWeight: 600
                                    }}
                                    title="Download Commercial Bill / Tax Invoice"
                                  >
                                    <Download size={11} />
                                    <span>Save</span>
                                  </button>
                                </>
                              )}
                              {canUploadBill && (
                                <button
                                  type="button"
                                  onClick={() => onOpenUploadBill(del, linkedBill)}
                                  className="btn btn-outline btn-sm"
                                  style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem', color: '#6d28d9', borderColor: '#ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                  title="Edit / Replace Commercial Bill"
                                >
                                  <Edit2 size={10} />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : canUploadBill ? (
                          <button
                            type="button"
                            onClick={() => onOpenUploadBill(del)}
                            className="btn btn-sm"
                            style={{
                              background: '#f8fafc',
                              color: '#2563eb',
                              border: '1px dashed #93c5fd',
                              borderRadius: '6px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Upload Vendor Commercial Billed Challan / Tax Invoice"
                          >
                            <Plus size={12} />
                            <span>+ Upload Final Bill</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Pending Bill
                          </span>
                        )}
                      </td>
                      <td>
                        {hasDamage ? (
                          <span className="badge badge-rejected" style={{ fontSize: '0.72rem', fontWeight: 700 }} title={del.damage_remarks || 'Defects reported'}>
                            ⚠️ {totalDamagedPcs > 0 ? `${totalDamagedPcs} Damaged Pcs` : 'Defect Photos'}
                          </span>
                        ) : (
                          <span className="badge badge-approved" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                            ✓ 100% Intact
                          </span>
                        )}
                      </td>
                      <td>{del.recorded_by_name}</td>
                      <td>
                        <span className="badge badge-approved" style={{ fontSize: '0.75rem' }}>
                          Site Verified
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => onOpenVendorNotice(del)}
                          className="btn btn-secondary btn-sm"
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '0.25rem 0.55rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            color: '#15803d',
                            borderColor: '#86efac',
                            background: '#f0fdf4'
                          }}
                          title="Open WhatsApp / Email notification for Vendor"
                        >
                          <span>💬 Notice to Vendor</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default DeliveryTable;
