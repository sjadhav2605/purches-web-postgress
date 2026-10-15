import React from 'react';
import { Receipt, DollarSign, Upload, FileText, Download, ExternalLink } from 'lucide-react';
import { formatWorkflowDate, handleDownloadPhoto, processBillFile } from '@/utils';

export const DeliveryBillModal = ({
  // Upload/Edit Modal Props
  uploadModal = null,
  onCloseUpload,
  onSubmitBill,
  billSubmitting = false,
  formChallanNo = '',
  onChallanNoChange,
  formDate = '',
  onDateChange,
  formVehicleNo = '',
  onVehicleNoChange,
  formBasic = '',
  onBasicChange,
  formFreight = '',
  onFreightChange,
  formLoading = '',
  onLoadingChange,
  formPack = '',
  onPackChange,
  formOther = '',
  onOtherChange,
  formGstPct = '18',
  onGstPctChange,
  formNotes = '',
  onNotesChange,
  formDoc = null,
  onDocChange,
  billSubtotal = 0,
  billGstAmount = 0,
  billGrandTotal = 0,

  // View Modal Props
  viewModal = null,
  onCloseView,
  onPreviewPhoto
}) => {
  return (
    <>
      {/* Upload / Edit Commercial Billed Challan Modal */}
      {uploadModal && (
        <div className="modal-backdrop" onClick={onCloseUpload} style={{ zIndex: 1250 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#1e293b' }}>
                  <Receipt size={20} color="#7c3aed" />
                  <span>{uploadModal.existingBill ? 'Edit Commercial Billed Challan' : 'Upload Commercial Billed Challan'}</span>
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  PO: <strong style={{ color: '#2563eb' }}>{uploadModal.po_no}</strong> • Vendor: <strong>{uploadModal.vendor_name}</strong>
                </span>
              </div>
              <button onClick={onCloseUpload} className="close-btn">✕</button>
            </div>

            <form onSubmit={onSubmitBill}>
              {/* Linked Information Banner */}
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Purchase Order:</span> <strong>{uploadModal.po_no}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Supplier/Vendor:</span> <strong>{uploadModal.vendor_name}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Project Site:</span> <strong>{uploadModal.site_name}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Workflow:</span> <span className="badge badge-approved" style={{ fontSize: '0.72rem' }}>Site Verified</span></div>
              </div>

              {/* Basic Details: Challan No, Date, Vehicle No */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    Challan / Bill No *
                  </label>
                  <input
                    type="text"
                    required
                    value={formChallanNo}
                    onChange={(e) => onChallanNoChange(e.target.value)}
                    placeholder="e.g. INV-9011"
                    className="form-control"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    Challan Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="form-control"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    Vehicle No
                  </label>
                  <input
                    type="text"
                    value={formVehicleNo}
                    onChange={(e) => onVehicleNoChange(e.target.value)}
                    placeholder="e.g. MH-12-AB-1234"
                    className="form-control"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Financial Breakdown Section */}
              <div style={{ background: '#fdf4ff', border: '1px solid #f0abfc', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                <h5 style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', fontWeight: 700, color: '#86198f', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <DollarSign size={15} />
                  <span>Commercial & Tax Charges Breakdown</span>
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginBottom: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a044e' }}>Basic Material Amt (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formBasic}
                      onChange={(e) => onBasicChange(e.target.value)}
                      placeholder="0.00"
                      className="form-control"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a044e' }}>Freight / Transport (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formFreight}
                      onChange={(e) => onFreightChange(e.target.value)}
                      placeholder="0.00"
                      className="form-control"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a044e' }}>Loading / Unloading (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formLoading}
                      onChange={(e) => onLoadingChange(e.target.value)}
                      placeholder="0.00"
                      className="form-control"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a044e' }}>Packaging Charges (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formPack}
                      onChange={(e) => onPackChange(e.target.value)}
                      placeholder="0.00"
                      className="form-control"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a044e' }}>Other Miscellaneous (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formOther}
                      onChange={(e) => onOtherChange(e.target.value)}
                      placeholder="0.00"
                      className="form-control"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a044e' }}>GST Tax Rate (%)</label>
                    <select
                      value={formGstPct}
                      onChange={(e) => onGstPctChange(e.target.value)}
                      className="form-control"
                      style={{ fontSize: '0.82rem' }}
                    >
                      <option value="0">0% (Nil / Exempt)</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST (Standard)</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>
                </div>

                {/* Calculation Summary bar */}
                <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px dashed #f0abfc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal: </span>
                    <strong>₹{billSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    <span style={{ margin: '0 0.5rem', color: '#cbd5e1' }}>|</span>
                    <span style={{ color: 'var(--text-muted)' }}>GST ({formGstPct}%): </span>
                    <strong style={{ color: '#d97706' }}>₹{billGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#047857' }}>
                    Grand Total: ₹{billGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Document File Attachment */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Upload size={14} />
                  <span>Attach Vendor Bill / Tax Invoice (PDF or Image)</span>
                </label>
                <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    id="bill-file-upload"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        try {
                          const processed = await processBillFile(e.target.files[0]);
                          onDocChange(processed);
                        } catch (err) {
                          alert('Failed to process file: ' + err.message);
                        }
                      }
                    }}
                  />
                  <label htmlFor="bill-file-upload" style={{ cursor: 'pointer', margin: 0, display: 'block' }}>
                    {formDoc ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#eff6ff', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                        <FileText size={18} color="#2563eb" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e40af' }}>{formDoc.name}</span>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            onDocChange(null);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', marginLeft: '0.25rem' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} color="#64748b" style={{ margin: '0 auto 0.35rem' }} />
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                          Click to browse or drop Invoice / Billed Challan PDF/Photo
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Supports PDF, JPG, PNG, WEBP (Max 15MB)</div>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Notes / Payment Terms Remarks
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="e.g. As per PO terms, 30 days credit. Invoice verified with site physical challan."
                  rows="2"
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={onCloseUpload}
                  className="btn btn-secondary"
                  disabled={billSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={billSubmitting}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                >
                  <Receipt size={16} />
                  <span>{billSubmitting ? 'Saving...' : (uploadModal.existingBill ? 'Update Billed Challan' : 'Save & Attach Bill')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Commercial Billed Challan Details Modal */}
      {viewModal && (
        <div className="modal-backdrop" onClick={onCloseView} style={{ zIndex: 1300 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Receipt size={20} color="#7c3aed" />
                  <span>Vendor Commercial Billed Challan</span>
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Challan No: <strong>{viewModal.challan_no}</strong> • Date: {formatWorkflowDate(viewModal.challan_date)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {viewModal.document_file && (
                  <button
                    type="button"
                    onClick={() => handleDownloadPhoto({ dataUrl: viewModal.document_file, name: viewModal.document_name }, `Invoice_${viewModal.challan_no}`)}
                    className="btn btn-primary btn-sm"
                    style={{ background: '#7c3aed', borderColor: '#7c3aed', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}
                  >
                    <Download size={13} />
                    <span>Save Bill</span>
                  </button>
                )}
                <button onClick={onCloseView} className="close-btn">✕</button>
              </div>
            </div>

            {/* Document Preview */}
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              {viewModal.document_file ? (
                viewModal.document_file.includes('.pdf') || viewModal.document_name?.toLowerCase().endsWith('.pdf') ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: '#ffffff', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <FileText size={42} color="#ef4444" style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{viewModal.document_name || 'Vendor_Invoice.pdf'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', marginBottom: '0.75rem' }}>Attached PDF Document</div>
                    <a
                      href={viewModal.document_file}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#2563eb', borderColor: '#bfdbfe' }}
                    >
                      <ExternalLink size={12} />
                      <span>Open PDF in New Window</span>
                    </a>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', background: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <img
                      src={viewModal.document_file}
                      alt="Vendor Bill"
                      style={{ maxHeight: '340px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => onPreviewPhoto && onPreviewPhoto(viewModal.document_file)}
                      title="Click to zoom image"
                    />
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No physical document file attached to this record.
                </div>
              )}
            </div>

            {/* Financial Charges Table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <tbody>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>Basic Material Amount</td>
                    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>₹{Number(viewModal.basic_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  {Number(viewModal.freight_charges) > 0 && (
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>Freight / Transportation</td>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>₹{Number(viewModal.freight_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {Number(viewModal.loading_unloading_charges) > 0 && (
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>Loading / Unloading</td>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>₹{Number(viewModal.loading_unloading_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {Number(viewModal.packaging_charges) > 0 && (
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>Packaging Charges</td>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>₹{Number(viewModal.packaging_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {Number(viewModal.other_charges) > 0 && (
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>Other Miscellaneous Charges</td>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>₹{Number(viewModal.other_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fffbeb' }}>
                    <td style={{ padding: '0.45rem 0.75rem', color: '#92400e', fontWeight: 600 }}>GST Tax ({viewModal.gst_percent || 18}%)</td>
                    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>₹{Number(viewModal.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr style={{ background: '#ecfdf5', fontWeight: 800 }}>
                    <td style={{ padding: '0.6rem 0.75rem', color: '#065f46', fontSize: '0.9rem' }}>Grand Total Billed Amount</td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#047857', fontSize: '0.95rem' }}>₹{Number(viewModal.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {viewModal.notes && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <strong style={{ color: '#92400e' }}>Notes:</strong>
                <p style={{ margin: '0.2rem 0 0', color: '#78350f' }}>{viewModal.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button type="button" onClick={onCloseView} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeliveryBillModal;
