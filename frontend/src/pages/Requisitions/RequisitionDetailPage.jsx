import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { requisitionService } from '../../services/requisition.service.js';
import { masterService } from '../../services/master.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatWorkflowDateTime, formatWorkflowDate } from '../../utils/dateFormatter.js';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Send,
  Calendar,
  Building2,
  X,
  Edit3,
  Save,
  Image as ImageIcon,
  Trash2,
  Plus,
  Truck,
  Package,
  Award,
  FileText,
  Upload,
  XCircle,
  History,
  Check,
  Eye,
  Share2,
  MessageSquare,
  Copy,
  ExternalLink,
  ChevronDown,
  Mail,
  Download
} from 'lucide-react';

// Helper to download single photo or PDF attachment
const handleDownloadPhoto = (photoItem, fallbackBaseName = 'challan_doc') => {
  if (!photoItem) return;
  const src = photoItem.dataUrl || photoItem.url || photoItem;
  if (!src) return;

  const rawName = photoItem.name || '';
  let extension = '.jpg';
  if (typeof src === 'string') {
    if (src.startsWith('data:application/pdf') || rawName.toLowerCase().endsWith('.pdf')) {
      extension = '.pdf';
    } else if (src.startsWith('data:image/png') || rawName.toLowerCase().endsWith('.png')) {
      extension = '.png';
    } else if (src.startsWith('data:image/webp') || rawName.toLowerCase().endsWith('.webp')) {
      extension = '.webp';
    }
  }

  const finalName = rawName || `${fallbackBaseName}_${Date.now()}${extension}`;

  const link = document.createElement('a');
  link.href = src;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Helper to download all attachments sequentially
const handleDownloadAllPhotos = (photos, baseTitle = 'Challan_Docs') => {
  if (!Array.isArray(photos) || photos.length === 0) return;
  photos.forEach((p, idx) => {
    setTimeout(() => {
      handleDownloadPhoto(p, `${baseTitle}_${idx + 1}`);
    }, idx * 250);
  });
};

export const RequisitionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeRole } = useAuth();

  const [pr, setPr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  // Rate Editing State (Purchase Department)
  const [isEditingRates, setIsEditingRates] = useState(false);
  const [editingRates, setEditingRates] = useState({});
  const [savingRates, setSavingRates] = useState(false);

  // Line Items & Header Editing State (Project Coordinator & Admin)
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editableItems, setEditableItems] = useState([]);
  const [editRequiredByDate, setEditRequiredByDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [savingItems, setSavingItems] = useState(false);

  // Selected Photo Preview Modal
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Send to Vendors Modal State (Purchase Department)
  const [showSendModal, setShowSendModal] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [vendorSearch, setVendorSearch] = useState('');
  const [submittingRfq, setSubmittingRfq] = useState(false);

  // Commercial & Payment Terms Configuration State
  const [paymentTerms, setPaymentTerms] = useState('20% Advance + 30 Days Credit');
  const [advancePct, setAdvancePct] = useState(20);
  const [creditDays, setCreditDays] = useState(30);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [activeSendTab, setActiveSendTab] = useState('terms'); // 'terms' | 'share'
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedVendorId, setCopiedVendorId] = useState(null);
  const [createdRfqDetails, setCreatedRfqDetails] = useState(null);

  // Collapsible History States (Accordion)
  const [showCoordinatorHistory, setShowCoordinatorHistory] = useState(false);
  const [showStatusHistory, setShowStatusHistory] = useState(false);

  // Decline Modal State (Mandatory Reason)
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineRoleType, setDeclineRoleType] = useState('pc'); // 'pc' | 'purchase'
  const [declineReason, setDeclineReason] = useState('');
  const [submittingDecline, setSubmittingDecline] = useState(false);

  // Supervisor Material Receive Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivedQty, setReceivedQty] = useState('');
  const [receiveChallanNo, setReceiveChallanNo] = useState('');
  const [receiveRemarks, setReceiveRemarks] = useState('Materials received at site in good physical condition');
  const [proofFile, setProofFile] = useState(null);
  const [proofFileName, setProofFileName] = useState('');
  const [submittingReceive, setSubmittingReceive] = useState(false);

  // Shortlist Vendor Modal State (Purchase Department after Director approves)
  const [showShortlistModal, setShowShortlistModal] = useState(false);
  const [shortlistVendorId, setShortlistVendorId] = useState('');
  const [submittingShortlist, setSubmittingShortlist] = useState(false);

  const fetchPrDetails = async () => {
    setLoading(true);
    try {
      const data = await requisitionService.getRequisitionById(id);
      if (data && Array.isArray(data.items)) {
        data.items = data.items.map((it) => ({
          ...it,
          quantity: it.quantity !== null && it.quantity !== undefined ? Number(parseFloat(it.quantity)) : 0,
          est_rate: it.est_rate !== null && it.est_rate !== undefined ? Number(parseFloat(it.est_rate)) : 0
        }));
      }
      setPr(data);
      if (data) {
        setReceiveChallanNo(data.challan_no || '');
        setReceivedQty(data.dispatched_qty || '');
      }
    } catch (err) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  // Purchase Re-open Dispatch State
  const [reopeningDispatch, setReopeningDispatch] = useState(false);

  useEffect(() => {
    fetchPrDetails();
  }, [id]);

  // Global Escape key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewPhoto(null);
        setShowSendModal(false);
        setShowShortlistModal(false);
        setShowReceiveModal(false);
        setShowDeclineModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Coordinator Quick Approve
  const handleCoordinatorApprove = async () => {
    if (!window.confirm(`Approve Request ${pr.pr_no} and forward to Purchase Department?`)) return;
    setStatusUpdateLoading(true);
    try {
      await requisitionService.coordinatorApprove(pr.id);
      await fetchPrDetails();
      alert(`Request ${pr.pr_no} approved and forwarded to Purchase Department!`);
    } catch (err) {
      alert(err.message || 'Failed to approve request');
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Open Decline Modal
  const handleOpenDeclineModal = (roleType) => {
    setDeclineRoleType(roleType);
    setDeclineReason('');
    setShowDeclineModal(true);
  };

  // Submit Decline
  const handleSubmitDecline = async (e) => {
    e.preventDefault();
    if (!declineReason || !declineReason.trim()) {
      alert('A decline reason is mandatory.');
      return;
    }

    setSubmittingDecline(true);
    try {
      if (declineRoleType === 'pc') {
        await requisitionService.coordinatorDecline(pr.id, declineReason.trim());
      } else {
        await requisitionService.purchaseDecline(pr.id, declineReason.trim());
      }
      setShowDeclineModal(false);
      setDeclineReason('');
      await fetchPrDetails();
      alert('Request declined and notification dispatched.');
    } catch (err) {
      alert(err.message || 'Failed to decline request');
    } finally {
      setSubmittingDecline(false);
    }
  };

  // Start Coordinator Item Editing
  const handleStartEditingItems = () => {
    const copy = (pr?.items || []).map((item) => ({
      id: item.id || null,
      material_id: item.material_id || null,
      description: item.description || '',
      spec: item.spec || '',
      unit: item.unit || 'Nos',
      quantity: item.quantity !== undefined ? Number(parseFloat(item.quantity)) : 1,
      est_rate: item.est_rate || 0,
      is_custom: item.is_custom ? true : false,
      justification: item.justification || '',
      photos: item.photos || []
    }));
    setEditableItems(copy);
    setEditRequiredByDate(pr.required_by_date ? pr.required_by_date.split('T')[0] : '');
    setEditRemarks(pr.remarks || '');
    setIsEditingItems(true);
  };

  const handleCancelEditingItems = () => {
    setIsEditingItems(false);
    setEditableItems([]);
  };

  const handleItemFieldChange = (index, field, value) => {
    setEditableItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleDeleteItem = (index) => {
    if (editableItems.length <= 1) {
      alert('A request must contain at least one material item.');
      return;
    }
    const itemToDelete = editableItems[index];
    const itemLabel = itemToDelete.description || `Item #${index + 1}`;
    if (window.confirm(`Are you sure you want to remove "${itemLabel}" from this request?`)) {
      setEditableItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleAddItem = () => {
    setEditableItems((prev) => [
      ...prev,
      {
        id: null,
        material_id: null,
        description: '',
        spec: '',
        unit: 'Nos',
        quantity: 1,
        est_rate: 0,
        is_custom: true,
        justification: 'Added during coordinator review',
        photos: []
      }
    ]);
  };

  const handleSaveItems = async () => {
    if (!editableItems || editableItems.length === 0) {
      alert('Request must have at least one line item.');
      return;
    }

    for (let i = 0; i < editableItems.length; i++) {
      const it = editableItems[i];
      if (!it.description || it.description.trim().length < 2) {
        alert(`Item #${i + 1}: Please enter a valid material description.`);
        return;
      }
      const qty = Number(it.quantity);
      if (isNaN(qty) || qty <= 0) {
        alert(`Item #${i + 1} (${it.description}): Quantity must be greater than zero.`);
        return;
      }
      if (!it.unit || !it.unit.trim()) {
        alert(`Item #${i + 1} (${it.description}): Please specify a unit.`);
        return;
      }
    }

    setSavingItems(true);
    try {
      const payload = {
        items: editableItems.map((it) => ({
          id: it.id || null,
          material_id: it.material_id || null,
          description: it.description.trim(),
          spec: (it.spec || '').trim(),
          unit: it.unit.trim(),
          quantity: Number(it.quantity),
          est_rate: it.est_rate !== undefined ? Number(it.est_rate) : 0,
          is_custom: Boolean(it.is_custom),
          justification: it.justification || '',
          photos: it.photos || []
        })),
        required_by_date: editRequiredByDate || null,
        remarks: editRemarks
      };

      await requisitionService.coordinatorEdit(pr.id, payload);
      alert('Request edits successfully saved! Edit history has been logged.');
      setIsEditingItems(false);
      await fetchPrDetails();
    } catch (err) {
      alert(err.message || 'Failed to update request items');
    } finally {
      setSavingItems(false);
    }
  };

  // Presets helper for Commercial & Payment Terms
  const applyTermsPreset = (name) => {
    setPaymentTerms(name);
    if (name === '20% Advance + 30 Days Credit') {
      setAdvancePct(20);
      setCreditDays(30);
    } else if (name === '10% Advance + 30 Days Credit') {
      setAdvancePct(10);
      setCreditDays(30);
    } else if (name === 'Net 30 Days Credit') {
      setAdvancePct(0);
      setCreditDays(30);
    } else if (name === 'Net 15 Days Credit') {
      setAdvancePct(0);
      setCreditDays(15);
    } else if (name === 'Net 45 Days Credit') {
      setAdvancePct(0);
      setCreditDays(45);
    } else if (name === '100% on Delivery') {
      setAdvancePct(0);
      setCreditDays(0);
    }
  };

  // Open Purchase Send to Vendors Modal
  const handleOpenSendModal = async () => {
    setShowSendModal(true);
    setActiveSendTab('terms');
    setCopiedText(false);
    setCopiedLink(false);

    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDeadline(d.toISOString().split('T')[0]);
    setVendorSearch('');

    // Pre-populate terms
    const initialTerms = pr?.payment_terms || pr?.linked_rfq?.payment_terms || '20% Advance + 30 Days Credit';
    const initialAdv = pr?.advance_pct !== undefined && pr?.advance_pct !== null ? Number(pr.advance_pct) : (pr?.linked_rfq?.advance_pct !== undefined ? Number(pr.linked_rfq.advance_pct) : 20);
    const initialCredit = pr?.credit_days !== undefined && pr?.credit_days !== null ? Number(pr.credit_days) : (pr?.linked_rfq?.credit_days !== undefined ? Number(pr.linked_rfq.credit_days) : 30);
    const initialNotes = pr?.payment_terms_notes || pr?.linked_rfq?.payment_terms_notes || '';

    setPaymentTerms(initialTerms);
    setAdvancePct(initialAdv);
    setCreditDays(initialCredit);
    setPaymentNotes(initialNotes);

    if (pr?.linked_rfq) {
      setCreatedRfqDetails({
        rfq_id: pr.linked_rfq.rfq_id,
        rfq_no: pr.linked_rfq.rfq_no,
        payment_terms: initialTerms,
        advance_pct: initialAdv,
        credit_days: initialCredit,
        payment_terms_notes: initialNotes
      });
    }

    try {
      const data = await masterService.getVendors();
      const list = data || [];
      setVendors(list);
      setSelectedVendorIds(list.map((v) => v.id));
    } catch (e) {
      console.error('Error fetching vendors:', e);
    }
  };

  // Open Direct Share Modal
  const handleOpenShareModal = async () => {
    setShowSendModal(true);
    setActiveSendTab('share');
    setCopiedText(false);
    setCopiedLink(false);

    const initialTerms = pr?.payment_terms || pr?.linked_rfq?.payment_terms || '20% Advance + 30 Days Credit';
    const initialAdv = pr?.advance_pct !== undefined && pr?.advance_pct !== null ? Number(pr.advance_pct) : (pr?.linked_rfq?.advance_pct !== undefined ? Number(pr.linked_rfq.advance_pct) : 20);
    const initialCredit = pr?.credit_days !== undefined && pr?.credit_days !== null ? Number(pr.credit_days) : (pr?.linked_rfq?.credit_days !== undefined ? Number(pr.linked_rfq.credit_days) : 30);
    const initialNotes = pr?.payment_terms_notes || pr?.linked_rfq?.payment_terms_notes || '';

    setPaymentTerms(initialTerms);
    setAdvancePct(initialAdv);
    setCreditDays(initialCredit);
    setPaymentNotes(initialNotes);

    setCreatedRfqDetails({
      rfq_id: pr?.linked_rfq?.rfq_id,
      rfq_no: pr?.linked_rfq?.rfq_no || `RFQ for ${pr?.pr_no}`,
      payment_terms: initialTerms,
      advance_pct: initialAdv,
      credit_days: initialCredit,
      payment_terms_notes: initialNotes
    });

    try {
      const data = await masterService.getVendors();
      const list = data || [];
      setVendors(list);

      const winId = pr?.shortlisted_vendor_id || pr?.linked_rfq?.winner_vendor_id || pr?.linked_po?.vendor_id;
      const winName = pr?.shortlisted_vendor_name || pr?.linked_po?.vendor_name;
      const isConfirmed = ['Vendor Shortlisted', 'PO Issued', 'Director Approved', 'Approved', 'Dispatched', 'Received'].includes(pr?.status) || !!winId || !!winName;

      if (isConfirmed && (winId || winName)) {
        const found = list.find(v => (winId && String(v.id) === String(winId)) || (winName && v.name?.trim().toLowerCase() === winName.trim().toLowerCase()));
        if (found) {
          setSelectedVendorIds([found.id]);
        } else if (winId) {
          setSelectedVendorIds([Number(winId)]);
        }
      } else {
        setSelectedVendorIds(list.map((v) => v.id));
      }
    } catch (e) {
      console.error('Error fetching vendors:', e);
    }
  };

  // Handle Purchase Manager Re-opening & Re-sharing submission link for Vendor to correct details
  const handleReopenDispatchLink = async () => {
    const confirmReopen = window.confirm(
      "Are you sure you want to re-open the dispatch submission link for this vendor?\n\nThis will unlock the vendor portal so they can correct their delivery challan, bill number, vehicle, or dispatch date."
    );
    if (!confirmReopen) return;

    setReopeningDispatch(true);
    try {
      await requisitionService.reopenDispatch(pr.id, { reason: 'Purchase Department allowed vendor correction' });
      await fetchPrDetails();
      await handleOpenShareModal();
      alert("✅ Link re-opened successfully! The vendor can now edit and re-submit their dispatch details. You can now send or copy the link to the vendor.");
    } catch (err) {
      alert(err.message || 'Failed to re-open dispatch submission link');
    } finally {
      setReopeningDispatch(false);
    }
  };

  const handleToggleVendor = (vendorId) => {
    if (selectedVendorIds.includes(vendorId)) {
      setSelectedVendorIds(selectedVendorIds.filter((id) => id !== vendorId));
    } else {
      setSelectedVendorIds([...selectedVendorIds, vendorId]);
    }
  };

  const handleToggleAllVendors = () => {
    if (selectedVendorIds.length === vendors.length) {
      setSelectedVendorIds([]);
    } else {
      setSelectedVendorIds(vendors.map((v) => v.id));
    }
  };

  const setDeadlinePreset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDeadline(d.toISOString().split('T')[0]);
  };

  const handleSendRfqSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (selectedVendorIds.length === 0) {
      alert('Please select at least one vendor to invite.');
      return;
    }

    setSubmittingRfq(true);
    try {
      const result = await requisitionService.purchaseApprove(pr.id, {
        vendor_ids: selectedVendorIds,
        deadline: deadline || null,
        remarks: 'RFQ floated by Purchase Department',
        payment_terms: paymentTerms,
        advance_pct: Number(advancePct),
        credit_days: Number(creditDays),
        payment_terms_notes: paymentNotes
      });

      const rfqId = result?.rfq_id || pr?.linked_rfq?.rfq_id || null;
      const rfqNo = result?.rfq_no || pr?.linked_rfq?.rfq_no || `RFQ for ${pr.pr_no}`;

      const created = {
        rfq_id: rfqId,
        rfq_no: rfqNo,
        payment_terms: paymentTerms,
        advance_pct: Number(advancePct),
        credit_days: Number(creditDays),
        payment_terms_notes: paymentNotes
      };
      setCreatedRfqDetails(created);

      setActiveSendTab('share');
      await fetchPrDetails();
      alert(`RFQ (${rfqNo}) floated successfully with Payment Terms! You can now send WhatsApp or direct portal links to vendors from the Share tab.`);
      return created;
    } catch (err) {
      alert(err.message || 'Failed to send RFQ');
      return null;
    } finally {
      setSubmittingRfq(false);
    }
  };

  // Direct Quotation Portal URL helper (with cryptographic signature if available)
  const getDirectQuoteUrl = (targetVendorId = null) => {
    const rfqId = createdRfqDetails?.rfq_id || pr?.linked_rfq?.rfq_id;
    if (!rfqId) return `${window.location.origin}/rfqs`;
    const invitedList = pr?.linked_rfq?.invited_vendors || [];
    const matchedVendor = targetVendorId ? invitedList.find(v => String(v.vendor_id || v.id) === String(targetVendorId)) : null;
    const sigParam = matchedVendor?.quote_sig ? `&sig=${matchedVendor.quote_sig}` : '';
    return targetVendorId 
      ? `${window.location.origin}/quote/${rfqId}?v=${targetVendorId}${sigParam}`
      : `${window.location.origin}/quote/${rfqId}`;
  };

  // Helper to find shortlisted / winning vendor object
  const getWinningVendorObj = () => {
    const winId = pr?.shortlisted_vendor_id || pr?.linked_rfq?.winner_vendor_id || pr?.linked_po?.vendor_id;
    const winName = pr?.shortlisted_vendor_name || pr?.linked_po?.vendor_name;
    const isConfirmed = ['Vendor Shortlisted', 'PO Issued', 'Director Approved', 'Approved', 'Dispatched', 'Received'].includes(pr?.status) || !!winId || !!winName;
    if (!isConfirmed) return null;
    const matched = vendors.find(v => (winId && String(v.id) === String(winId)) || (winName && v.name?.trim().toLowerCase() === winName.trim().toLowerCase()));
    if (matched) return matched;
    if (winId || winName) {
      return { id: winId || 0, name: winName || 'Winning Vendor', phone: pr?.linked_po?.vendor_phone || '', email: '' };
    }
    return null;
  };

  // WhatsApp & Email message formatting helper
  const buildShareMessage = (targetVendor = null) => {
    const winningObj = getWinningVendorObj();
    const effectiveVendor = targetVendor || winningObj;
    const rfqNo = createdRfqDetails?.rfq_no || pr?.linked_rfq?.rfq_no || `RFQ for ${pr?.pr_no}`;
    const siteStr = pr?.site_name ? `${pr.site_code} (${pr.site_name})` : (pr?.site_code || 'Site Project');
    const deadlineStr = deadline ? new Date(deadline).toLocaleDateString('en-IN') : 'Immediate';
    const vendorName = effectiveVendor?.name || effectiveVendor?.vendor_name || (winningObj ? winningObj.name : 'Partner Vendor');
    const vendorId = effectiveVendor?.id || effectiveVendor?.vendor_id || (winningObj ? winningObj.id : null);
    const quoteUrl = getDirectQuoteUrl(vendorId);

    const itemsSummary = (pr?.items || []).slice(0, 5).map((it, i) => 
      `  ${i + 1}. ${it.description} - ${it.quantity} ${it.unit}`
    ).join('\n');
    const moreCount = (pr?.items || []).length > 5 ? `\n  ... +${(pr?.items || []).length - 5} more items` : '';

    const isOrderConfirmation = ['Vendor Shortlisted', 'PO Issued', 'Director Approved', 'Approved'].includes(pr?.status) || !!winningObj;

    if (isOrderConfirmation) {
      const finalTerms = pr?.payment_terms || paymentTerms || 'Net 30 Days Credit';
      const finalAdv = pr?.advance_pct ?? advancePct ?? 0;
      const finalCredit = pr?.credit_days ?? creditDays ?? 30;
      const finalNotes = pr?.payment_terms_notes || paymentNotes || '';
      const isReopened = Boolean(pr?.dispatch_link_reopened);

      if (isReopened) {
        return `*Decent Decor Pvt. Ltd. (DDPL)* - ⚠️ Dispatch Details Correction Required\n` +
`--------------------------------------\n` +
`Hello *${vendorName}*,\n\n` +
`DDPL Purchase Department has reopened your dispatch submission portal for RFQ *${rfqNo}* (${pr?.pr_no}) so you can *correct and update* your Delivery Challan, Tax Invoice/Bill number, Vehicle, or Dispatch Date.\n\n` +
`*Delivery Site:* ${siteStr}\n` +
`*Agreed Commercial & Payment Terms:*\n` +
`• Payment Terms: ${finalTerms}\n` +
`• Advance: ${finalAdv}%, Credit: ${finalCredit} Days\n\n` +
`*👉 Click Link Below to Correct & Resubmit Delivery Details:*\n` +
`👉 ${quoteUrl}\n\n` +
`Please open the link above, review your entries, and submit the corrected details.\n\n` +
`Thank you,\nPurchase Department | DDPL`;
      }

      return `*Decent Decor Pvt. Ltd. (DDPL)* - Order Award & Shortlist Confirmation\n` +
`--------------------------------------\n` +
`Congratulations *${vendorName}*!\n\n` +
`Your quotation for RFQ *${rfqNo}* (${pr?.pr_no}) has been approved and finalized by DDPL Management.\n\n` +
`*Delivery Site:* ${siteStr}\n` +
`*Agreed Commercial & Payment Terms:*\n` +
`• Payment Terms: ${finalTerms}\n` +
`• Advance Payment: ${finalAdv}%\n` +
`• Credit Period: ${finalCredit} Days\n` +
(finalNotes ? `• Commercial Conditions: ${finalNotes}\n` : '') +
`\n*Confirm Order & Schedule Delivery Dispatch:*\n` +
`👉 ${quoteUrl}\n\n` +
`Please open the link above to review materials and enter your Delivery Challan, Tax Invoice/Bill number, Vehicle number, and Expected Delivery Date.\n\n` +
`Thank you,\nPurchase Department | DDPL`;
    }

    // 1st Time Initial RFQ Invitation (Terms are omitted at bidding stage):
    return `*Decent Decor Pvt. Ltd. (DDPL)* - RFQ Invitation\n` +
`--------------------------------------\n` +
`Hello ${vendorName},\n\n` +
`DDPL Purchase Department has invited you to submit your competitive quotation for:\n` +
`*RFQ No:* ${rfqNo}\n` +
`*Linked PR:* ${pr?.pr_no}\n` +
`*Delivery Site:* ${siteStr}\n` +
`*Submission Deadline:* ${deadlineStr}\n\n` +
`*Required Material Items:*\n` +
`${itemsSummary}${moreCount}\n\n` +
`*Fill & Submit Quotation Online Here:*\n` +
`👉 ${quoteUrl}\n\n` +
`_No login or password required. Click the link above to directly quote unit rates._\n\n` +
`Thank you,\nPurchase Department | DDPL`;
  };

  const handleCopyShareMessage = (vendor = null) => {
    const msg = buildShareMessage(vendor);
    navigator.clipboard.writeText(msg);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleCopyPortalLink = (vendorId = null) => {
    const quoteUrl = getDirectQuoteUrl(vendorId);
    navigator.clipboard.writeText(quoteUrl);
    setCopiedLink(true);
    if (vendorId) setCopiedVendorId(vendorId);
    setTimeout(() => {
      setCopiedLink(false);
      setCopiedVendorId(null);
    }, 2500);
  };

  const handleOpenDirectWhatsapp = async (vendor) => {
    if (!createdRfqDetails?.rfq_id && !pr?.linked_rfq?.rfq_id) {
      const confirmCreate = window.confirm(
        'RFQ has not been floated in the system yet. Would you like to approve and float the RFQ now before opening WhatsApp?'
      );
      if (!confirmCreate) return;
      const created = await handleSendRfqSubmit();
      if (!created) return;
    }
    const cleanPhone = (vendor?.phone || vendor?.vendor_phone || '').replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(buildShareMessage(vendor));
    const url = phoneWithCode
      ? `https://api.whatsapp.com/send?phone=${phoneWithCode}&text=${msg}`
      : `https://api.whatsapp.com/send?text=${msg}`;
    window.open(url, '_blank');
  };

  const handleOpenDirectEmail = async (vendor) => {
    if (!createdRfqDetails?.rfq_id && !pr?.linked_rfq?.rfq_id) {
      const confirmCreate = window.confirm(
        'RFQ has not been floated in the system yet. Would you like to approve and float the RFQ now before opening Email?'
      );
      if (!confirmCreate) return;
      const created = await handleSendRfqSubmit();
      if (!created) return;
    }
    const rfqNo = createdRfqDetails?.rfq_no || pr?.linked_rfq?.rfq_no || `RFQ for ${pr?.pr_no}`;
    const subject = `RFQ Invitation: ${rfqNo} - DDPL Group (${pr?.site_name || 'Project Site'})`;
    const body = buildShareMessage(vendor).replace(/\*/g, '');
    const emailTo = vendor?.email || vendor?.vendor_email || '';
    window.open(`mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const handleOpenGeneralWhatsapp = async () => {
    if (!createdRfqDetails?.rfq_id && !pr?.linked_rfq?.rfq_id) {
      const confirmCreate = window.confirm(
        'RFQ has not been floated in the system yet. Would you like to approve and float the RFQ now before opening WhatsApp?'
      );
      if (!confirmCreate) return;
      const created = await handleSendRfqSubmit();
      if (!created) return;
    }
    const winningObj = getWinningVendorObj();
    if (winningObj) {
      return handleOpenDirectWhatsapp(winningObj);
    }
    const msg = encodeURIComponent(buildShareMessage());
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  const handleOpenGeneralEmail = async () => {
    if (!createdRfqDetails?.rfq_id && !pr?.linked_rfq?.rfq_id) {
      const confirmCreate = window.confirm(
        'RFQ has not been floated in the system yet. Would you like to approve and float the RFQ now before opening Email?'
      );
      if (!confirmCreate) return;
      const created = await handleSendRfqSubmit();
      if (!created) return;
    }
    const winningObj = getWinningVendorObj();
    if (winningObj) {
      return handleOpenDirectEmail(winningObj);
    }
    const rfqNo = createdRfqDetails?.rfq_no || pr?.linked_rfq?.rfq_no || `RFQ for ${pr?.pr_no}`;
    const subject = `RFQ Invitation: ${rfqNo} - DDPL Group (${pr?.site_name || 'Project Site'})`;
    const body = buildShareMessage().replace(/\*/g, '');
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  // Shortlist Vendor Submission & Finalize Terms
  const handleOpenShortlistModal = async () => {
    setShowShortlistModal(true);

    const initialTerms = pr?.payment_terms || pr?.linked_rfq?.payment_terms || '20% Advance + 30 Days Credit';
    const initialAdv = pr?.advance_pct !== undefined && pr?.advance_pct !== null ? Number(pr.advance_pct) : 20;
    const initialCredit = pr?.credit_days !== undefined && pr?.credit_days !== null ? Number(pr.credit_days) : 30;
    const initialNotes = pr?.payment_terms_notes || pr?.linked_rfq?.payment_terms_notes || '';

    setPaymentTerms(initialTerms);
    setAdvancePct(initialAdv);
    setCreditDays(initialCredit);
    setPaymentNotes(initialNotes);

    try {
      const data = await masterService.getVendors();
      setVendors(data || []);
      if (pr.shortlisted_vendor_id) {
        setShortlistVendorId(String(pr.shortlisted_vendor_id));
      } else if (pr.linked_rfq?.winner_vendor_id) {
        setShortlistVendorId(String(pr.linked_rfq.winner_vendor_id));
      } else if (data && data.length > 0) {
        setShortlistVendorId(String(data[0].id));
      }
    } catch (e) {
      console.error('Error loading vendors:', e);
    }
  };

  const handleShortlistSubmit = async (e) => {
    e.preventDefault();
    if (!shortlistVendorId) {
      alert('Please select a vendor to shortlist.');
      return;
    }

    setSubmittingShortlist(true);
    try {
      await requisitionService.shortlistVendor(pr.id, {
        vendor_id: Number(shortlistVendorId),
        payment_terms: paymentTerms,
        advance_pct: Number(advancePct),
        credit_days: Number(creditDays),
        payment_terms_notes: paymentNotes
      });
      alert('Winning vendor shortlisted and commercial payment terms finalized! Vendor has been notified.');
      setShowShortlistModal(false);
      await fetchPrDetails();
    } catch (err) {
      alert(err.message || 'Failed to shortlist vendor');
    } finally {
      setSubmittingShortlist(false);
    }
  };

  // Proof upload handler
  const handleProofFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProofFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setProofFile(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Supervisor Mark Received
  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    if (!receivedQty) {
      alert('Please specify the received quantity.');
      return;
    }

    setSubmittingReceive(true);
    try {
      await requisitionService.receiveDelivery(pr.id, {
        received_qty: Number(receivedQty) || receivedQty,
        challan_no: receiveChallanNo || pr.challan_no || 'N/A',
        proof_file: proofFile,
        remarks: receiveRemarks,
        received_date: new Date().toISOString().split('T')[0]
      });
      alert('Delivery receipt confirmed! Purchase Manager and Project Coordinator have been notified.');
      setShowReceiveModal(false);
      await fetchPrDetails();
    } catch (err) {
      alert(err.message || 'Failed to record receipt');
    } finally {
      setSubmittingReceive(false);
    }
  };

  const filteredVendors = vendors.filter((v) => {
    if (!vendorSearch.trim()) return true;
    const q = vendorSearch.toLowerCase();
    return (v.name && v.name.toLowerCase().includes(q)) ||
           (v.phone && v.phone.includes(q)) ||
           (v.email && v.email.toLowerCase().includes(q));
  });

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading request details...
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ color: 'var(--danger-text)', margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Error Loading Request</h2>
        <p style={{ color: 'var(--text-muted)' }}>{error || 'Request not found'}</p>
        <Link to="/requisitions" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Requests
        </Link>
      </div>
    );
  }

  const isCoordinator = ['pc', 'admin'].includes(activeRole);
  const isPurchase = ['purchase', 'admin'].includes(activeRole);
  const isSupervisor = ['supervisor', 'admin'].includes(activeRole);
  const isDirector = ['director', 'admin'].includes(activeRole);

  return (
    <div>
      {/* Top Header & Role Action Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/requisitions" className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} />
            <span>Back to Requests</span>
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                {pr.pr_no}
              </h1>
              <span className="badge badge-issued" style={{ fontSize: '0.75rem' }}>
                {pr.status}
              </span>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Project Site: <strong>{pr.site_code} ({pr.site_name})</strong> • Raised by: <strong>{pr.requested_by_name}</strong> on {formatWorkflowDateTime(pr.created_at)}
            </span>
          </div>
        </div>

        {/* Dynamic Workflow Action Buttons per Role */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 1. PROJECT COORDINATOR ACTIONS */}
          {isCoordinator && ['Raised', 'Pending PC Approval', 'PR Raised'].includes(pr.status) && (
            <>
              {!isEditingItems ? (
                <button
                  onClick={handleStartEditingItems}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Edit3 size={15} />
                  <span>Edit Request</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEditingItems}
                    className="btn btn-secondary btn-sm"
                    disabled={savingItems}
                  >
                    Cancel Edit
                  </button>
                  <button
                    onClick={handleSaveItems}
                    className="btn btn-primary btn-sm"
                    disabled={savingItems}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Save size={15} />
                    <span>{savingItems ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              )}

              <button
                disabled={statusUpdateLoading || isEditingItems}
                onClick={handleCoordinatorApprove}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#059669', borderColor: '#059669', fontWeight: 600 }}
              >
                <CheckCircle2 size={15} />
                <span>Approve & Send to Purchase Department</span>
              </button>

              <button
                disabled={statusUpdateLoading || isEditingItems}
                onClick={() => handleOpenDeclineModal('pc')}
                className="btn btn-danger btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <XCircle size={15} />
                <span>Decline</span>
              </button>
            </>
          )}

          {/* 2. PURCHASE DEPARTMENT ACTIONS */}
          {isPurchase && ['Sent to Purchase', 'Coordinator Approved'].includes(pr.status) && (
            <>
              {!isEditingItems ? (
                <button
                  onClick={handleStartEditingItems}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Edit3 size={15} />
                  <span>Edit Request</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEditingItems}
                    className="btn btn-secondary btn-sm"
                    disabled={savingItems}
                  >
                    Cancel Edit
                  </button>
                  <button
                    onClick={handleSaveItems}
                    className="btn btn-primary btn-sm"
                    disabled={savingItems}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Save size={15} />
                    <span>{savingItems ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              )}

              <button
                disabled={isEditingItems}
                onClick={handleOpenSendModal}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
              >
                <Send size={15} />
                <span>Float RFQ to Vendors</span>
              </button>

              <button
                disabled={isEditingItems}
                onClick={() => handleOpenDeclineModal('purchase')}
                className="btn btn-danger btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <XCircle size={15} />
                <span>Decline</span>
              </button>
            </>
          )}

          {isPurchase && ['Raised', 'PR Raised', 'Pending PC Approval', 'Draft'].includes(pr.status) && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
              <Clock size={14} />
              <span>Awaiting Project Coordinator approval before Purchase can float RFQ</span>
            </div>
          )}

          {/* 2B. PURCHASE SHARE ACTIVE RFQ VIA WHATSAPP & PORTAL (Before Director Approval) */}
          {isPurchase && !['Sent to Purchase', 'Coordinator Approved', 'PR Raised', 'Raised', 'Draft', 'Coordinator Declined', 'Purchase Declined', 'Vendor Shortlisted', 'PO Issued'].includes(pr.status) && (
            <button
              onClick={handleOpenShareModal}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' }}
              title="Share RFQ via WhatsApp or Copy Link"
            >
              <Share2 size={15} />
              <span>Share RFQ (WhatsApp / Link)</span>
            </button>
          )}

          {/* 3. PURCHASE SHORTLIST VENDOR (After Director Approved) */}
          {isPurchase && ['Director Approved', 'Approved'].includes(pr.status) && (
            <button
              onClick={handleOpenShortlistModal}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#7c3aed', borderColor: '#7c3aed', fontWeight: 600 }}
            >
              <Award size={15} />
              <span>Confirm Winner & Finalize Terms</span>
            </button>
          )}

          {/* 3B. SHARE ORDER CONFIRMATION LINK (After Vendor Shortlisted) */}
          {isPurchase && ['Vendor Shortlisted', 'PO Issued'].includes(pr.status) && (
            <button
              onClick={handleOpenShareModal}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }}
              title="Share Order Confirmation with Winning Vendor"
            >
              <Share2 size={15} />
              <span>Share Order Confirmation (WhatsApp / Link)</span>
            </button>
          )}

          {/* 3C. RE-OPEN & RE-SHARE LINK FOR CORRECTIONS (If vendor made mistake) */}
          {isPurchase && (pr.challan_no || pr.dispatch_date || ['Dispatched', 'Received'].includes(pr.status)) && (
            <button
              onClick={handleReopenDispatchLink}
              disabled={reopeningDispatch}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#b45309', borderColor: '#fde68a', background: '#fffbeb', fontWeight: 600 }}
              title="Unlock submission link so vendor can correct wrong Challan, Bill, or Date details"
            >
              <Edit3 size={15} />
              <span>{reopeningDispatch ? 'Re-opening...' : 'Re-open Link for Vendor Correction'}</span>
            </button>
          )}

          {/* 4. SITE SUPERVISOR RECEIVE MATERIAL (When Dispatched) */}
          {isSupervisor && pr.status === 'Dispatched' && (
            <button
              onClick={() => setShowReceiveModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#059669', borderColor: '#059669', fontWeight: 600 }}
            >
              <Package size={15} />
              <span>Mark Material Received & Upload Proof</span>
            </button>
          )}

          {/* Director Quick View RFQ Link */}
          {isDirector && pr.linked_rfq && (
            <Link
              to={`/rfqs/${pr.linked_rfq.rfq_id}`}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Eye size={15} />
              <span>View Bid Comparison Matrix</span>
            </Link>
          )}
        </div>
      </div>

      {/* Decline Reason Alert if Declined */}
      {pr.decline_reason && ['Coordinator Declined', 'Purchase Declined', 'Director Declined'].includes(pr.status) && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertCircle size={20} style={{ color: '#b91c1c', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#b91c1c', fontSize: '0.95rem' }}>Request Declined:</strong>
            <p style={{ margin: '0.25rem 0 0', color: '#7f1d1d', fontSize: '0.9rem' }}>
              {pr.decline_reason}
            </p>
            <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '0.35rem' }}>
              Declined by <strong>{pr.declined_by || 'Reviewer'}</strong> on {formatWorkflowDateTime(pr.declined_at)}
            </div>
          </div>
        </div>
      )}

      {/* Shortlisted Vendor Banner */}
      {pr.shortlisted_vendor_name && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} style={{ color: '#16a34a' }} />
            <div>
              <strong style={{ color: '#15803d', fontSize: '0.95rem' }}>Shortlisted Winning Vendor:</strong>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#166534' }}>
                {pr.shortlisted_vendor_name}
              </div>
            </div>
          </div>
          <span className="badge badge-verified" style={{ background: '#dcfce7', color: '#15803d' }}>
            Selected Supplier
          </span>
        </div>
      )}

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem' }}>{pr.status}</div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Project Site</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {pr.site_code}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{pr.site_name}</div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Requested By</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem' }}>{pr.requested_by_name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{pr.requested_by_role || 'Site Supervisor'}</div>
        </div>

        {(pr.target_director_name || pr.approved_by) && (
          <div className="card" style={{ marginBottom: 0, borderLeft: '3px solid #d97706' }}>
            <div style={{ fontSize: '0.75rem', color: '#b45309', textTransform: 'uppercase', fontWeight: 600 }}>Designated Director</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem', color: '#92400e' }}>
              {pr.target_director_name || pr.approved_by}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Commercial Reviewer</div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Required-by Date</div>
          {isEditingItems ? (
            <input
              type="date"
              className="form-control"
              style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
              value={editRequiredByDate}
              onChange={(e) => setEditRequiredByDate(e.target.value)}
            />
          ) : (
            <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem' }}>
              {formatWorkflowDate(pr.required_by_date)}
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Raised Date & Time</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {formatWorkflowDateTime(pr.created_at)}
          </div>
        </div>
      </div>

      {/* Commercial & Payment Terms Card (Displayed ONLY after Director approval / Vendor Shortlisted) */}
      {!['supervisor', 'pc'].includes(activeRole) && ['Director Approved', 'Approved', 'Vendor Shortlisted', 'PO Issued', 'Dispatched', 'Received'].includes(pr.status) && (pr.payment_terms || pr.advance_pct > 0 || pr.credit_days > 0 || pr.linked_rfq?.payment_terms) && (
        <div className="card" style={{ 
          marginBottom: '1.5rem', 
          background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)', 
          border: '1.5px solid #86efac',
          padding: '1rem 1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontSize: '1.3rem' }}>💳</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  Finalized Commercial & Payment Terms
                </h4>
                <span style={{ fontSize: '0.75rem', color: '#166534' }}>
                  Agreed with Shortlisted Vendor (Approved by Director)
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ 
                background: '#15803d', 
                color: '#fff', 
                padding: '0.2rem 0.65rem', 
                borderRadius: '12px', 
                fontSize: '0.78rem', 
                fontWeight: 700 
              }}>
                ✓ {pr.payment_terms || pr.linked_rfq?.payment_terms || 'Standard Terms'}
              </span>
              {isPurchase && (
                <button
                  type="button"
                  onClick={handleOpenShortlistModal}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                >
                  <Edit3 size={13} /> Edit Terms
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <div style={{ background: '#fff', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Advance Payment:</span>
              <strong style={{ fontSize: '0.88rem', color: '#15803d' }}>
                {Number(pr.advance_pct ?? pr.linked_rfq?.advance_pct) > 0 ? `${pr.advance_pct ?? pr.linked_rfq?.advance_pct}% Advance` : '0% (Nil Advance)'}
              </strong>
            </div>

            <div style={{ background: '#fff', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Credit Period:</span>
              <strong style={{ fontSize: '0.88rem', color: '#1d4ed8' }}>
                {pr.credit_days ?? pr.linked_rfq?.credit_days ?? 30} Days Credit
              </strong>
            </div>

            {(pr.payment_terms_notes || pr.linked_rfq?.payment_terms_notes) && (
              <div style={{ background: '#fff', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #fed7aa', flex: 1, minWidth: '240px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: 600 }}>Notes:</span>
                <span style={{ fontSize: '0.8rem', color: '#7c2d12', fontWeight: 500 }}>
                  {pr.payment_terms_notes || pr.linked_rfq?.payment_terms_notes}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remarks Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Remarks / Site Justification</h4>
        {isEditingItems ? (
          <textarea
            className="form-control"
            rows={2}
            value={editRemarks}
            onChange={(e) => setEditRemarks(e.target.value)}
            placeholder="Edit site remarks or notes..."
          />
        ) : (
          <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', margin: 0 }}>
            {pr.remarks || 'No remarks provided.'}
          </p>
        )}
      </div>

      {/* Shipment & Dispatch Details (When Dispatched or Received) */}
      {(pr.dispatch_date || pr.challan_no || pr.linked_po) && (
        <div 
          className="card" 
          style={{ 
            marginBottom: '1.5rem', 
            background: ['Dispatched', 'Received'].includes(pr.status) ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)' : '#f8fafc',
            border: '1px solid #86efac'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '8px', 
                background: '#10b981',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Truck size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  Delivery & Dispatch Tracking
                </h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Supplier: <strong>{pr.shortlisted_vendor_name || pr.linked_po?.vendor_name || 'Vendor'}</strong>
                </div>
              </div>
            </div>

            <span className="badge badge-verified" style={{ background: '#ecfdf5', color: '#047857' }}>
              {pr.status === 'Received' ? '✓ Received at Site' : '🚚 Dispatched / In Transit'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: '#ffffff', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                📅 Dispatch Date
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>
                {formatWorkflowDate(pr.dispatch_date || pr.linked_po?.dispatch_date)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                📄 Challan / Invoice No
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-600)', marginTop: '0.2rem' }}>
                {pr.challan_no || pr.linked_po?.challan_no || '—'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                🚚 Vehicle / Transport
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem' }}>
                {pr.vehicle_no ? `${pr.vehicle_no} (${pr.transport_name || 'Direct'})` : 'Standard Transport'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                📦 Dispatched Qty
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>
                {pr.dispatched_qty || 'Complete shipment'}
              </div>
            </div>
          </div>

          {/* Purchase Manager Actions: Re-open Link for Correction or Re-share */}
          {isPurchase && (
            <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.82rem', color: pr.dispatch_link_reopened ? '#b45309' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {pr.dispatch_link_reopened ? (
                  <>
                    <AlertCircle size={14} color="#b45309" />
                    <strong>Link is Reopened:</strong> Vendor can now update and re-submit dispatch info.
                  </>
                ) : (
                  <span>Wrong information submitted? Re-open the link to allow the vendor to correct challan/bill details.</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleReopenDispatchLink}
                  disabled={reopeningDispatch}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#b45309', borderColor: '#fde68a', background: '#fffbeb', fontWeight: 600 }}
                  title="Unlock submission link so vendor can edit incorrect information"
                >
                  <Edit3 size={13} />
                  <span>{reopeningDispatch ? 'Re-opening...' : 'Allow Vendor Correction (Re-open Link)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenShareModal}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4', fontWeight: 600 }}
                  title="Re-share link to vendor via WhatsApp or Email"
                >
                  <Share2 size={13} />
                  <span>Re-share Link to Vendor</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verified Delivery Receipt Card (Visible to Director, Purchase Manager, and Supervisors) */}
      {pr.delivery_receipt && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#166534' }}>
                Site Material Verification & Receipt Proof (Challan & Inspection Photos)
              </h4>
            </div>
            {pr.delivery_receipt.challan_no && (
              <span className="badge badge-verified" style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                Challan: {pr.delivery_receipt.challan_no}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#ffffff', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #bbf7d0', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Received By</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{pr.delivery_receipt.received_by || 'Site Supervisor'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatWorkflowDateTime(pr.delivery_receipt.received_at)}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Verified Quantity</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#15803d' }}>
                {pr.delivery_receipt.received_qty || 'Complete shipment'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inspection Remarks</div>
              <div style={{ fontSize: '0.85rem' }}>{pr.delivery_receipt.remark || 'Physical inspection verified'}</div>
            </div>

            {pr.delivery_receipt.proof_file && (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Supervisor Proof</div>
                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img
                    src={pr.delivery_receipt.proof_file}
                    alt="Delivery Proof"
                    onClick={() => setPreviewPhoto(pr.delivery_receipt.proof_file)}
                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #86efac' }}
                    title="Click to view full proof"
                  />
                  <button
                    type="button"
                    onClick={() => handleDownloadPhoto(pr.delivery_receipt.proof_file, `Supervisor_Proof_${pr.pr_no}`)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    title="Download supervisor verification proof"
                  >
                    <Download size={12} />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Damaged items or Defect alert if reported */}
          {(() => {
            const dmgItems = Array.isArray(pr.delivery_receipt.damaged_items) ? pr.delivery_receipt.damaged_items : [];
            const dmgPhotos = Array.isArray(pr.delivery_receipt.damage_photos) ? pr.delivery_receipt.damage_photos : [];
            const hasDamage = dmgItems.length > 0 || dmgPhotos.length > 0;
            if (!hasDamage) return null;
            return (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#9f1239' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                  <AlertCircle size={16} />
                  <span>Defective / Damaged Pieces Reported at Site</span>
                </div>
                {pr.delivery_receipt.damage_remarks && (
                  <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                    <strong>Defect Description:</strong> {pr.delivery_remarks || pr.delivery_receipt.damage_remarks}
                  </div>
                )}
                {dmgItems.length > 0 && (
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {dmgItems.map((it, idx) => (
                      <span key={idx} style={{ marginRight: '0.75rem', fontWeight: 600 }}>
                        • {it.description}: {it.damaged_qty} {it.unit} damaged
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Uploaded Photos Showcase (Challan, Material, Damage) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {/* 1. Vendor Challan Photos */}
            {(() => {
              const chPhotos = Array.isArray(pr.delivery_receipt.challan_photos) ? pr.delivery_receipt.challan_photos : [];
              return (
                <div style={{ background: '#ffffff', borderRadius: '8px', padding: '0.85rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                      📄 Vendor Challan Photos
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chPhotos.length} photo(s)</span>
                      {chPhotos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleDownloadAllPhotos(chPhotos, `Challan_${pr.challan_no || pr.pr_no || 'doc'}`)}
                          style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.15rem 0.45rem',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}
                          title="Download all challan photos"
                        >
                          <Download size={11} />
                          <span>Save All</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {chPhotos.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No separate challan photos attached</div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {chPhotos.map((p, idx) => {
                        const src = p.dataUrl || p.url || p;
                        return (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img
                              src={src}
                              alt={p.name || `Challan ${idx + 1}`}
                              onClick={() => setPreviewPhoto(src)}
                              style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                              title="Click to view full challan image"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. Received Material / Goods Photos */}
            {(() => {
              const matPhotos = Array.isArray(pr.delivery_receipt.material_photos) ? pr.delivery_receipt.material_photos : [];
              return (
                <div style={{ background: '#ffffff', borderRadius: '8px', padding: '0.85rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                      📷 Received Material Goods Photos
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{matPhotos.length} photo(s)</span>
                      {matPhotos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleDownloadAllPhotos(matPhotos, `Goods_${pr.challan_no || pr.pr_no || 'doc'}`)}
                          style={{
                            background: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.15rem 0.45rem',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}
                          title="Download all goods photos"
                        >
                          <Download size={11} />
                          <span>Save All</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {matPhotos.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No goods photos attached</div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {matPhotos.map((p, idx) => {
                        const src = p.dataUrl || p.url || p;
                        return (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img
                              src={src}
                              alt={p.name || `Material ${idx + 1}`}
                              onClick={() => setPreviewPhoto(src)}
                              style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                              title="Click to view full material image"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 3. Damage / Defective Photos */}
            {(() => {
              const dmgPhotos = Array.isArray(pr.delivery_receipt.damage_photos) ? pr.delivery_receipt.damage_photos : [];
              if (dmgPhotos.length === 0) return null;
              return (
                <div style={{ background: '#fff1f2', borderRadius: '8px', padding: '0.85rem', border: '1px solid #fda4af' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#9f1239' }}>
                      ⚠️ Defective / Damaged Item Photos
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#be123c', fontWeight: 600 }}>{dmgPhotos.length} photo(s)</span>
                      <button
                        type="button"
                        onClick={() => handleDownloadAllPhotos(dmgPhotos, `Damage_${pr.challan_no || pr.pr_no || 'doc'}`)}
                        style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.15rem 0.45rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem'
                        }}
                        title="Download all damage photos"
                      >
                        <Download size={11} />
                        <span>Save All</span>
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {dmgPhotos.map((p, idx) => {
                      const src = p.dataUrl || p.url || p;
                      return (
                        <div key={idx} style={{ position: 'relative' }}>
                          <img
                            src={src}
                            alt={p.name || `Defect ${idx + 1}`}
                            onClick={() => setPreviewPhoto(src)}
                            style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #f43f5e', cursor: 'pointer' }}
                            title="Click to view full defect image"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Material Line Items Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700 }}>
              Requested Material Items ({isEditingItems ? editableItems.length : (pr.items?.length || 0)})
            </span>
            {isEditingItems && (
              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                ✏️ {isPurchase ? 'Purchase Department Edit Mode' : 'Coordinator Edit Mode'}
              </span>
            )}
          </div>

          {isEditingItems && (
            <button
              type="button"
              onClick={handleAddItem}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={14} />
              <span>Add Line Item</span>
            </button>
          )}
        </div>

        {isEditingItems ? (
          /* Coordinator Editable Table */
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>#</th>
                  <th style={{ width: '40%' }}>Description *</th>
                  <th style={{ width: '25%' }}>Specification</th>
                  <th style={{ width: '12%' }}>Unit *</th>
                  <th style={{ width: '12%' }}>Quantity *</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {editableItems.map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Material description..."
                        value={item.description}
                        onChange={(e) => handleItemFieldChange(index, 'description', e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Grade, spec, IS code..."
                        value={item.spec}
                        onChange={(e) => handleItemFieldChange(index, 'spec', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="form-control"
                        value={item.unit}
                        onChange={(e) => handleItemFieldChange(index, 'unit', e.target.value)}
                      >
                        <option value="Nos">Nos</option>
                        <option value="Bag">Bag</option>
                        <option value="Brass">Brass</option>
                        <option value="Ton">Ton</option>
                        <option value="Kg">Kg</option>
                        <option value="Liter">Liter</option>
                        <option value="Sq.Ft">Sq.Ft</option>
                        <option value="R.Ft">R.Ft</option>
                        <option value="Meter">Meter</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="form-control"
                        value={item.quantity}
                        onChange={(e) => handleItemFieldChange(index, 'quantity', e.target.value)}
                        required
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(index)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.25rem 0.4rem' }}
                        title="Remove Item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Display Table */
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>#</th>
                  <th>Material Description</th>
                  <th>Specification</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  {['purchase', 'admin', 'director'].includes(activeRole) && (
                    <th style={{ minWidth: '140px' }}>
                      {['Director Approved', 'Approved', 'Vendor Shortlisted', 'PO Issued', 'Dispatched', 'Received', 'Site Verified'].includes(pr.status) || Boolean(pr.linked_po)
                        ? 'Final Approved Rate'
                        : 'Est. Rate'}
                    </th>
                  )}
                  {['purchase', 'admin', 'director'].includes(activeRole) && (
                    <th style={{ minWidth: '130px', textAlign: 'right' }}>
                      {['Director Approved', 'Approved', 'Vendor Shortlisted', 'PO Issued', 'Dispatched', 'Received', 'Site Verified'].includes(pr.status) || Boolean(pr.linked_po)
                        ? 'Approved Total'
                        : 'Est. Total'}
                    </th>
                  )}
                  <th style={{ width: '8%' }}>Photos</th>
                </tr>
              </thead>
              <tbody>
                {pr.items?.map((item, index) => {
                  const showRates = ['purchase', 'admin', 'director'].includes(activeRole);
                  const isApprovedStatus = ['Director Approved', 'Approved', 'Vendor Shortlisted', 'PO Issued', 'Dispatched', 'Received', 'Site Verified'].includes(pr.status) || Boolean(pr.linked_po);
                  const finalRate = Number(item.approved_rate !== null && item.approved_rate !== undefined && Number(item.approved_rate) > 0 ? item.approved_rate : (item.est_rate || 0));
                  const total = (Number(item.quantity) * Number(finalRate)).toFixed(2);

                  return (
                    <tr key={item.id || index}>
                      <td>{index + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.description}</div>
                        {item.is_custom ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--warning-text)', marginTop: '0.2rem' }}>
                            Custom Item {item.justification ? `• ${item.justification}` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td>{item.spec || '—'}</td>
                      <td>{item.unit}</td>
                      <td style={{ fontWeight: 600 }}>{Number(parseFloat(item.quantity || 0))}</td>
                      {showRates && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: isApprovedStatus && finalRate > 0 ? '#059669' : 'inherit', fontSize: '0.95rem' }}>
                              ₹{Number(finalRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {isApprovedStatus && finalRate > 0 && (
                              <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                                ✓ Approved Rate
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {showRates && (
                        <td style={{ textAlign: 'right', fontWeight: 800, color: isApprovedStatus && finalRate > 0 ? '#059669' : 'inherit', fontSize: '0.95rem' }}>
                          ₹{Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      )}
                      <td>
                        {item.photos && item.photos.length > 0 ? (
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {item.photos.map((p, pIdx) => (
                              <img
                                key={pIdx}
                                src={p.dataUrl || p}
                                alt="Attachment"
                                onClick={() => setPreviewPhoto(p.dataUrl || p)}
                                style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                title="Click to zoom"
                              />
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Commercial & Financial Summary Card for Approved Requisition */}
        {['purchase', 'admin', 'director'].includes(activeRole) && (['Director Approved', 'Approved', 'Vendor Shortlisted', 'PO Issued', 'Dispatched', 'Received', 'Site Verified'].includes(pr.status) || Boolean(pr.linked_po)) && (
          <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              {pr.shortlisted_vendor_name && (
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Selected Winning Vendor: </span>
                  <strong style={{ color: '#166534' }}>{pr.shortlisted_vendor_name}</strong>
                </div>
              )}
              {(pr.target_director_name || pr.approved_by) && (
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Authorized Director: </span>
                  <strong style={{ color: '#b45309' }}>{pr.target_director_name || pr.approved_by}</strong>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Basic Subtotal</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  ₹{Number(pr.approved_subtotal || pr.items?.reduce((s, it) => s + (Number(it.quantity) * Number(it.approved_rate || it.est_rate || 0)), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>GST (18%)</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                  ₹{Number(pr.approved_gst || Math.round((Number(pr.approved_subtotal || 0)) * 0.18 * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ textAlign: 'right', paddingLeft: '1.25rem', borderLeft: '2px solid #cbd5e1' }}>
                <div style={{ fontSize: '0.72rem', color: '#059669', textTransform: 'uppercase', fontWeight: 700 }}>Total Approved Value</div>
                <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#059669' }}>
                  ₹{Number(pr.approved_total || Math.round((Number(pr.approved_subtotal || 0) * 1.18) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coordinator Edit History Table (Collapsible Accordion) */}
      {pr.requisition_edits && pr.requisition_edits.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem', padding: 0, overflow: 'hidden' }}>
          <div 
            onClick={() => setShowCoordinatorHistory(!showCoordinatorHistory)}
            style={{ 
              padding: '0.85rem 1.25rem', 
              borderBottom: showCoordinatorHistory ? '1px solid var(--border-color)' : 'none', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              background: '#f8fafc',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <History size={16} style={{ color: 'var(--primary-600)' }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Coordinator Edit History</h4>
              <span style={{ fontSize: '0.75rem', background: '#e2e8f0', color: '#334155', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
                {pr.requisition_edits.length} change(s)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
              <span>{showCoordinatorHistory ? 'Click to collapse' : 'Click to expand'}</span>
              <ChevronDown size={16} style={{ transform: showCoordinatorHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
          </div>
          {showCoordinatorHistory && (
            <div className="table-responsive">
              <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Field / Property</th>
                    <th>Previous Value</th>
                    <th>New Value</th>
                    <th>Edited By</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {pr.requisition_edits.map((ed) => (
                    <tr key={ed.id}>
                      <td><strong>{ed.field}</strong></td>
                      <td style={{ color: '#b91c1c' }}>{ed.old_value || 'None'}</td>
                      <td style={{ color: '#047857', fontWeight: 600 }}>{ed.new_value}</td>
                      <td>{ed.edited_by}</td>
                      <td>{formatWorkflowDateTime(ed.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Complete Status Transition History & Audit Trail (Collapsible Accordion) */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: 0, overflow: 'hidden' }}>
        <div 
          onClick={() => setShowStatusHistory(!showStatusHistory)}
          style={{ 
            padding: '0.85rem 1.25rem', 
            borderBottom: showStatusHistory ? '1px solid var(--border-color)' : 'none', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: '#f8fafc',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Clock size={16} style={{ color: 'var(--primary-600)' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
              Status Change History & Audit Trail
            </h4>
            <span style={{ fontSize: '0.75rem', background: '#e2e8f0', color: '#334155', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
              {pr.status_history?.length || 0} entry(ies)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>{showStatusHistory ? 'Click to collapse' : 'Click to expand'}</span>
            <ChevronDown size={16} style={{ transform: showStatusHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
        </div>

        {showStatusHistory && (
          pr.status_history && pr.status_history.length > 0 ? (
            <div className="table-responsive">
              <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Action / Status</th>
                    <th>Actor (Name & Role)</th>
                    <th>Remark / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {pr.status_history.map((sh) => (
                    <tr key={sh.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {formatWorkflowDateTime(sh.created_at)}
                      </td>
                      <td>
                        <span className="badge badge-issued" style={{ fontSize: '0.75rem' }}>
                          {sh.to_status}
                        </span>
                      </td>
                      <td>
                        <strong>{sh.action_by}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem', textTransform: 'uppercase' }}>
                          ({sh.role})
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {sh.remark || 'Status updated'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              No status transition logs recorded yet.
            </div>
          )
        )}
      </div>

      {/* Decline Modal (Reason Required) */}
      {showDeclineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#b91c1c' }}>
                  Decline Request {pr.pr_no}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Please supply the decline reason below. This is required and will be notified to the requester.
                </p>
              </div>
              <button onClick={() => setShowDeclineModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleSubmitDecline}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Decline Reason *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  required
                  placeholder="Specify clear reason for declining (e.g. Incomplete specifications, budget not allocated, duplicate PR)..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDeclineModal(false)}
                  className="btn btn-secondary"
                  disabled={submittingDecline}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={submittingDecline || !declineReason.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <XCircle size={15} />
                  <span>{submittingDecline ? 'Declining...' : 'Confirm Decline'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supervisor Material Receive Modal */}
      {showReceiveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '580px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#047857' }}>
                  Confirm Material Receipt at Site
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Target Request: <strong>{pr.pr_no}</strong> • Site: <strong>{pr.site_name}</strong>
                </p>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleReceiveSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Received Quantity *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. 50 Bags / 100% complete"
                    value={receivedQty}
                    onChange={(e) => setReceivedQty(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Challan / Invoice No</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Challan No..."
                    value={receiveChallanNo}
                    onChange={(e) => setReceiveChallanNo(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Upload Receipt Proof (Challan Photo / PDF)</label>
                <div style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', textAlign: 'center', background: '#f8fafc' }}>
                  <input
                    type="file"
                    id="receiptProof"
                    accept="image/*,application/pdf"
                    onChange={handleProofFileUpload}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="receiptProof" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-600)', fontWeight: 600 }}>
                    <Upload size={18} />
                    <span>{proofFileName ? `Selected: ${proofFileName}` : 'Choose Challan Photo or PDF'}</span>
                  </label>
                  {proofFile && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span className="badge badge-verified">Proof file attached</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Physical Inspection Remarks</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={receiveRemarks}
                  onChange={(e) => setReceiveRemarks(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="btn btn-secondary"
                  disabled={submittingReceive}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReceive || !receivedQty}
                  style={{ background: '#059669', borderColor: '#059669', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                >
                  <Package size={15} />
                  <span>{submittingReceive ? 'Recording Receipt...' : 'Confirm Receipt & Notify Team'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shortlist Vendor Modal (Purchase Manager - Finalize Terms with Winner) */}
      {showShortlistModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '620px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#7c3aed' }}>
                  Confirm Winning Vendor & Finalize Terms
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Director has approved. Finalize the commercial payment terms to be issued and shared with the selected supplier.
                </p>
              </div>
              <button onClick={() => setShowShortlistModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleShortlistSubmit}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Select Winning Vendor *</label>
                <select
                  className="form-control"
                  value={shortlistVendorId}
                  onChange={(e) => setShortlistVendorId(e.target.value)}
                  required
                >
                  <option value="">Select Vendor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.gstin ? `(${v.gstin})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Commercial Payment Terms (Finalized for Winning Vendor) */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>💳 Payment Terms Template / Preset</span>
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click to auto-fill terms</span>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {[
                    '20% Advance + 30 Days Credit',
                    '10% Advance + 30 Days Credit',
                    'Net 30 Days Credit',
                    'Net 15 Days Credit',
                    'Net 45 Days Credit',
                    '100% on Delivery'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyTermsPreset(preset)}
                      className={`btn btn-sm ${paymentTerms === preset ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Advance Payment (%) *</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-control"
                      value={advancePct}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setAdvancePct(val);
                        setPaymentTerms(`${val}% Advance + ${creditDays} Days Credit`);
                      }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Credit Period (Days) *</label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      className="form-control"
                      value={creditDays}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setCreditDays(val);
                        setPaymentTerms(`${advancePct}% Advance + ${val} Days Credit`);
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Payment Terms Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="e.g. 20% Advance + 30 Days Credit"
                  />
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Commercial Conditions / Notes (Optional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="e.g. GST 18% extra, Freight included to site..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowShortlistModal(false)}
                  className="btn btn-secondary"
                  disabled={submittingShortlist}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingShortlist || !shortlistVendorId}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                >
                  <Award size={15} />
                  <span>{submittingShortlist ? 'Finalizing...' : 'Confirm Winner & Finalize Terms'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Float RFQ Modal (Purchase Department) */}
      {showSendModal && (
        <div 
          onClick={() => setShowSendModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem', cursor: 'pointer' }}
        >
          <div 
            className="card" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '820px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', padding: 0, cursor: 'default' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', padding: '1.25rem 1.5rem', background: 'var(--card-bg)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                      Float RFQ to Suppliers
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                      Request: <strong style={{ color: 'var(--primary-700)' }}>{pr.pr_no}</strong> • Site: <strong>{pr.site_code} ({pr.site_name})</strong>
                    </p>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowSendModal(false)} className="close-btn" style={{ fontSize: '1.5rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#f8fafc', padding: '0 1.5rem' }}>
              <button
                type="button"
                onClick={() => setActiveSendTab('terms')}
                style={{
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderBottom: activeSendTab === 'terms' ? '3px solid var(--primary-600)' : '3px solid transparent',
                  color: activeSendTab === 'terms' ? 'var(--primary-700)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <span>1. Select Suppliers & Deadline</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSendTab('share')}
                style={{
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderBottom: activeSendTab === 'share' ? '3px solid #16a34a' : '3px solid transparent',
                  color: activeSendTab === 'share' ? '#15803d' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <Share2 size={16} />
                <span>2. Share with Vendors (WhatsApp & Portal)</span>
                {pr?.linked_rfq && (
                  <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>Active</span>
                )}
              </button>
            </div>

            {/* TAB 1: TARGET SUPPLIERS & DEADLINE */}
            {activeSendTab === 'terms' && (
              <form onSubmit={handleSendRfqSubmit} style={{ padding: '1.5rem' }}>

                {/* Quotation Submission Deadline */}
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={15} />
                    <span>Quotation Submission Deadline *</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      className="form-control"
                      style={{ maxWidth: '200px' }}
                      value={deadline}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setDeadline(e.target.value)}
                      required
                    />
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button" onClick={() => setDeadlinePreset(3)} className="btn btn-secondary btn-sm">+3 Days</button>
                      <button type="button" onClick={() => setDeadlinePreset(7)} className="btn btn-secondary btn-sm">+7 Days</button>
                      <button type="button" onClick={() => setDeadlinePreset(14)} className="btn btn-secondary btn-sm">+14 Days</button>
                    </div>
                  </div>
                </div>

                {/* Target Vendors Selection */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                      Select Target Suppliers ({selectedVendorIds.length} of {vendors.length} selected) *
                    </label>
                    <button
                      type="button"
                      onClick={handleToggleAllVendors}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    >
                      {selectedVendorIds.length === vendors.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Filter vendors by name, phone or email..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}
                  />

                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', background: '#f8fafc' }}>
                    {filteredVendors.map((v) => {
                      const isChecked = selectedVendorIds.includes(v.id);
                      return (
                        <div
                          key={v.id}
                          onClick={() => handleToggleVendor(v.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: isChecked ? '#eff6ff' : '#ffffff',
                            border: `1px solid ${isChecked ? 'var(--primary-200)' : 'var(--border-color)'}`,
                            marginBottom: '0.35rem'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
                          />
                          <div style={{ flex: 1 }}>
                            <strong style={{ fontSize: '0.9rem', color: isChecked ? 'var(--primary-700)' : 'var(--text-primary)' }}>
                              {v.name}
                            </strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              GSTIN: {v.gstin || '—'} {v.phone ? `• 📞 ${v.phone}` : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveSendTab('share')}
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a' }}
                  >
                    <Share2 size={15} />
                    <span>Preview Share Links</span>
                  </button>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowSendModal(false)}
                      className="btn btn-secondary"
                      disabled={submittingRfq}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submittingRfq || selectedVendorIds.length === 0}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                    >
                      <Send size={15} />
                      <span>{submittingRfq ? 'Saving & Sending...' : `Approve & Send RFQ to ${selectedVendorIds.length} Vendor(s)`}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: SHARE WITH VENDORS (WHATSAPP & PORTAL) */}
            {activeSendTab === 'share' && (
              <div style={{ padding: '1.5rem' }}>
                {!(createdRfqDetails?.rfq_id || pr.linked_rfq?.rfq_id) ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: '#f59e0b', color: '#fff', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertCircle size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, color: '#92400e', fontSize: '0.95rem', fontWeight: 800 }}>
                          ⚠️ RFQ Not Floated in System Yet!
                        </h4>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#78350f' }}>
                          Target Request: <strong>{pr.pr_no}</strong>. Please float the RFQ to enable vendors to quote online.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendRfqSubmit()}
                      disabled={submittingRfq || selectedVendorIds.length === 0}
                      className="btn btn-primary btn-sm"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Send size={14} />
                      <span>{submittingRfq ? 'Floating RFQ...' : `Float RFQ to ${selectedVendorIds.length} Vendor(s) Now`}</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ background: '#22c55e', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, color: '#15803d', fontSize: '0.95rem', fontWeight: 800 }}>
                        RFQ Floating & Sharing Hub
                      </h4>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#166534' }}>
                        Target Request: <strong>{pr.pr_no}</strong> • RFQ: <strong>{createdRfqDetails?.rfq_no || pr.linked_rfq?.rfq_no}</strong>. Share directly to supplier WhatsApp or copy invite message.
                      </p>
                    </div>
                  </div>
                )}

                {/* Commercial Terms Summary (Shown only when finalized after Director Approval) */}
                {['Director Approved', 'Approved', 'Vendor Shortlisted', 'PO Issued'].includes(pr?.status) && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 600 }}>
                      💳 Agreed Terms: {pr?.payment_terms || paymentTerms}
                    </span>
                    <span style={{ fontSize: '0.8rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 600 }}>
                      💰 Advance: {pr?.advance_pct ?? advancePct}%
                    </span>
                    <span style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 600 }}>
                      ⏱ Credit: {pr?.credit_days ?? creditDays} Days
                    </span>
                  </div>
                )}

                {/* Quick Sharing Action Row */}
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={handleOpenGeneralWhatsapp}
                    className="btn btn-primary"
                    style={{ background: '#25D366', borderColor: '#25D366', color: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <MessageSquare size={16} />
                    <span>Send via WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenGeneralEmail}
                    className="btn btn-secondary"
                    style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#2563eb' }}
                  >
                    <Mail size={16} />
                    <span>Send via Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyShareMessage()}
                    className="btn btn-secondary"
                    style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <Copy size={15} />
                    <span>{copiedText ? 'Copied Invitation Text!' : 'Copy Formatted Text'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyPortalLink(null)}
                    className="btn btn-secondary"
                    style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <ExternalLink size={15} />
                    <span>{copiedLink && !copiedVendorId ? 'Copied Link!' : 'Copy Quotation Link'}</span>
                  </button>
                </div>

                {/* Direct Share Buttons per Supplier */}
                {(() => {
                  const winningObj = getWinningVendorObj();
                  const displayedList = winningObj
                    ? [winningObj]
                    : vendors.filter((v) => selectedVendorIds.includes(v.id));

                  return (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                        {winningObj
                          ? 'Share Order Award & Confirmation to Selected Winning Supplier (WhatsApp & Email):'
                          : 'Share Directly to Selected Suppliers (WhatsApp & Email):'}
                      </h4>
                      <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', background: '#f8fafc' }}>
                        {displayedList.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            No supplier selected.
                          </div>
                        ) : (
                          displayedList.map((v) => (
                            <div
                              key={v.id || v.name}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.5rem 0.75rem',
                                background: '#ffffff',
                                borderRadius: '6px',
                                border: winningObj ? '1.5px solid #86efac' : '1px solid var(--border-color)',
                                marginBottom: '0.4rem',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <strong style={{ fontSize: '0.88rem' }}>{v.name}</strong>
                                  {winningObj && (
                                    <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', padding: '0.1rem 0.45rem', borderRadius: '10px', fontWeight: 700, border: '1px solid #86efac' }}>
                                      ✓ Selected Winner
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  📞 {v.phone || 'No phone'} • ✉️ {v.email || 'No email'}
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDirectWhatsapp(v)}
                                  className="btn btn-sm"
                                  style={{ background: '#25D366', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                  title="Send quotation/award on WhatsApp"
                                >
                                  <MessageSquare size={13} />
                                  <span>WhatsApp</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenDirectEmail(v)}
                                  className="btn btn-sm btn-secondary"
                                  style={{ fontWeight: 600, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb' }}
                                  title="Send quotation/award via Email"
                                >
                                  <Mail size={13} />
                                  <span>Email</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCopyPortalLink(v.id)}
                                  className="btn btn-sm btn-secondary"
                                  style={{ fontWeight: 600, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                  title="Copy personalized quotation link"
                                >
                                  <Copy size={13} />
                                  <span>{copiedVendorId === v.id ? 'Copied!' : 'Link'}</span>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* WhatsApp Message Preview */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                    Message Preview:
                  </h4>
                  <pre style={{
                    background: '#1e293b',
                    color: '#e2e8f0',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    lineHeight: '1.45',
                    maxHeight: '170px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    margin: 0
                  }}>
                    {buildShareMessage()}
                  </pre>
                </div>

                {/* Modal Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveSendTab('terms')}
                    className="btn btn-secondary"
                  >
                    &larr; Back to Terms
                  </button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowSendModal(false)}
                      className="btn btn-secondary"
                    >
                      Close Window
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSendModal(false)}
                      className="btn btn-primary"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '1rem', cursor: 'zoom-out' }}
        >
          <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: -40, right: 0, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => handleDownloadPhoto(previewPhoto, 'receipt_photo_preview')}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Download size={14} />
                <span>Download Photo</span>
              </button>
              <button
                onClick={() => setPreviewPhoto(null)}
                style={{ background: 'var(--danger-bg)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <img 
              src={previewPhoto} 
              alt="Material Attachment Preview" 
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RequisitionDetailPage;
