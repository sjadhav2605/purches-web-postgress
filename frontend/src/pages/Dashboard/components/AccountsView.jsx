import React, { useState } from 'react';
import { 
  Receipt, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  ChevronRight, 
  Scale, 
  Calculator 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AccountsView = () => {
  const [invoices, setInvoices] = useState([
    {
      id: 201,
      invoice_no: 'INV-TATA-9021',
      vendor: 'Tata Steel Tubes & TMT',
      po_no: 'PO-2026-0870',
      po_amount: 1890000,
      grn_qty: '28 MT (100% OK)',
      invoice_amount: 1890000,
      match_status: 'Exact 3-Way Match',
      discrepancy: null,
      status: 'Ready for Payment',
      dueDate: 'Due in 12 days'
    },
    {
      id: 202,
      invoice_no: 'INV-UT-8841',
      vendor: 'UltraTech Cement Ltd.',
      po_no: 'PO-2026-0865',
      po_amount: 1245000,
      grn_qty: '220 m³ (100% OK)',
      invoice_amount: 1245000,
      match_status: 'Exact 3-Way Match',
      discrepancy: null,
      status: 'Ready for Payment',
      dueDate: 'Due in 8 days'
    },
    {
      id: 203,
      invoice_no: 'INV-RG-402',
      vendor: 'Rajputana Granites',
      po_no: 'PO-2026-0862',
      po_amount: 480000,
      grn_qty: '116 Slabs OK (4 Broken)',
      invoice_amount: 480000,
      match_status: 'Discrepancy Flagged',
      discrepancy: 'Debit Note ₹16,000 needed for 4 broken slabs',
      status: 'On Hold',
      dueDate: 'Hold pending debit note'
    },
    {
      id: 204,
      invoice_no: 'INV-KAJ-771',
      vendor: 'Kajaria Ceramics Ltd.',
      po_no: 'PO-2026-0855',
      po_amount: 540000,
      grn_qty: '450 Boxes (100% OK)',
      invoice_amount: 540000,
      match_status: 'Exact 3-Way Match',
      discrepancy: null,
      status: 'Ready for Payment',
      dueDate: 'Due in 15 days'
    }
  ]);

  const [toastMessage, setToastMessage] = useState(null);

  const [basicAmount, setBasicAmount] = useState(1000000);
  const cgstAmount = Math.round(basicAmount * 0.09);
  const sgstAmount = Math.round(basicAmount * 0.09);
  const totalWithGst = basicAmount + cgstAmount + sgstAmount;
  const tds194Q = Math.round(basicAmount * 0.001); // 0.1% TDS u/s 194Q
  const retention5Pct = Math.round(basicAmount * 0.05); // 5% Retention Money
  const netPayable = totalWithGst - tds194Q - retention5Pct;

  const handleApprovePayment = (id) => {
    const inv = invoices.find(i => i.id === id);
    setInvoices(invoices.map(i => i.id === id ? { ...i, status: 'Payment Released' } : i));
    setToastMessage({
      type: 'success',
      text: `Payment voucher scheduled for ${inv?.vendor} (Invoice ${inv?.invoice_no}) via RTGS / NEFT.`
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bento-toast bento-toast-success">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={16} />
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Main Bento Layout: 8-Col Reconciliation Queue + 4-Col Side Tax Calculator */}
      <div className="bento-layout-grid">
        {/* Main Card: Strict 3-Way Reconciliation Queue (8 cols) */}
        <div className="bento-col-8 bento-card">
          <div>
            <div className="bento-card-header">
              <div>
                <h2 className="bento-card-title">
                  <span>Strict 3-Way Reconciliation Queue</span>
                  <span className="bento-badge bento-badge-success">PO ⇄ GRN ⇄ Tax Invoice</span>
                </h2>
                <p className="bento-card-subtitle">
                  Automated verification prevents billing leakages, price creep, and unverified site deliveries.
                </p>
              </div>

              <Link to="/payments" className="bento-btn bento-btn-secondary bento-btn-sm">
                <span>View All Invoices</span>
                <ChevronRight size={13} />
              </Link>
            </div>

            {/* Reconciliation Table */}
            <div className="bento-table-wrapper">
              <table className="bento-table">
                <thead>
                  <tr>
                    <th>Invoice &amp; Supplier</th>
                    <th>PO &amp; Site GRN</th>
                    <th>Billed vs PO Amount</th>
                    <th>Verification Match</th>
                    <th style={{ textAlign: 'right' }}>Payment Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const isMatched = inv.match_status === 'Exact 3-Way Match';
                    const isPaid = inv.status === 'Payment Released';

                    return (
                      <tr key={inv.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{inv.invoice_no}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>{inv.vendor}</div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 700, color: '#2563eb' }}>{inv.po_no}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                            GRN: <strong style={{ color: '#0f172a' }}>{inv.grn_qty}</strong>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                            ₹{inv.invoice_amount.toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                            PO: ₹{inv.po_amount.toLocaleString('en-IN')}
                          </div>
                        </td>

                        <td>
                          {isMatched ? (
                            <div>
                              <span className="bento-badge bento-badge-success">
                                <CheckCircle2 size={12} />
                                <span>100% Exact Match</span>
                              </span>
                              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>{inv.dueDate}</div>
                            </div>
                          ) : (
                            <div>
                              <span className="bento-badge bento-badge-warning">
                                <AlertCircle size={12} />
                                <span>Discrepancy</span>
                              </span>
                              <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600, marginTop: '0.2rem', lineHeight: 1.3 }}>
                                {inv.discrepancy}
                              </div>
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          {isPaid ? (
                            <span className="bento-badge bento-badge-success">
                              <Check size={11} />
                              <span>Paid</span>
                            </span>
                          ) : isMatched ? (
                            <button
                              type="button"
                              onClick={() => handleApprovePayment(inv.id)}
                              className="bento-btn bento-btn-success bento-btn-sm"
                            >
                              <Check size={12} />
                              <span>Approve Pay</span>
                            </button>
                          ) : (
                            <span className="bento-badge bento-badge-warning">
                              Held on Hold
                            </span>
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
            <span>Statutory compliance: TDS deducted at source prior to payment voucher dispatch</span>
            <strong style={{ color: '#334155' }}>Income Tax &amp; GST Rule Compliant</strong>
          </div>
        </div>

        {/* Side Card: Commercial Tax & Deductions (4 cols) */}
        <div className="bento-col-4 bento-card">
          <div>
            <div className="bento-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Commercial Tax &amp; Deductions</h3>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Statutory withholdings &amp; net payable</p>
                </div>
              </div>
            </div>

            {/* Quick Interactive Bill Simulator */}
            <div style={{ marginTop: '0.85rem', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                Sample Bill Base (₹)
              </label>
              <input
                type="number"
                step="50000"
                value={basicAmount}
                onChange={(e) => setBasicAmount(Math.max(0, Number(e.target.value) || 0))}
                style={{ width: '100%', fontSize: '0.82rem', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
              />
            </div>

            {/* Deductions Breakdown Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', paddingTop: '0.25rem' }}>
              <div className="bento-calc-row">
                <span style={{ color: '#475569' }}>Basic Material Value</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{basicAmount.toLocaleString('en-IN')}</span>
              </div>

              <div className="bento-calc-row" style={{ color: '#2563eb' }}>
                <span>CGST (9%)</span>
                <span style={{ fontWeight: 700 }}>+₹{cgstAmount.toLocaleString('en-IN')}</span>
              </div>

              <div className="bento-calc-row" style={{ color: '#2563eb' }}>
                <span>SGST (9%)</span>
                <span style={{ fontWeight: 700 }}>+₹{sgstAmount.toLocaleString('en-IN')}</span>
              </div>

              <div className="bento-calc-row" style={{ color: '#64748b', fontSize: '0.72rem' }}>
                <span>Total Invoice with GST (18%)</span>
                <strong style={{ color: '#0f172a' }}>₹{totalWithGst.toLocaleString('en-IN')}</strong>
              </div>

              <div className="bento-calc-row" style={{ color: '#dc2626' }}>
                <span>TDS u/s 194Q (0.1% on Goods)</span>
                <span style={{ fontWeight: 700 }}>-₹{tds194Q.toLocaleString('en-IN')}</span>
              </div>

              <div className="bento-calc-row" style={{ color: '#d97706' }}>
                <span>Retention Money (5% Security)</span>
                <span style={{ fontWeight: 700 }}>-₹{retention5Pct.toLocaleString('en-IN')}</span>
              </div>

              {/* Net Payable Highlight */}
              <div className="bento-calc-highlight">
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>Net Payable to Vendor</div>
                  <div style={{ fontSize: '0.68rem', color: '#047857' }}>After statutory deductions</div>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#047857' }}>
                  ₹{netPayable.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          <div className="bento-card-footer">
            <span>Retention released upon site completion</span>
            <strong style={{ color: '#6d28d9' }}>GST ITC Locked</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountsView;
