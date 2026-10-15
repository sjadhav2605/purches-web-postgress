import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { rfqService } from '../../services/rfq.service.js';
import { masterService } from '../../services/master.service.js';
import { userService } from '../../services/user.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatWorkflowDateTime } from '../../utils/dateFormatter.js';
import { 
  ArrowLeft, 
  Award, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Building2, 
  FileText, 
  TrendingDown,
  RotateCcw,
  Send,
  AlertCircle,
  Calendar,
  Check,
  PhoneCall,
  UserCheck,
  ChevronRight,
  Eye,
  Layers,
  ListFilter,
  PackageCheck,
  XCircle,
  Tag,
  Edit3,
  History,
  Share2,
  Copy,
  MessageCircle,
  ExternalLink,
  Mail,
  Phone
} from 'lucide-react';

export const RFQDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeRole, activeRoleKey, activeDirectorId, currentRoleInfo } = useAuth();

  const [rfq, setRfq] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Submit Bid Modal
  const [showBidModal, setShowBidModal] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [bidVendorId, setBidVendorId] = useState('');
  const [isLoggedByPurchase, setIsLoggedByPurchase] = useState(false);
  const [quoteSourceNote, setQuoteSourceNote] = useState('phone'); // phone / email
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [globalLeadFrom, setGlobalLeadFrom] = useState('');
  const [globalLeadTo, setGlobalLeadTo] = useState('');
  const [quotedItems, setQuotedItems] = useState([]);

  // Modal to View Full Bid Details & Items
  const [activeViewBid, setActiveViewBid] = useState(null);
  // Matrix View Mode: 'summary' | 'item-by-item'
  const [matrixViewMode, setMatrixViewMode] = useState('summary');

  // Shortlisting State (Purchase)
  const [selectedShortlistIds, setSelectedShortlistIds] = useState([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [shortlistingLoading, setShortlistingLoading] = useState(false);
  const [directors, setDirectors] = useState([]);
  const [selectedDirectorId, setSelectedDirectorId] = useState('');

  // Director Approval State
  const [directorSelectedWinnerId, setDirectorSelectedWinnerId] = useState('');
  const [directorNote, setDirectorNote] = useState('');
  const [directorActionLoading, setDirectorActionLoading] = useState(false);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [showDirectorDeclineModal, setShowDirectorDeclineModal] = useState(false);
  const [directorDeclineRemark, setDirectorDeclineRemark] = useState('');

  // Revision Modal State (RFQ-level RA1, RA2...)
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionDeadline, setRevisionDeadline] = useState('');
  const [revisionVendorIds, setRevisionVendorIds] = useState([]);

  // Vendor Bid Rate Revision State (Purchase Manager edits vendor item rates)
  const [activeRevisionBid, setActiveRevisionBid] = useState(null);
  const [revisionItems, setRevisionItems] = useState([]);
  const [revisionRemarks, setRevisionRemarks] = useState('');
  const [sendingRevisionLoading, setSendingRevisionLoading] = useState(false);
  const [savingNegotiationLoading, setSavingNegotiationLoading] = useState(false);

  // Bid Revision History State
  const [activeHistoryBid, setActiveHistoryBid] = useState(null);

  // Share Direct Quote Link Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedVendorId, setCopiedVendorId] = useState(null);
  const [selectedShareVendorId, setSelectedShareVendorId] = useState('');
  const [copiedWinnerShortlistLink, setCopiedWinnerShortlistLink] = useState(false);

  const fetchRfqDetails = async () => {
    setLoading(true);
    try {
      const data = await rfqService.getRfqById(id);
      setRfq(data);
      const sortedBids = (data.bids || []).sort(
        (a, b) => Number(a.quote_amount || Infinity) - Number(b.quote_amount || Infinity)
      );
      setBids(sortedBids);

      // Pre-fill items for the bid modal
      if (data.items && Array.isArray(data.items)) {
        setQuotedItems(
          data.items.map((item) => ({
            id: item.id,
            description: item.description,
            spec: item.spec || '',
            unit: item.unit || 'Nos',
            qty: Number(item.quantity) || 1,
            rate: Number(item.est_rate) || 0,
            availability: 'Available',
            lead_from: '',
            lead_to: '',
            remarks: ''
          }))
        );
      }

      // Auto-tick 3 lowest bids if not already shortlisted
      if (data.shortlisted_vendors && Array.isArray(data.shortlisted_vendors) && data.shortlisted_vendors.length > 0) {
        setSelectedShortlistIds(data.shortlisted_vendors.map(Number));
        setOverrideReason(data.shortlist_reason || '');
      } else if (sortedBids.length > 0) {
        const top3 = sortedBids.slice(0, 3).map((b) => b.vendor_id);
        setSelectedShortlistIds(top3);
      }

      // Pre-select winner for Director if shortlisted
      if (data.winner_vendor_id) {
        setDirectorSelectedWinnerId(String(data.winner_vendor_id));
      } else if (sortedBids.length > 0) {
        setDirectorSelectedWinnerId(String(sortedBids[0].vendor_id));
      }

      if (data.target_director_id) {
        setSelectedDirectorId(String(data.target_director_id));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const data = await masterService.getVendors();
      setVendors(data || []);
      if (data && data.length > 0) {
        setBidVendorId(data[0].id);
        setRevisionVendorIds(data.map(v => v.id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDirectors = async () => {
    try {
      const data = await userService.getDirectors();
      setDirectors(data || []);
      if (data && data.length > 0 && !selectedDirectorId) {
        setSelectedDirectorId(String(data[0].id));
      }
    } catch (err) {
      console.warn('Failed to load directors:', err);
    }
  };

  useEffect(() => {
    fetchRfqDetails();
    loadVendors();
    loadDirectors();
  }, [id]);

  const handleRateChange = (index, rate) => {
    const updated = [...quotedItems];
    updated[index].rate = Number(rate);
    setQuotedItems(updated);
  };

  const handleItemFieldChange = (index, field, val) => {
    const updated = [...quotedItems];
    updated[index][field] = val;
    if (field === 'availability' && val === 'Not Available') {
      updated[index].rate = 0;
    }
    setQuotedItems(updated);
  };

  const handleItemLeadChange = (index, field, val) => {
    const updated = [...quotedItems];
    updated[index][field] = val;
    setQuotedItems(updated);
  };

  const handleApplyGlobalLead = () => {
    if (!globalLeadFrom || !globalLeadTo) {
      alert('Please enter both From and To delivery dates');
      return;
    }
    const updated = quotedItems.map(item => ({
      ...item,
      lead_from: globalLeadFrom,
      lead_to: globalLeadTo
    }));
    setQuotedItems(updated);
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    if (!bidVendorId) {
      alert('Please select a vendor');
      return;
    }

    try {
      const totalQuote = quotedItems.reduce(
        (sum, item) => {
          if (item.availability === 'Not Available') return sum;
          return sum + (Number(item.qty || 0) * Number(item.rate || 0));
        },
        0
      );

      const effectiveRole = activeRole || user?.role || 'admin';
      const enteredByTag = isLoggedByPurchase 
        ? `Logged by Purchase (${quoteSourceNote.toUpperCase()})` 
        : (effectiveRole === 'vendor' ? 'vendor' : 'purchase');

      await rfqService.submitBid({
        rfq_id: Number(id),
        vendor_id: Number(bidVendorId),
        rev_no: rfq?.current_rev || 0,
        quote_amount: totalQuote,
        delivery_days: Number(deliveryDays),
        lead_from: globalLeadFrom || null,
        lead_to: globalLeadTo || null,
        entered_by: enteredByTag,
        bid_items: quotedItems
      });

      setShowBidModal(false);
      fetchRfqDetails();
      alert('Vendor quote recorded successfully! RFQ moved to "Bids In".');
    } catch (e) {
      alert(e.message);
    }
  };

  // Toggle Shortlist Checkbox
  const handleToggleShortlist = (vendorId) => {
    const vId = Number(vendorId);
    if (selectedShortlistIds.includes(vId)) {
      setSelectedShortlistIds(selectedShortlistIds.filter(id => id !== vId));
    } else {
      if (selectedShortlistIds.length >= 3) {
        alert('You may shortlist at most 3 competitive vendors for Director approval.');
        return;
      }
      setSelectedShortlistIds([...selectedShortlistIds, vId]);
    }
  };

  // Submit Shortlist to Director
  const handleSendToDirector = async () => {
    if (selectedShortlistIds.length === 0) {
      alert('Please select at least 1 vendor to shortlist.');
      return;
    }

    // Check if overridden from top 3 lowest
    const top3Lowest = bids.slice(0, 3).map(b => b.vendor_id);
    const isOverridden = selectedShortlistIds.some(id => !top3Lowest.includes(id));
    if (isOverridden && !overrideReason.trim()) {
      alert('A mandatory reason is required because your shortlist differs from the 3 lowest bids.');
      return;
    }

    setShortlistingLoading(true);
    try {
      await rfqService.shortlistBids(Number(id), {
        shortlisted_vendor_ids: selectedShortlistIds,
        override_reason: overrideReason.trim(),
        target_director_id: selectedDirectorId ? Number(selectedDirectorId) : null
      });
      const chosenDirector = directors.find(d => String(d.id) === String(selectedDirectorId));
      alert(`Shortlisted vendors successfully submitted to ${chosenDirector?.name || 'Director'} for final review & PO issuance!`);
      fetchRfqDetails();
    } catch (err) {
      alert(err.message || 'Failed to submit shortlist');
    } finally {
      setShortlistingLoading(false);
    }
  };

  // Director Approves Winning Quote and Forwards to Purchase Manager
  const handleDirectorApprove = async () => {
    const selectedBid = directorSelectedWinnerId ? bids.find(b => b.vendor_id === Number(directorSelectedWinnerId)) : (bids.length > 0 ? bids[0] : null);
    const vendorName = selectedBid?.vendor_name || 'selected vendor';
    const confirmMsg = `Approve ${vendorName} as the winning vendor for RFQ ${rfq.rfq_no}? All other competing vendors in this race will be marked as Rejected.`;
    if (!window.confirm(confirmMsg)) return;

    setDirectorActionLoading(true);
    try {
      const res = await rfqService.directorApprove(Number(id), {
        vendor_id: selectedBid ? Number(selectedBid.vendor_id) : null,
        note: directorNote.trim()
      });
      alert(`Success! RFQ approved by Director. Purchase Manager notified.`);
      fetchRfqDetails();
    } catch (err) {
      alert(err.message || 'Failed to approve bid');
    } finally {
      setDirectorActionLoading(false);
    }
  };

  // Director Declines RFQ with mandatory remark
  const handleConfirmDirectorDecline = async (e) => {
    e.preventDefault();
    if (!directorDeclineRemark.trim()) {
      alert('A decline remark is mandatory.');
      return;
    }
    setDirectorActionLoading(true);
    try {
      await rfqService.directorDecline(Number(id), { remark: directorDeclineRemark.trim() });
      setShowDirectorDeclineModal(false);
      alert('RFQ declined by Director. Purchase Department notified.');
      fetchRfqDetails();
    } catch (err) {
      alert(err.message || 'Failed to decline RFQ');
    } finally {
      setDirectorActionLoading(false);
    }
  };

  // Director Sends back to Purchase
  const handleDirectorSendBack = async (e) => {
    e.preventDefault();
    if (!directorNote.trim()) {
      alert('Please provide a note explaining why this RFQ is being returned to Purchase.');
      return;
    }

    setDirectorActionLoading(true);
    try {
      await rfqService.sendBackToPurchase(Number(id), {
        note: directorNote.trim()
      });
      setShowSendBackModal(false);
      alert('RFQ successfully returned to Purchase Department for review.');
      fetchRfqDetails();
    } catch (err) {
      alert(err.message || 'Failed to return RFQ');
    } finally {
      setDirectorActionLoading(false);
    }
  };

  // Create Revision (RA1, RA2...)
  const handleCreateRevision = async (e) => {
    e.preventDefault();
    if (!revisionReason.trim()) {
      alert('A mandatory reason is required to issue a new RFQ revision.');
      return;
    }

    try {
      await rfqService.createRevision(Number(id), {
        reason: revisionReason.trim(),
        deadline: revisionDeadline || null,
        vendor_ids: revisionVendorIds
      });
      setShowRevisionModal(false);
      alert('New RFQ Revision issued successfully! Previous bids remain archived and intact.');
      fetchRfqDetails();
    } catch (err) {
      alert(err.message || 'Failed to create revision');
    }
  };

  // Open modal to edit rates for a specific vendor's bid
  const handleOpenRateRevision = (bid) => {
    setActiveRevisionBid(bid);
    setRevisionRemarks('');
    // Prepare items with original_rate and revised_rate
    const items = (bid.items || []).map((it, idx) => ({
      item_index: idx,
      id: it.id,
      description: it.description,
      spec: it.spec || '',
      unit: it.unit || 'Nos',
      qty: Number(it.qty || it.quantity || 1),
      original_rate: Number(it.original_rate !== undefined ? it.original_rate : (it.rate || 0)),
      revised_rate: Number(it.revised_rate !== undefined ? it.revised_rate : (it.rate || 0)),
      availability: it.availability || 'Available'
    }));
    setRevisionItems(items);
  };

  const handleRevisionRateChange = (idx, newRate) => {
    const updated = [...revisionItems];
    updated[idx].revised_rate = newRate === '' ? '' : Number(newRate);
    setRevisionItems(updated);
  };

  // Purchase Manager submits edited rates to vendor
  const handleSendBidRevision = async (e) => {
    e.preventDefault();
    if (!activeRevisionBid) return;

    setSendingRevisionLoading(true);
    try {
      await rfqService.sendBidRevision(Number(id), activeRevisionBid.id, {
        items: revisionItems.map(it => ({
          ...it,
          revised_rate: Number(it.revised_rate || 0),
          rate: Number(it.revised_rate || 0)
        })),
        remarks: revisionRemarks.trim()
      });

      const targetVendor = {
        ...activeRevisionBid,
        current_round: (Number(activeRevisionBid.current_round) || 0) + 1
      };
      setActiveRevisionBid(null);
      fetchRfqDetails();

      const openWhatsApp = window.confirm(
        `Revision request (Round ${targetVendor.current_round}) sent to ${targetVendor.vendor_name}!\n\nWould you like to open WhatsApp now to share the revision link directly with this supplier?`
      );
      if (openWhatsApp) {
        window.open(getVendorRevisionWhatsAppLink(targetVendor), '_blank');
      }
    } catch (err) {
      alert(err.message || 'Failed to send revision request');
    } finally {
      setSendingRevisionLoading(false);
    }
  };

  // Purchase Manager saves phone-negotiated rates directly (with or without 1-click send to Director)
  const handleSaveNegotiatedRates = async (sendToDirector = false) => {
    if (!activeRevisionBid) return;

    // Validate that all available items have a positive revised_rate
    const invalidItem = revisionItems.find(
      it => it.availability !== 'Not Available' && it.availability !== 'Unavailable' && (Number(it.revised_rate) <= 0 || isNaN(Number(it.revised_rate)))
    );
    if (invalidItem) {
      alert(`Please enter a valid rate for "${invalidItem.description}".`);
      return;
    }

    setSavingNegotiationLoading(true);
    try {
      const payload = {
        items: revisionItems.map(it => ({
          ...it,
          revised_rate: Number(it.revised_rate || 0),
          rate: Number(it.revised_rate || 0)
        })),
        remarks: revisionRemarks.trim(),
        send_to_director: sendToDirector,
        target_director_id: selectedDirectorId ? Number(selectedDirectorId) : null
      };

      await rfqService.saveNegotiatedRates(Number(id), activeRevisionBid.id, payload);

      const vName = activeRevisionBid.vendor_name;
      setActiveRevisionBid(null);
      await fetchRfqDetails();

      if (sendToDirector) {
        const chosenDirector = directors.find(d => String(d.id) === String(selectedDirectorId));
        alert(`✅ Negotiated rates saved successfully!\nVendor "${vName}" has been shortlisted and forwarded to ${chosenDirector?.name || 'Director'} for approval.`);
      } else {
        alert(`✅ Negotiated rates saved for "${vName}"! Comparison matrix and quote totals have been updated.`);
      }
    } catch (err) {
      alert(err.message || 'Failed to save negotiated rates');
    } finally {
      setSavingNegotiationLoading(false);
    }
  };

  const handleCopyQuoteLink = (vendorId = null, sig = null) => {
    const origin = window.location.origin;
    const vendorSig = sig || bids.find(b => String(b.vendor_id) === String(vendorId))?.quote_sig;
    const sigParam = vendorSig ? `&sig=${vendorSig}` : '';
    const link = vendorId ? `${origin}/quote/${rfq.id}?v=${vendorId}${sigParam}` : `${origin}/quote/${rfq.id}`;
    navigator.clipboard.writeText(link);
    setCopiedVendorId(vendorId || 'general');
    setTimeout(() => setCopiedVendorId(null), 2500);
  };

  const getVendorWhatsAppLink = (vendor) => {
    if (!rfq) return '#';
    const origin = window.location.origin;
    const vendorSig = vendor?.quote_sig || bids.find(b => String(b.vendor_id) === String(vendor?.id))?.quote_sig;
    const sigParam = vendorSig ? `&sig=${vendorSig}` : '';
    const quoteUrl = vendor?.id ? `${origin}/quote/${rfq.id}?v=${vendor.id}${sigParam}` : `${origin}/quote/${rfq.id}`;
    
    const itemsSummary = (rfq.items || []).slice(0, 4).map((it, idx) => 
      `${idx + 1}. ${it.description} - ${it.quantity} ${it.unit}`
    ).join('\n');
    const extraCount = (rfq.items || []).length > 4 ? `\n...and ${(rfq.items || []).length - 4} more items` : '';

    const text = `*DDPL GROUP - REQUEST FOR QUOTATION*\n\n` +
      `Namaskar ${vendor?.name || 'Sir/Madam'},\n` +
      `Please provide your best competitive rates for RFQ: *${rfq.rfq_no}*\n\n` +
      `*Delivery Site:* ${rfq.site_name || 'Project Site'}\n` +
      `*Required Materials:*\n${itemsSummary}${extraCount}\n\n` +
      (rfq.deadline ? `*Due Date:* ${new Date(rfq.deadline).toLocaleDateString('en-IN')}\n\n` : '') +
      `*Fill & Submit Quotation Online Here:*\n${quoteUrl}\n\n` +
      `_No login or registration required. Directly enter unit rates and submit._\n` +
      `Thank you,\nDDPL Procurement Division`;

    let cleanPhone = String(vendor?.phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (cleanPhone) {
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  const getVendorEmailLink = (vendor) => {
    if (!rfq) return '#';
    const origin = window.location.origin;
    const vendorSig = vendor?.quote_sig || bids.find(b => String(b.vendor_id) === String(vendor?.id))?.quote_sig;
    const sigParam = vendorSig ? `&sig=${vendorSig}` : '';
    const quoteUrl = vendor?.id ? `${origin}/quote/${rfq.id}?v=${vendor.id}${sigParam}` : `${origin}/quote/${rfq.id}`;
    const subject = `Request for Quotation: ${rfq.rfq_no} - DDPL Group (${rfq.site_name || 'Site'})`;
    const body = `Dear ${vendor?.name || 'Supplier'},\n\n` +
      `We invite your quotation for RFQ: ${rfq.rfq_no}.\n` +
      `Site: ${rfq.site_name || 'DDPL Project'}\n\n` +
      `Please review required items and submit your unit rates directly via the portal link below:\n${quoteUrl}\n\n` +
      `Regards,\nDDPL Purchase Department`;
    return `mailto:${vendor?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getVendorRevisionWhatsAppLink = (vendor) => {
    if (!rfq) return '#';
    const origin = window.location.origin;
    const vId = vendor?.vendor_id || vendor?.id;
    const vendorSig = vendor?.quote_sig || bids.find(b => String(b.vendor_id) === String(vId))?.quote_sig;
    const sigParam = vendorSig ? `&sig=${vendorSig}` : '';
    const quoteUrl = `${origin}/quote/${rfq.id}?v=${vId}${sigParam}`;
    const round = Number(vendor?.current_round) || 1;

    const text = `*DDPL GROUP - RATE REVISION REQUEST (Round ${round})*\n\n` +
      `Namaskar ${vendor?.vendor_name || vendor?.name || 'Sir/Madam'},\n` +
      `Our Purchase Department has reviewed your quotation for RFQ: *${rfq.rfq_no}* (${rfq.site_name || 'Project Site'}).\n\n` +
      `We have requested revised/negotiated rates. Please click the link below to review our proposed rates and submit your final rates:\n\n` +
      `👉 ${quoteUrl}\n\n` +
      `Thank you,\nDDPL Procurement Division`;

    let cleanPhone = String(vendor?.vendor_phone || vendor?.phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (cleanPhone) {
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  const getVendorRevisionEmailLink = (vendor) => {
    if (!rfq) return '#';
    const origin = window.location.origin;
    const vId = vendor?.vendor_id || vendor?.id;
    const vendorSig = vendor?.quote_sig || bids.find(b => String(b.vendor_id) === String(vId))?.quote_sig;
    const sigParam = vendorSig ? `&sig=${vendorSig}` : '';
    const quoteUrl = `${origin}/quote/${rfq.id}?v=${vId}${sigParam}`;
    const round = Number(vendor?.current_round) || 1;
    const subject = `Rate Revision Requested: RFQ ${rfq.rfq_no} (Round ${round}) - DDPL Group`;
    const body = `Dear ${vendor?.vendor_name || vendor?.name || 'Supplier'},\n\n` +
      `Our Purchase Department has requested a rate revision for RFQ: ${rfq.rfq_no}.\n\n` +
      `Please review our proposed rates and submit your final rates directly via the portal link below:\n${quoteUrl}\n\n` +
      `Regards,\nDDPL Purchase Department`;
    const emailTo = vendor?.vendor_email || vendor?.email || '';
    return `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getWinnerShortlistWhatsAppLink = (winnerVendorId = null) => {
    if (!rfq) return '#';
    const targetVendorId = winnerVendorId || rfq.winner_vendor_id;
    if (!targetVendorId) return '#';
    const winnerBid = bids.find(b => String(b.vendor_id) === String(targetVendorId));
    const origin = window.location.origin;
    const vendorSig = winnerBid?.quote_sig || rfq.winner_vendor_quote_sig;
    const sigParam = vendorSig ? `&sig=${vendorSig}` : '';
    const quoteUrl = `${origin}/quote/${rfq.id}?v=${targetVendorId}${sigParam}`;
    
    const vendorName = winnerBid?.vendor_name || rfq.winner_vendor_name || 'Vendor Partner';
    const itemsCount = (rfq.items || []).length;
    const totalAmount = winnerBid?.quote_amount ? `₹${Number(winnerBid.quote_amount).toLocaleString('en-IN')}` : '';

    const termsStr = rfq.payment_terms || (Number(rfq.advance_pct) > 0 ? `${rfq.advance_pct}% Advance + ${rfq.credit_days || 30} Days Credit` : `${rfq.credit_days || 30} Days Credit`);
    const advStr = Number(rfq.advance_pct) || 0;
    const creditStr = Number(rfq.credit_days) || 30;

    const text = `*DDPL GROUP - ORDER AWARD / SHORTLIST CONFIRMATION*\n\n` +
      `Congratulations *${vendorName}*!\n` +
      `Your quotation for RFQ *${rfq.rfq_no}* has been approved and shortlisted by DDPL Management.\n\n` +
      `*Delivery Site:* ${rfq.site_name || 'Project Site'}\n` +
      (totalAmount ? `*Approved Total:* ${totalAmount}\n` : '') +
      `*Items Count:* ${itemsCount} item(s)\n\n` +
      `*Agreed Commercial & Payment Terms:*\n` +
      `• Payment Terms: ${termsStr}\n` +
      `• Advance Payment: ${advStr}%\n` +
      `• Credit Period: ${creditStr} Days\n` +
      (rfq.payment_terms_notes ? `• Commercial Conditions: ${rfq.payment_terms_notes}\n` : '') +
      `\nPlease open your order confirmation link below to review materials and enter your Delivery Challan, Tax Invoice/Bill number, Vehicle number, and Expected Site Arrival Date:\n\n` +
      `👉 *Order & Dispatch Schedule Link:*\n${quoteUrl}\n\n` +
      `Thank you,\nDDPL Purchase & Procurement Division`;

    let cleanPhone = String(winnerBid?.vendor_phone || winnerBid?.phone || rfq.winner_vendor_phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (cleanPhone) {
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  const handleCopyWinnerShortlistLink = (winnerVendorId = null) => {
    if (!rfq) return;
    const targetVendorId = winnerVendorId || rfq.winner_vendor_id;
    if (!targetVendorId) return;
    const winnerBid = bids.find(b => String(b.vendor_id) === String(targetVendorId));
    const origin = window.location.origin;
    const vendorSig = winnerBid?.quote_sig || rfq.winner_vendor_quote_sig;
    const sigParam = vendorSig ? `&sig=${vendorSig}` : '';
    const quoteUrl = `${origin}/quote/${rfq.id}?v=${targetVendorId}${sigParam}`;
    navigator.clipboard.writeText(quoteUrl);
    setCopiedWinnerShortlistLink(true);
    setTimeout(() => setCopiedWinnerShortlistLink(false), 2500);
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading RFQ comparison & details...</div>;
  }

  if (error || !rfq) {
    return (
      <div className="card">
        <div style={{ color: 'var(--danger-text)', marginBottom: '1rem' }}>{error || 'RFQ not found'}</div>
        <Link to="/rfqs" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} /> Back to RFQs
        </Link>
      </div>
    );
  }

  // Lowest bid (L1) among submitted bids with positive amounts
  const submittedBids = bids.filter((b) => (b.has_submitted || Number(b.quote_amount) > 0) && Number(b.quote_amount) > 0);
  const lowestBidAmount = submittedBids.length > 0 
    ? Math.min(...submittedBids.map((b) => Number(b.quote_amount)))
    : null;

  const effectiveRole = activeRole || user?.role || 'admin';
  const isDirector = effectiveRole === 'director';
  const isPurchase = effectiveRole === 'purchase';
  const isRealAdmin = user?.role === 'admin';

  let isAssignedToOtherDirector = false;
  if (rfq?.target_director_id && isDirector && !isRealAdmin) {
    const curDirId = Number(activeDirectorId || user?.id || 0);
    const targetDirId = Number(rfq.target_director_id);
    const isCurD2 = (curDirId === 10 || curDirId === 6) || activeRoleKey === 'director_2';
    const isCurD3 = (curDirId === 11 || curDirId === 7) || activeRoleKey === 'director_3';
    const isCurD1 = (curDirId === 5) || activeRoleKey === 'director_1';

    const targetNameLower = String(rfq.target_director_name || '').toLowerCase();
    const isTargetD2 = (targetDirId === 10 || targetDirId === 6) || targetNameLower.includes('director 2');
    const isTargetD3 = (targetDirId === 11 || targetDirId === 7) || targetNameLower.includes('director 3');
    const isTargetD1 = (targetDirId === 5) || targetNameLower.includes('director 1');

    if ((isTargetD2 && !isCurD2) || (isTargetD3 && !isCurD3) || (isTargetD1 && !isCurD1)) {
      isAssignedToOtherDirector = true;
    }
  }

  const isDirectorOrAdmin = isDirector || isRealAdmin;
  const isPurchaseOrAdmin = isPurchase || isRealAdmin;

  // If viewed as Site Supervisor or Project Coordinator, show clear role scope restriction
  if (['supervisor', 'pc'].includes(effectiveRole)) {
    return (
      <div>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/requisitions" className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} />
            <span>Back to Requests</span>
          </Link>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{rfq.rfq_no}</h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Linked PR: <strong>{rfq.pr_no}</strong> • Site: <strong>{rfq.site_code} ({rfq.site_name})</strong>
            </span>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', maxWidth: '680px', margin: '2rem auto' }}>
          <Shield size={48} style={{ color: 'var(--primary-600)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            Access Restricted to Procurement Roles
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Requests for Quotation (RFQs), commercial vendor bidding matrices, and supplier negotiation rates are strictly confidential under DDPL access governance and managed exclusively by the <strong>Purchase Department</strong> and <strong>Director</strong>.
            <br /><br />
            As <strong>{currentRoleInfo?.title || 'Site Supervisor'}</strong>, your scope is site request management and physical material delivery receipt verification.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/requisitions" className="btn btn-primary">
              <span>Go to My Requests</span>
            </Link>
            <Link to="/deliveries" className="btn btn-secondary">
              <span>Go to Site Deliveries</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/rfqs" className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} />
            <span>Back to RFQs</span>
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                {rfq.rfq_no}
              </h1>
              <span className="badge badge-issued" style={{ fontSize: '0.75rem' }}>
                {rfq.current_rev ? `Revision RA${rfq.current_rev}` : 'Revision Original'}
              </span>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Linked Request: <strong>{rfq.pr_no}</strong> • Site: <strong>{rfq.site_code} ({rfq.site_name})</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isPurchaseOrAdmin && (
            <>
              <button
                onClick={() => setShowShareModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 600 }}
                title="Share direct quote links via WhatsApp, Email, or Copy link"
              >
                <Share2 size={15} style={{ color: '#059669' }} />
                <span>Share Quote Links</span>
              </button>
              <button
                onClick={() => setShowRevisionModal(true)}
                className="btn btn-secondary btn-sm"
                title="Issue revision RA1, RA2..."
              >
                <RotateCcw size={15} />
                <span>Create Revision</span>
              </button>
              <button
                onClick={() => setShowBidModal(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={16} />
                <span>Enter Vendor Quote</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Director Send-Back Note Alert if any */}
      {rfq.director_note && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#ef4444', fontSize: '0.9rem' }}>Director Note / Review Feedback:</strong>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              {rfq.director_note}
            </p>
          </div>
        </div>
      )}

      {/* Meta Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Site</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem' }}>{rfq.site_code || '—'}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{rfq.site_name}</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>RFQ Sent By</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--primary-700)' }}>
            {rfq.created_by_name || 'Purchase Dept'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {rfq.created_by_role ? `(${rfq.created_by_role}) • ` : ''}{formatWorkflowDateTime(rfq.created_at)}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lifecycle Stage</div>
          <div style={{ marginTop: '0.35rem' }}>
            <span className={`badge badge-${rfq.status?.toLowerCase().replace(/\s+/g, '-')}`}>
              {rfq.status}
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bid Deadline</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {rfq.deadline ? new Date(rfq.deadline).toLocaleDateString() : 'Open / No deadline'}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Awarded Winning Vendor</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.25rem', color: rfq.winner_vendor_name ? '#34d399' : 'var(--text-muted)' }}>
            {rfq.winner_vendor_name || 'Pending Selection'}
          </div>
        </div>

        {rfq.target_director_name && (
          <div className="card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '0.72rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>
              🏛️ Assigned Director
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '0.25rem', color: '#1e3a8a' }}>
              {rfq.target_director_name}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: '0.15rem' }}>
              Designated for Commercial Review
            </div>
          </div>
        )}

        <div className="card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)', border: '1px solid #86efac' }}>
          <div style={{ fontSize: '0.72rem', color: '#166534', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span>💳 Payment Terms</span>
          </div>
          <div style={{ fontSize: '0.98rem', fontWeight: 800, marginTop: '0.25rem', color: '#0f172a' }}>
            {rfq.payment_terms || 'Standard Terms'}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
              {Number(rfq.advance_pct) > 0 ? `${rfq.advance_pct}% Advance` : '0% Advance'}
            </span>
            <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
              {rfq.credit_days ? `${rfq.credit_days}d Credit` : '30d Credit'}
            </span>
          </div>
        </div>
      </div>

      {/* APPROVED BY DIRECTOR BANNER */}
      {['Approved', 'Director Approved'].includes(rfq.status) && (
        <div className="card" style={{ border: '2px solid #10b981', background: '#ecfdf5', marginBottom: '1.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <CheckCircle2 size={20} style={{ color: '#047857' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#047857' }}>
                  Director Decision: Quote Approved & Awarded
                </h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {isPurchaseOrAdmin
                  ? 'The Director has approved this RFQ. As Purchase Manager, you can now shortlist the winning vendor.'
                  : 'Commercial quotes have been decided by Director. Winning vendor approved; other bids rejected.'}
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.82rem', fontWeight: 800, padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={14} /> Winning Vendor: {rfq.winner_vendor_name || bids.find(b => b.vendor_id === rfq.winner_vendor_id)?.vendor_name || 'Selected Vendor'} (Approved)
                </span>
                {bids.filter(b => b.vendor_id !== rfq.winner_vendor_id).length > 0 && (
                  <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <XCircle size={13} /> {bids.filter(b => b.vendor_id !== rfq.winner_vendor_id).length} Competing Vendor(s) in Race (Rejected)
                  </span>
                )}
              </div>

              {rfq.director_note && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.45rem' }}>
                  <strong>Director Note:</strong> {rfq.director_note}
                </div>
              )}
            </div>

            {isPurchaseOrAdmin && !isDirector && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <a
                  href={getWinnerShortlistWhatsAppLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm"
                  style={{ background: '#25D366', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, padding: '0.55rem 1rem', borderRadius: '8px', textDecoration: 'none', boxShadow: '0 2px 6px rgba(37,211,102,0.3)', cursor: 'pointer' }}
                  title="Notify shortlisted vendor via WhatsApp with order & dispatch link"
                >
                  <MessageCircle size={16} />
                  <span>💬 Notify Shortlisted Vendor (WhatsApp)</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleCopyWinnerShortlistLink()}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, padding: '0.55rem 0.9rem' }}
                  title="Copy shortlisted vendor order & delivery link"
                >
                  {copiedWinnerShortlistLink ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                  <span>{copiedWinnerShortlistLink ? 'Link Copied!' : 'Copy Shortlist Link'}</span>
                </button>

                <Link to={`/requisitions/${rfq.requisition_id}`} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, padding: '0.55rem 1rem' }}>
                  <Award size={15} />
                  <span>Shortlist Vendor on Request</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DECLINED BY DIRECTOR BANNER */}
      {rfq.status === 'Director Declined' && (
        <div className="card" style={{ border: '2px solid #ef4444', background: '#fef2f2', marginBottom: '1.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <XCircle size={20} style={{ color: '#b91c1c' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#b91c1c' }}>
              RFQ Declined by Director
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0.25rem 0 0' }}>
            Decline Reason: <strong>{rfq.director_declined_reason || rfq.director_note || 'Commercial terms or rates not approved'}</strong>
          </p>
        </div>
      )}

      {/* DIRECTOR APPROVAL WORKFLOW BOX */}
      {isDirectorOrAdmin && !['Approved', 'Director Approved', 'Director Declined', 'Vendor Shortlisted', 'Dispatched', 'Received'].includes(rfq.status) && bids.length > 0 && (
        <div className="card" style={{ border: '2px solid #2563eb', background: '#eff6ff', marginBottom: '1.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck size={20} style={{ color: '#2563eb' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#1e40af' }}>
                Director Commercial Review & Approval
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {rfq.target_director_name && (
                <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', fontSize: '0.75rem', fontWeight: 700 }}>
                  Assigned to: {rfq.target_director_name}
                </span>
              )}
              <span className="badge badge-approved" style={{ fontSize: '0.75rem' }}>
                Action Required: Review Vendor Bids
              </span>
            </div>
          </div>

          {isAssignedToOtherDirector && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <AlertCircle size={18} style={{ color: '#b91c1c', flexShrink: 0 }} />
              <div>
                This RFQ was specifically routed to <strong>{rfq.target_director_name}</strong> for commercial review. You are logged in as <strong>{user?.name}</strong> and cannot approve or decline it.
              </div>
            </div>
          )}

          {isRealAdmin && rfq.target_director_name && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.65rem 0.85rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
              <div>
                Assigned to: <strong>{rfq.target_director_name}</strong>. As <strong>Administrator</strong>, you have full authority to review, approve, or decline this quote.
              </div>
            </div>
          )}

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Review vendor bid rates, availability, and delivery schedules below. You can Approve to forward to Purchase Manager for shortlisting, or Decline with a mandatory remark.
          </p>

          {rfq.shortlist_reason && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '0.65rem 0.85rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.82rem' }}>
              <strong>Purchase Department Override Note:</strong> {rfq.shortlist_reason}
            </div>
          )}

          {/* Shortlisted vendors summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            {bids.map((b) => {
                const exGst = Number(b.quote_amount || 0);
                const gst18 = Math.round(exGst * 0.18 * 100) / 100;
                const grandTotal = Math.round((exGst + gst18) * 100) / 100;
                const isSelected = String(directorSelectedWinnerId) === String(b.vendor_id);

                return (
                  <div 
                    key={b.id}
                    onClick={() => setDirectorSelectedWinnerId(String(b.vendor_id))}
                    style={{
                      border: `2px solid ${isSelected ? '#2563eb' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? '#ffffff' : '#f8fafc',
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 6px -1px rgba(37, 99, 235, 0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '1rem', color: isSelected ? '#1d4ed8' : 'var(--text-primary)', display: 'block' }}>
                          {b.vendor_name}
                        </strong>
                        <div style={{ marginTop: '0.25rem' }}>
                          {isSelected ? (
                            <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.72rem', fontWeight: 800 }}>
                              ✓ Selected (Will Approve)
                            </span>
                          ) : (
                            <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.7rem', fontWeight: 600 }}>
                              ✕ Will be Rejected
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="directorWinner"
                        checked={isSelected}
                        onChange={() => setDirectorSelectedWinnerId(String(b.vendor_id))}
                        style={{ cursor: 'pointer', accentColor: '#2563eb', width: '18px', height: '18px' }}
                      />
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      GSTIN: {b.gstin || '—'}
                    </div>

                    {/* Stock Availability Badges */}
                    {(() => {
                      const items = b.items || [];
                      const avail = items.filter(i => (i.availability || 'Available') === 'Available').length;
                      const onOrder = items.filter(i => i.availability === 'Available on Order').length;
                      const notAvail = items.filter(i => i.availability === 'Not Available').length;

                      return (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                          <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                            🟢 {avail} In Stock
                          </span>
                          {onOrder > 0 && (
                            <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                              🟡 {onOrder} On Order
                            </span>
                          )}
                          {notAvail > 0 && (
                            <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                              🔴 {notAvail} Out of Stock
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Delivery Window */}
                    {(b.lead_from || b.lead_to) && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.45rem' }}>
                        <Calendar size={12} style={{ color: '#38bdf8' }} />
                        <span>{new Date(b.lead_from).toLocaleDateString()} - {new Date(b.lead_to).toLocaleDateString()}</span>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span>Total (Ex-GST):</span>
                        <strong>₹{exGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <span>18% GST (CGST+SGST):</span>
                        <span>₹{gst18.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.25rem' }}>
                        <span>Total (Incl. GST):</span>
                        <span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveViewBid(b);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', marginTop: '0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <Eye size={13} />
                      <span>View Items & Remarks ({b.items?.length || 0})</span>
                    </button>
                  </div>
                );
              })}
          </div>

          {/* Director Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={directorActionLoading || isAssignedToOtherDirector}
                onClick={() => setShowDirectorDeclineModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ color: '#dc2626', borderColor: '#fca5a5', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: isAssignedToOtherDirector ? 0.6 : 1 }}
              >
                <XCircle size={15} />
                <span>Decline RFQ</span>
              </button>
              <button
                type="button"
                disabled={directorActionLoading || isAssignedToOtherDirector}
                onClick={() => setShowSendBackModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: isAssignedToOtherDirector ? 0.6 : 1 }}
              >
                <RotateCcw size={15} />
                <span>Send Back to Purchase</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                type="text"
                disabled={isAssignedToOtherDirector}
                className="form-control"
                placeholder="Optional approval remarks / terms..."
                value={directorNote}
                onChange={(e) => setDirectorNote(e.target.value)}
                style={{ minWidth: '240px', fontSize: '0.85rem' }}
              />
              <button
                type="button"
                disabled={directorActionLoading || isAssignedToOtherDirector}
                onClick={handleDirectorApprove}
                className="btn btn-primary"
                style={{ fontWeight: 700, background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: isAssignedToOtherDirector ? 0.6 : 1 }}
              >
                <CheckCircle2 size={16} />
                <span>{directorActionLoading ? 'Approving...' : (isAssignedToOtherDirector ? 'Assigned to Other Director' : 'Approve Quotes')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Competitive Matrix */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.75rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Vendor Quotation & Bid Comparison Matrix</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Evaluate unit pricing, stock availability, lead delivery times, and brand quality notes.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setMatrixViewMode('summary')}
                className={`btn btn-sm ${matrixViewMode === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', border: 'none' }}
              >
                <Layers size={13} />
                <span>Vendor Summary</span>
              </button>
              <button
                type="button"
                onClick={() => setMatrixViewMode('item-by-item')}
                className={`btn btn-sm ${matrixViewMode === 'item-by-item' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', border: 'none' }}
              >
                <ListFilter size={13} />
                <span>Item-by-Item Matrix</span>
              </button>
            </div>

            <span className="badge badge-draft" style={{ fontSize: '0.8rem' }}>
              <strong>{bids.length}</strong> Bid(s) Submitted
            </span>
          </div>
        </div>

        {bids.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <TrendingDown size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 600 }}>No vendor quotes submitted yet</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Click "Enter Vendor Quote" to record incoming supplier rates, or vendors can submit directly via the Vendor Portal.
            </p>
          </div>
        ) : matrixViewMode === 'summary' ? (
          /* TAB 1: SUMMARY MATRIX */
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  {isPurchaseOrAdmin && <th style={{ width: '45px', textAlign: 'center' }}>Shortlist</th>}
                  <th>Vendor / Supplier</th>
                  <th>Total Quote (Ex-GST)</th>
                  <th>GST (18%) & Total</th>
                  <th>Delivery Window</th>
                  <th>Stock Availability</th>
                  <th>Source</th>
                  <th>Rank / Award</th>
                  <th style={{ textAlign: 'right' }}>Items & Specs</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b, bIdx) => {
                  const isLowest = Number(b.quote_amount) === lowestBidAmount && lowestBidAmount > 0;
                  const isWinner = rfq.winner_vendor_id === b.vendor_id;
                  const isShortlisted = selectedShortlistIds.includes(b.vendor_id);
                  const exGst = Number(b.quote_amount || 0);
                  const grandTotal = Math.round(exGst * 1.18 * 100) / 100;

                  const items = b.items || [];
                  const avail = items.filter(i => (i.availability || 'Available') === 'Available').length;
                  const onOrder = items.filter(i => i.availability === 'Available on Order').length;
                  const notAvail = items.filter(i => i.availability === 'Not Available').length;

                  return (
                    <tr key={b.id} style={{ background: isWinner ? '#ecfdf5' : (isShortlisted ? '#eff6ff' : 'transparent') }}>
                      {isPurchaseOrAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isShortlisted}
                            onChange={() => handleToggleShortlist(b.vendor_id)}
                            style={{ cursor: 'pointer', accentColor: 'var(--primary-600)', width: '16px', height: '16px' }}
                            title="Shortlist vendor for Director review"
                          />
                        </td>
                      )}
                      <td>
                        <strong style={{ fontSize: '0.95rem', color: isWinner ? '#047857' : 'var(--text-primary)' }}>
                          {b.vendor_name}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          GSTIN: {b.gstin || '—'} {b.vendor_phone ? `• 📞 ${b.vendor_phone}` : ''}
                        </div>
                        {b.status === 'Revision Requested' && (
                          <div style={{ marginTop: '0.25rem' }}>
                            <span className="badge" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <RotateCcw size={11} /> Revision Requested (R{b.current_round})
                            </span>
                          </div>
                        )}
                        {b.status === 'Revised Bid Submitted' && (
                          <div style={{ marginTop: '0.25rem' }}>
                            <span className="badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle2 size={11} /> Revised Bid (R{b.current_round})
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        {b.has_submitted || exGst > 0 ? (
                          <>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isLowest ? '#047857' : 'var(--text-primary)' }}>
                              ₹{exGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            {b.latest_revision && b.items?.some(it => it.original_rate !== undefined && it.rate !== it.original_rate) && (
                              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                Orig: <del>₹{Number(b.items?.reduce((s, it) => s + (it.availability === 'Not Available' ? 0 : Number(it.qty || 1) * Number(it.original_rate || it.rate || 0)), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</del>
                              </div>
                            )}
                            {isLowest && (
                              <span className="badge badge-verified" style={{ fontSize: '0.7rem' }}>
                                L1 Lowest Bid
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.72rem', fontWeight: 600 }}>
                            Awaiting Quote
                          </span>
                        )}
                      </td>
                      <td>
                        {b.has_submitted || exGst > 0 ? (
                          <>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              ₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              (incl. 18% GST)
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {b.has_submitted ? (
                          b.lead_from && b.lead_to ? (
                            <span style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Calendar size={13} style={{ color: 'var(--primary-600)' }} />
                              <span>{new Date(b.lead_from).toLocaleDateString()} to {new Date(b.lead_to).toLocaleDateString()}</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Clock size={13} />
                              <span>{b.delivery_days || 3} days lead time</span>
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pending Quote</span>
                        )}
                      </td>
                      <td>
                        {b.has_submitted && items.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                              🟢 {avail} In Stock
                            </span>
                            {onOrder > 0 && (
                              <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                                🟡 {onOrder} On Order
                              </span>
                            )}
                            {notAvail > 0 && (
                              <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                                🔴 {notAvail} Unavailable
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {b.entered_by === 'vendor-link' ? (
                          <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.72rem', fontWeight: 600 }}>
                            🟢 Direct Link / WhatsApp
                          </span>
                        ) : b.entered_by === 'vendor' ? (
                          <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.72rem', fontWeight: 600 }}>
                            Portal Login
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {b.entered_by || 'vendor'}
                          </span>
                        )}
                      </td>
                      <td>
                        {isWinner ? (
                          <span className="badge badge-approved" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 700 }}>
                            <Award size={13} />
                            <span>Approved Winner</span>
                          </span>
                        ) : (rfq.winner_vendor_id || ['Approved', 'Director Approved', 'Awarded'].includes(rfq.status)) ? (
                          <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
                            <XCircle size={13} />
                            <span>Rejected (Not Selected)</span>
                          </span>
                        ) : isShortlisted ? (
                          <span className="badge badge-issued">
                            Shortlisted
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Rank #{bIdx + 1}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setActiveViewBid(b)}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                          >
                            <Eye size={13} />
                            <span>View ({items.length})</span>
                          </button>

                          {isWinner && ['Approved', 'Director Approved', 'Vendor Shortlisted', 'Awarded'].includes(rfq.status) && !isDirector && (
                            <a
                              href={getWinnerShortlistWhatsAppLink(b.vendor_id)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-sm"
                              style={{ background: '#25D366', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', textDecoration: 'none', fontWeight: 700 }}
                              title="Send shortlist award notice and dispatch link to vendor on WhatsApp"
                            >
                              <MessageCircle size={13} />
                              <span>WhatsApp Shortlist</span>
                            </a>
                          )}

                          {isDirector && isWinner && ['Approved', 'Director Approved', 'Vendor Shortlisted', 'Awarded'].includes(rfq.status) && (
                            <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 700, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                              ✓ Approved Winner
                            </span>
                          )}

                          {isDirector && !['Approved', 'Director Approved', 'Director Declined'].includes(rfq.status) && (
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setDirectorSelectedWinnerId(String(b.vendor_id));
                                  handleDirectorApprove();
                                }}
                                disabled={directorActionLoading || isAssignedToOtherDirector}
                                className="btn btn-success btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', padding: '0.25rem 0.55rem' }}
                                title="Approve and award to this vendor"
                              >
                                <Check size={12} />
                                <span>Approve Quote</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowDirectorDeclineModal(true)}
                                disabled={directorActionLoading || isAssignedToOtherDirector}
                                className="btn btn-danger btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.55rem' }}
                                title="Decline this RFQ"
                              >
                                <XCircle size={12} />
                                <span>Decline</span>
                              </button>
                            </div>
                          )}

                          {isPurchaseOrAdmin && !isDirector && rfq.status !== 'Approved' && (
                            <button
                              type="button"
                              onClick={() => handleOpenRateRevision(b)}
                              className="btn btn-warning btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                              title="Edit phone-negotiated rates or request revision"
                            >
                              <Edit3 size={13} />
                              <span>Revise / Negotiate Rates</span>
                            </button>
                          )}

                          {!isDirector && b.status === 'Revision Requested' && (
                            <a
                              href={getVendorRevisionWhatsAppLink(b)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-sm"
                              style={{ background: '#25D366', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', textDecoration: 'none' }}
                              title="Share revision link via WhatsApp"
                            >
                              <MessageCircle size={13} />
                              <span>WhatsApp Revision</span>
                            </a>
                          )}

                          {b.status === 'Revision Requested' && (
                            <a
                              href={getVendorRevisionEmailLink(b)}
                              className="btn btn-sm btn-secondary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#2563eb', textDecoration: 'none' }}
                              title="Send revision request via Email"
                            >
                              <Mail size={13} />
                              <span>Email</span>
                            </a>
                          )}

                          {b.revisions && b.revisions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setActiveHistoryBid(b)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                              title="View revision rounds and negotiations"
                            >
                              <History size={13} />
                              <span>History ({b.revisions.length})</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 2: SIDE-BY-SIDE ITEM COMPARISON MATRIX */
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Request Line Item</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Required Qty</th>
                  {bids.map(b => (
                    <th key={b.id} style={{ minWidth: '220px', background: selectedShortlistIds.includes(b.vendor_id) ? '#eff6ff' : 'transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.92rem', color: rfq.winner_vendor_id === b.vendor_id ? '#047857' : 'var(--primary-700)' }}>
                          {b.vendor_name}
                        </strong>
                        {rfq.winner_vendor_id === b.vendor_id ? (
                          <span className="badge badge-approved" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>
                            ✓ Approved Winner
                          </span>
                        ) : (rfq.winner_vendor_id || ['Approved', 'Director Approved', 'Awarded'].includes(rfq.status)) ? (
                          <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>
                            ✕ Rejected
                          </span>
                        ) : selectedShortlistIds.includes(b.vendor_id) ? (
                          <span className="badge badge-issued" style={{ fontSize: '0.65rem' }}>Shortlisted</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {b.has_submitted || Number(b.quote_amount) > 0 ? (
                          `Total: ₹${Number(b.quote_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        ) : (
                          'Status: Awaiting Quote'
                        )}
                      </div>
                      {b.status === 'Revision Requested' && (
                        <div style={{ marginTop: '0.2rem' }}>
                          <span className="badge" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                            Revision Requested (R{b.current_round})
                          </span>
                        </div>
                      )}
                      {b.status === 'Revised Bid Submitted' && (
                        <div style={{ marginTop: '0.2rem' }}>
                          <span className="badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                            Revised Bid (R{b.current_round})
                          </span>
                        </div>
                      )}
                      {isPurchaseOrAdmin && rfq.status !== 'Approved' && (
                        <div style={{ marginTop: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenRateRevision(b)}
                            className="btn btn-warning btn-sm"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                          >
                            <Edit3 size={12} />
                            <span>Revise Rates</span>
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(rfq.items || []).map((prItem, prIdx) => {
                  const validItemRates = bids.map(b => {
                    const it = (b.items || []).find(bi => bi.id === prItem.id || bi.description?.trim().toLowerCase() === prItem.description?.trim().toLowerCase()) || (b.items || [])[prIdx];
                    if (!it || it.availability === 'Not Available' || !Number(it.rate)) return null;
                    return Number(it.rate);
                  }).filter(r => r !== null);
                  const minItemRate = validItemRates.length > 0 ? Math.min(...validItemRates) : null;

                  return (
                    <tr key={prItem.id || prIdx}>
                      <td>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{prItem.description}</strong>
                        {prItem.spec && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spec: {prItem.spec}</div>}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {Number(parseFloat(prItem.quantity || 0))} {prItem.unit}
                      </td>
                      {bids.map(b => {
                        const it = (b.items || []).find(bi => bi.id === prItem.id || bi.description?.trim().toLowerCase() === prItem.description?.trim().toLowerCase()) || (b.items || [])[prIdx];
                        if (!it) {
                          return (
                            <td key={b.id} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              — Not Quoted —
                            </td>
                          );
                        }
                        const isNotAvail = it.availability === 'Not Available';
                        const isBestRate = minItemRate !== null && Number(it.rate) === minItemRate && !isNotAvail;

                        return (
                          <td key={b.id} style={{ background: isBestRate ? '#ecfdf5' : 'transparent', verticalAlign: 'top' }}>
                            {isNotAvail ? (
                              <div style={{ textAlign: 'center', padding: '0.4rem 0' }}>
                                <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '0.75rem' }}>
                                  🔴 Out of Stock
                                </span>
                              </div>
                            ) : (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                  <div>
                                    <span style={{ fontSize: '1rem', fontWeight: 800, color: isBestRate ? '#047857' : 'var(--text-primary)' }}>
                                      ₹{Number(it.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                    {it.original_rate !== undefined && it.rate !== it.original_rate && (
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        Orig: <del>₹{Number(it.original_rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</del>
                                      </div>
                                    )}
                                  </div>
                                  {isBestRate && (
                                    <span className="badge badge-verified" style={{ fontSize: '0.65rem' }}>
                                      ★ L1 Best
                                    </span>
                                  )}
                                </div>

                                <div style={{ marginBottom: '0.3rem' }}>
                                  {it.availability === 'Available on Order' ? (
                                    <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.68rem' }}>
                                      🟡 On Order
                                    </span>
                                  ) : (
                                    <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.68rem' }}>
                                      🟢 In Stock
                                    </span>
                                  )}
                                </div>

                                {(it.lead_from || b.lead_from) && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                    <Calendar size={11} />
                                    <span>{new Date(it.lead_from || b.lead_from).toLocaleDateString()} - {new Date(it.lead_to || b.lead_to).toLocaleDateString()}</span>
                                  </div>
                                )}

                                {it.remarks && (
                                  <div style={{ fontSize: '0.73rem', color: 'var(--primary-700)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                    "{it.remarks}"
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Shortlisting Submission Bar for Purchase Role */}
        {isPurchaseOrAdmin && bids.length > 0 && rfq.status !== 'Approved' && (
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                <strong>{selectedShortlistIds.length}</strong> of {bids.length} vendor(s) selected for shortlist
              </span>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Auto-ticks top 3 lowest totals. If overriding, supply a reason below for Director review.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e3a8a', whiteSpace: 'nowrap' }}>
                  🏛️ Send to Director:
                </span>
                <select
                  className="form-control"
                  value={selectedDirectorId}
                  onChange={(e) => setSelectedDirectorId(e.target.value)}
                  style={{ width: '185px', fontSize: '0.82rem', fontWeight: 600, borderColor: '#3b82f6', background: '#eff6ff', color: '#1e40af' }}
                >
                  {directors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                className="form-control"
                placeholder="Reason if overriding 3 lowest bids..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                style={{ width: '240px', fontSize: '0.85rem' }}
              />
              <button
                type="button"
                disabled={shortlistingLoading || selectedShortlistIds.length === 0}
                onClick={handleSendToDirector}
                className="btn btn-primary"
                style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                <Send size={15} />
                <span>{shortlistingLoading ? 'Sending...' : 'Shortlist and Send to Director'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enter Vendor Quote Modal */}
      {showBidModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '900px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Enter Vendor Quotation Bid
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Record rates, stock availability, delivery dates, and brand quality notes for {rfq.rfq_no}. Moves RFQ to "Bids In".
                </p>
              </div>
              <button onClick={() => setShowBidModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleSubmitBid}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Select Vendor / Supplier *</label>
                  <select
                    className="form-control"
                    value={bidVendorId}
                    onChange={(e) => setBidVendorId(e.target.value)}
                    required
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.gstin ? `(${v.gstin})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Quote Entry Channel</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsLoggedByPurchase(false)}
                      className={`btn btn-sm ${!isLoggedByPurchase ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Vendor Direct Portal
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLoggedByPurchase(true)}
                      className={`btn btn-sm ${isLoggedByPurchase ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      <PhoneCall size={13} />
                      <span>Logged by Purchase</span>
                    </button>
                  </div>
                </div>
              </div>

              {isLoggedByPurchase && (
                <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', padding: '0.65rem 0.85rem', borderRadius: '4px', marginBottom: '1rem', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-700)' }}>Received via:</span>
                  <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input type="radio" name="sourceNote" checked={quoteSourceNote === 'phone'} onChange={() => setQuoteSourceNote('phone')} style={{ accentColor: 'var(--primary-600)' }} />
                    Phone Call
                  </label>
                  <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input type="radio" name="sourceNote" checked={quoteSourceNote === 'email'} onChange={() => setQuoteSourceNote('email')} style={{ accentColor: 'var(--primary-600)' }} />
                    Email / WhatsApp
                  </label>
                </div>
              )}

              {/* Global Delivery Window & Availability Helpers */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Batch Presets (Delivery Window & Stock Availability):
                </span>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Expected Delivery:</span>
                    <input
                      type="date"
                      className="form-control"
                      value={globalLeadTo || globalLeadFrom}
                      onChange={(e) => {
                        setGlobalLeadTo(e.target.value);
                        setGlobalLeadFrom(e.target.value);
                      }}
                      style={{ width: '140px', fontSize: '0.82rem', padding: '0.25rem 0.4rem' }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyGlobalLead}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      Apply to All
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Set Availability:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = quotedItems.map(it => ({ ...it, availability: 'Available' }));
                        setQuotedItems(updated);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', color: '#34d399' }}
                    >
                      All In Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = quotedItems.map(it => ({ ...it, availability: 'Available on Order' }));
                        setQuotedItems(updated);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', color: '#f59e0b' }}
                    >
                      All On Order
                    </button>
                  </div>
                </div>
              </div>

              {/* Line items quote inputs */}
              <div className="table-responsive" style={{ maxHeight: '340px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>Item & Spec</th>
                      <th style={{ width: '10%' }}>Req. Qty</th>
                      <th style={{ width: '22%' }}>Stock Availability *</th>
                      <th style={{ width: '14%' }}>Rate Ex-GST (₹) *</th>
                      <th style={{ width: '24%' }}>Expected Delivery & Brand Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotedItems.map((item, idx) => {
                      const isNotAvail = item.availability === 'Not Available';
                      const lineTotal = isNotAvail ? 0 : Number(item.qty || 0) * Number(item.rate || 0);

                      return (
                        <tr key={idx} style={{ background: isNotAvail ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                          <td>
                            <strong>{item.description}</strong>
                            {item.spec && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spec: {item.spec}</div>}
                          </td>
                          <td>
                            <strong>{Number(parseFloat(item.qty || 0))}</strong> {item.unit}
                          </td>
                          <td>
                            <select
                              className="form-control"
                              value={item.availability || 'Available'}
                              onChange={(e) => handleItemFieldChange(idx, 'availability', e.target.value)}
                              style={{
                                fontSize: '0.8rem',
                                padding: '0.3rem 0.5rem',
                                fontWeight: 600,
                                color: item.availability === 'Available' ? '#34d399' : (item.availability === 'Available on Order' ? '#f59e0b' : '#ef4444')
                              }}
                            >
                              <option value="Available">🟢 Available (In Stock)</option>
                              <option value="Available on Order">🟡 Available on Order (Will arrange)</option>
                              <option value="Not Available">🔴 Not Available (Out of stock)</option>
                            </select>
                          </td>
                          <td>
                            {isNotAvail ? (
                              <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                                Out of Stock
                              </span>
                            ) : (
                              <div>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  required={!isNotAvail}
                                  className="form-control"
                                  value={item.rate || ''}
                                  onChange={(e) => handleItemFieldChange(idx, 'rate', e.target.value)}
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                                />
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                  ₹{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>Delivery:</span>
                                <input
                                  type="date"
                                  className="form-control"
                                  title="Expected Delivery Date"
                                  value={item.lead_to || item.lead_from || ''}
                                  onChange={(e) => {
                                    handleItemFieldChange(idx, 'lead_to', e.target.value);
                                    handleItemFieldChange(idx, 'lead_from', e.target.value);
                                  }}
                                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.35rem', flex: 1 }}
                                />
                              </div>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Brand make / remarks (optional)"
                                value={item.remarks || ''}
                                onChange={(e) => handleItemFieldChange(idx, 'remarks', e.target.value)}
                                style={{ fontSize: '0.76rem', padding: '0.25rem 0.45rem' }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Quote Summary */}
              {(() => {
                const subtotal = quotedItems.reduce((sum, item) => {
                  if (item.availability === 'Not Available') return sum;
                  return sum + (Number(item.qty || 0) * Number(item.rate || 0));
                }, 0);
                const gst = Math.round(subtotal * 0.18 * 100) / 100;
                const grandTotal = Math.round((subtotal + gst) * 100) / 100;
                const availCount = quotedItems.filter(it => it.availability !== 'Not Available').length;

                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: '4px', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-700)' }}>
                        {availCount} of {quotedItems.length} items quoted available
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Ex-GST: ₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} • 18% GST: ₹{gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                      Grand Total: ₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowBidModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                  <Send size={15} />
                  <span>Submit Vendor Quote</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Full Bid Items & Quotation Details */}
      {activeViewBid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '880px', width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: 0, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {activeViewBid.vendor_name}
                  </h3>
                  {Number(activeViewBid.quote_amount) === lowestBidAmount && lowestBidAmount > 0 && (
                    <span className="badge badge-verified" style={{ fontSize: '0.72rem' }}>
                      L1 Lowest Bid
                    </span>
                  )}
                  {rfq.winner_vendor_id === activeViewBid.vendor_id && (
                    <span className="badge badge-approved" style={{ fontSize: '0.72rem' }}>
                      Awarded Winner
                    </span>
                  )}
                  {selectedShortlistIds.includes(activeViewBid.vendor_id) && (
                    <span className="badge badge-issued" style={{ fontSize: '0.72rem' }}>
                      Shortlisted
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  GSTIN: {activeViewBid.gstin || '—'} {activeViewBid.vendor_phone ? `• 📞 ${activeViewBid.vendor_phone}` : ''} • Channel: <strong>{activeViewBid.entered_by || 'vendor'}</strong>
                </div>
              </div>
              <button onClick={() => setActiveViewBid(null)} className="close-btn">×</button>
            </div>

            {/* Availability Badges Banner */}
            {(() => {
              const items = activeViewBid.items || [];
              const availCount = items.filter(it => (it.availability || 'Available') === 'Available').length;
              const onOrderCount = items.filter(it => it.availability === 'Available on Order').length;
              const notAvailCount = items.filter(it => it.availability === 'Not Available').length;

              return (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.65rem 0.85rem', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Stock Availability:</span>
                  <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.75rem' }}>
                    🟢 {availCount} In Stock (Ready)
                  </span>
                  {onOrderCount > 0 && (
                    <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.75rem' }}>
                      🟡 {onOrderCount} On Order (Will Arrange)
                    </span>
                  )}
                  {notAvailCount > 0 && (
                    <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '0.75rem' }}>
                      🔴 {notAvailCount} Not Available (Out of stock)
                    </span>
                  )}
                  {(activeViewBid.lead_from || activeViewBid.lead_to) && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={13} />
                      <span>{new Date(activeViewBid.lead_from).toLocaleDateString()} to {new Date(activeViewBid.lead_to).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Line Items Table */}
            <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Item & Spec</th>
                    <th>Req. Qty</th>
                    <th>Stock Availability</th>
                    <th>Rate Ex-GST (₹)</th>
                    <th>Line Total (₹)</th>
                    <th>Delivery & Quality Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeViewBid.items || []).map((it, idx) => {
                    const isNotAvail = it.availability === 'Not Available';
                    const qty = Number(it.qty || it.quantity || 1);
                    const rate = Number(it.rate || 0);
                    const lineTotal = isNotAvail ? 0 : qty * rate;

                    return (
                      <tr key={idx} style={{ background: isNotAvail ? '#fef2f2' : 'transparent' }}>
                        <td>
                          <strong>{it.description}</strong>
                          {it.spec && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spec: {it.spec}</div>}
                        </td>
                        <td>
                          <strong>{qty}</strong> {it.unit || 'Nos'}
                        </td>
                        <td>
                          {it.availability === 'Not Available' ? (
                            <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '0.75rem' }}>
                              🔴 Not Available
                            </span>
                          ) : it.availability === 'Available on Order' ? (
                            <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.75rem' }}>
                              🟡 Available on Order
                            </span>
                          ) : (
                            <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.75rem' }}>
                              🟢 Available (In Stock)
                            </span>
                          )}
                        </td>
                        <td>
                          {isNotAvail ? (
                            <span style={{ color: '#b91c1c', fontSize: '0.8rem' }}>—</span>
                          ) : (
                            <strong style={{ fontSize: '0.92rem' }}>₹{rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                          )}
                        </td>
                        <td>
                          {isNotAvail ? (
                            <span style={{ color: '#b91c1c', fontSize: '0.8rem' }}>Out of Stock</span>
                          ) : (
                            <strong style={{ color: 'var(--primary-700)' }}>₹{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.78rem' }}>
                            {(it.lead_from || activeViewBid.lead_from) && (
                              <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Calendar size={11} />
                                <span>{new Date(it.lead_from || activeViewBid.lead_from).toLocaleDateString()} to {new Date(it.lead_to || activeViewBid.lead_to).toLocaleDateString()}</span>
                              </div>
                            )}
                            {it.remarks && (
                              <div style={{ color: 'var(--primary-700)', fontStyle: 'italic', marginTop: '0.15rem' }}>
                                "{it.remarks}"
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            {(() => {
              const exGst = Number(activeViewBid.quote_amount || 0);
              const gst = Math.round(exGst * 0.18 * 100) / 100;
              const grand = Math.round((exGst + gst) * 100) / 100;

              return (
                <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    CGST 9% + SGST 9% standard GST applies. Unavailable items excluded from total.
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Total Ex-GST: <strong>₹{exGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> • GST (18%): <strong>₹{gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
                      Grand Total (Incl. GST): ₹{grand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {isPurchaseOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleShortlist(activeViewBid.vendor_id);
                    }}
                    className={`btn btn-sm ${selectedShortlistIds.includes(activeViewBid.vendor_id) ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Check size={14} />
                    <span>{selectedShortlistIds.includes(activeViewBid.vendor_id) ? 'Remove from Shortlist' : 'Add to Shortlist'}</span>
                  </button>
                )}

                {isPurchaseOrAdmin && rfq.status !== 'Approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      const bidToRevise = activeViewBid;
                      setActiveViewBid(null);
                      handleOpenRateRevision(bidToRevise);
                    }}
                    className="btn btn-warning btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                  >
                    <Edit3 size={14} />
                    <span>Revise Rates / Send for Revision</span>
                  </button>
                )}

                {activeViewBid.revisions && activeViewBid.revisions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const bidWithHistory = activeViewBid;
                      setActiveViewBid(null);
                      setActiveHistoryBid(bidWithHistory);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <History size={14} />
                    <span>Revision History ({activeViewBid.revisions.length})</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setActiveViewBid(null)} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Revision Modal (Purchase Manager negotiates rates with vendor) */}
      {activeRevisionBid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1250, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '920px', width: '100%', maxHeight: '92vh', overflowY: 'auto', margin: 0, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Revise Vendor Rates & Send for Revision
                  </h3>
                  <span className="badge badge-issued" style={{ fontSize: '0.75rem' }}>
                    Round {(Number(activeRevisionBid.current_round) || 0) + 1}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  Vendor: <strong style={{ color: 'var(--primary-700)' }}>{activeRevisionBid.vendor_name}</strong> • RFQ: <strong>{rfq.rfq_no}</strong>. Edit the proposed rates below. The vendor will receive an in-app notification & email to review and accept or submit final counter rates.
                </p>
              </div>
              <button onClick={() => setActiveRevisionBid(null)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleSendBidRevision}>
              {/* Line Items Table with editable rates */}
              <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '32%' }}>Item Description & Spec</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>Req. Qty</th>
                      <th style={{ width: '18%' }}>Original Vendor Rate (₹)</th>
                      <th style={{ width: '22%' }}>Revised Proposed Rate (₹) *</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>Revised Total Ex-GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revisionItems.map((item, idx) => {
                      const isNotAvail = item.availability === 'Not Available' || item.availability === 'Unavailable';
                      const origRate = Number(item.original_rate || 0);
                      const revRate = Number(item.revised_rate || 0);
                      const qty = Number(item.qty || 1);
                      const lineTotal = isNotAvail ? 0 : qty * revRate;
                      const hasDiscount = revRate > 0 && revRate < origRate;

                      return (
                        <tr key={idx} style={{ background: isNotAvail ? '#fef2f2' : 'transparent' }}>
                          <td>
                            <strong>{item.description}</strong>
                            {item.spec && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spec: {item.spec}</div>}
                            <div style={{ marginTop: '0.2rem' }}>
                              <span className="badge" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', background: isNotAvail ? '#fef2f2' : '#ecfdf5', color: isNotAvail ? '#b91c1c' : '#047857', border: `1px solid ${isNotAvail ? '#fecaca' : '#a7f3d0'}` }}>
                                {item.availability || 'Available'}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {qty} {item.unit}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                              ₹{origRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Original Bid</span>
                          </td>
                          <td>
                            {isNotAvail ? (
                              <span style={{ color: '#b91c1c', fontSize: '0.8rem', fontWeight: 600 }}>Not Available</span>
                            ) : (
                              <div>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  required
                                  className="form-control"
                                  value={item.revised_rate}
                                  onChange={(e) => handleRevisionRateChange(idx, e.target.value)}
                                  style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    padding: '0.35rem 0.55rem',
                                    borderColor: hasDiscount ? '#10b981' : 'var(--border-color)',
                                    color: hasDiscount ? '#047857' : 'var(--text-primary)'
                                  }}
                                  placeholder="Enter revised rate"
                                />
                                {hasDiscount && (
                                  <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600, marginTop: '0.15rem' }}>
                                    Savings: ₹{(origRate - revRate).toFixed(2)}/unit (-{(((origRate - revRate) / origRate) * 100).toFixed(1)}%)
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isNotAvail ? (
                              <span style={{ color: '#b91c1c', fontSize: '0.8rem' }}>—</span>
                            ) : (
                              <strong style={{ color: 'var(--primary-700)', fontSize: '0.95rem' }}>
                                ₹{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </strong>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Real-time Recalculated Financial Summary */}
              {(() => {
                const origSubtotal = revisionItems.reduce((sum, it) => {
                  if (it.availability === 'Not Available' || it.availability === 'Unavailable') return sum;
                  return sum + (Number(it.qty || 1) * Number(it.original_rate || 0));
                }, 0);

                const revSubtotal = revisionItems.reduce((sum, it) => {
                  if (it.availability === 'Not Available' || it.availability === 'Unavailable') return sum;
                  return sum + (Number(it.qty || 1) * Number(it.revised_rate || 0));
                }, 0);

                const origGst = Math.round(origSubtotal * 0.18 * 100) / 100;
                const origGrand = Math.round((origSubtotal + origGst) * 100) / 100;

                const revCgst = Math.round(revSubtotal * 0.09 * 100) / 100;
                const revSgst = Math.round(revSubtotal * 0.09 * 100) / 100;
                const revGst = Math.round((revCgst + revSgst) * 100) / 100;
                const revGrand = Math.round((revSubtotal + revGst) * 100) / 100;

                const savings = Math.round((origGrand - revGrand) * 100) / 100;

                return (
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Original Bid Total</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          ₹{origGrand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ex-GST: ₹{origSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Revised Ex-GST Subtotal</span>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                          ₹{revSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CGST 9% (₹{revCgst.toFixed(2)}) + SGST 9% (₹{revSgst.toFixed(2)})</span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Proposed Grand Total (Incl. 18% GST)</span>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0284c7' }}>
                          ₹{revGrand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        {savings > 0 ? (
                          <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                            Target Savings: ₹{savings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        ) : savings < 0 ? (
                          <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                            Increase: ₹{Math.abs(savings).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No change from original</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Optional Remarks */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">
                  Negotiation Note / Remark for Vendor (Optional)
                </label>
                <textarea
                  rows="2"
                  className="form-control"
                  placeholder="e.g. Please consider volume discount of 5% on item 1 for bulk supply, or confirm revised delivery timeline..."
                  value={revisionRemarks}
                  onChange={(e) => setRevisionRemarks(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              {/* Director Selection Box (For instant 1-click Shortlist & Send) */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.88rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>👔 Send for Director Approval:</span>
                    </strong>
                    <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '0.15rem' }}>
                      Choose Director to receive this negotiated quote for final review & PO approval:
                    </div>
                  </div>
                  <select
                    className="form-control"
                    value={selectedDirectorId}
                    onChange={(e) => setSelectedDirectorId(e.target.value)}
                    style={{ width: 'auto', minWidth: '190px', fontWeight: 600, fontSize: '0.85rem', borderColor: '#86efac' }}
                  >
                    {directors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (Director)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveRevisionBid(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Option 1: Send link to vendor (Online Revision) */}
                  <button
                    type="button"
                    onClick={handleSendBidRevision}
                    disabled={sendingRevisionLoading || savingNegotiationLoading}
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
                    title="Send revision link to vendor via WhatsApp/Email to confirm online"
                  >
                    <Send size={14} />
                    <span>{sendingRevisionLoading ? 'Sending...' : 'Send Online Link to Vendor'}</span>
                  </button>

                  {/* Option 2: Save Negotiated Rates Only */}
                  <button
                    type="button"
                    onClick={() => handleSaveNegotiatedRates(false)}
                    disabled={savingNegotiationLoading || sendingRevisionLoading}
                    className="btn btn-outline-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      borderColor: 'var(--primary-600)',
                      color: 'var(--primary-700)'
                    }}
                    title="Save negotiated rates directly into the comparison matrix"
                  >
                    <Check size={15} />
                    <span>{savingNegotiationLoading ? 'Saving...' : '💾 Save Negotiated Rates'}</span>
                  </button>

                  {/* Option 3: 1-Click Save Negotiated Rates & Send directly to Director */}
                  <button
                    type="button"
                    onClick={() => handleSaveNegotiatedRates(true)}
                    disabled={savingNegotiationLoading || sendingRevisionLoading}
                    className="btn btn-success"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      background: '#16a34a',
                      borderColor: '#15803d',
                      color: '#fff',
                      boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.25)'
                    }}
                    title="Save negotiated rates, shortlist this vendor, and immediately send RFQ to Director for approval"
                  >
                    <Send size={15} />
                    <span>{savingNegotiationLoading ? 'Saving & Forwarding...' : '⚡ Save & Send to Director'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bid Revision History Modal */}
      {activeHistoryBid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1250, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: 0, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={18} style={{ color: 'var(--primary-600)' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Bid Revision & Negotiation History
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  Vendor: <strong style={{ color: 'var(--primary-700)' }}>{activeHistoryBid.vendor_name}</strong> • RFQ: <strong>{rfq.rfq_no}</strong> • Total Rounds: <strong>{activeHistoryBid.revisions?.length || 0}</strong>
                </p>
              </div>
              <button onClick={() => setActiveHistoryBid(null)} className="close-btn">×</button>
            </div>

            {(!activeHistoryBid.revisions || activeHistoryBid.revisions.length === 0) ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No rate revision rounds have been requested for this vendor bid yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                {activeHistoryBid.revisions.map((rev) => (
                  <div 
                    key={rev.id} 
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                      background: rev.status === 'Revised Bid Submitted' ? '#f0fdf4' : '#fffbeb'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge" style={{ background: '#0284c7', color: '#ffffff', fontWeight: 800, fontSize: '0.78rem' }}>
                          Round {rev.round}
                        </span>
                        <span className={`badge badge-${rev.status === 'Revised Bid Submitted' ? 'approved' : 'issued'}`} style={{ fontSize: '0.75rem' }}>
                          {rev.status}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Requested on {new Date(rev.created_at).toLocaleString()} by <strong>{rev.requested_by_name || 'Purchase Manager'}</strong>
                      </span>
                    </div>

                    {rev.request_remarks && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', background: 'rgba(255, 255, 255, 0.7)', padding: '0.5rem 0.75rem', borderRadius: '4px', marginBottom: '0.75rem', border: '1px solid rgba(0,0,0,0.06)' }}>
                        <strong>Manager Remark:</strong> "{rev.request_remarks}"
                      </div>
                    )}

                    {/* Items table for this round */}
                    <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto', background: '#ffffff', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                      <table className="table" style={{ margin: 0, fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th style={{ textAlign: 'center' }}>Qty</th>
                            <th>Original Rate</th>
                            <th>Manager Proposed Rate</th>
                            <th>Vendor Final Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rev.items || []).map((ri, rIdx) => (
                            <tr key={ri.id || rIdx}>
                              <td>
                                <strong>{ri.description}</strong>
                                {ri.spec && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ri.spec}</div>}
                              </td>
                              <td style={{ textAlign: 'center' }}>{ri.quantity} {ri.unit}</td>
                              <td>₹{Number(ri.original_rate || 0).toFixed(2)}</td>
                              <td style={{ color: '#0284c7', fontWeight: 600 }}>₹{Number(ri.revised_rate || 0).toFixed(2)}</td>
                              <td>
                                {ri.final_rate !== null && ri.final_rate !== undefined ? (
                                  <strong style={{ color: '#047857' }}>₹{Number(ri.final_rate).toFixed(2)}</strong>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Response</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Response details if vendor responded */}
                    {rev.responded_at ? (
                      <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '4px', border: '1px solid #bbf7d0', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ color: '#15803d', fontWeight: 700 }}>
                            Vendor Response: {rev.response_type}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Responded on {new Date(rev.responded_at).toLocaleString()}
                          </span>
                        </div>
                        {rev.vendor_remarks && (
                          <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                            <strong>Vendor Note:</strong> "{rev.vendor_remarks}"
                          </div>
                        )}
                        <div style={{ marginTop: '0.35rem', fontWeight: 700, color: '#047857' }}>
                          Final Total: ₹{Number(rev.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} (Incl. 18% GST)
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Awaiting vendor action via Vendor Portal.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button type="button" onClick={() => setActiveHistoryBid(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Back To Purchase Modal */}
      {showSendBackModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', color: '#b91c1c' }}>
              Return RFQ to Purchase Department
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              State instructions or feedback for the Purchase team. The RFQ status will revert to "Bids In".
            </p>
            <form onSubmit={handleDirectorSendBack}>
              <div className="form-group">
                <label className="form-label">Review Note / Instructions *</label>
                <textarea
                  rows="3"
                  required
                  className="form-control"
                  placeholder="e.g. Quotations are above budget. Request revision or negotiate better terms with vendor..."
                  value={directorNote}
                  onChange={(e) => setDirectorNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowSendBackModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={directorActionLoading} className="btn btn-danger">
                  {directorActionLoading ? 'Returning...' : 'Return to Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showRevisionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Issue RFQ Revision (RA{((Number(rfq.current_rev) || 0) + 1)})
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              A revision archives past bids and asks vendors to re-quote. A mandatory reason is required.
            </p>
            <form onSubmit={handleCreateRevision}>
              <div className="form-group">
                <label className="form-label">Mandatory Revision Reason *</label>
                <textarea
                  rows="3"
                  required
                  className="form-control"
                  placeholder="e.g. Site scope updated, quantities changed, or extended deadline for competitive bidding..."
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Submission Deadline</label>
                <input
                  type="date"
                  className="form-control"
                  value={revisionDeadline}
                  onChange={(e) => setRevisionDeadline(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowRevisionModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Issue Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Director Decline RFQ Modal */}
      {showDirectorDeclineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', margin: 0, boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={20} style={{ color: '#dc2626' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#b91c1c' }}>
                  Decline RFQ (Director)
                </h3>
              </div>
              <button onClick={() => setShowDirectorDeclineModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleConfirmDirectorDecline}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Decline Reason / Remark * (Mandatory)
                </label>
                <textarea
                  rows="3"
                  className="form-control"
                  placeholder="Please state why the RFQ or proposed vendor quotations are declined..."
                  value={directorDeclineRemark}
                  onChange={(e) => setDirectorDeclineRemark(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowDirectorDeclineModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={directorActionLoading} className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 700 }}>
                  {directorActionLoading ? 'Declining...' : 'Confirm Decline RFQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Quote Links Modal */}
      {showShareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1250, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: 0, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', borderRadius: '18px' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Share2 size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Share RFQ Quote Links
                  </h3>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  RFQ: <strong>{rfq.rfq_no}</strong> • Site: <strong>{rfq.site_name}</strong>
                </div>
              </div>
              <button 
                onClick={() => setShowShareModal(false)} 
                className="close-btn"
                style={{ fontSize: '1.4rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            {/* Section 1: Universal General Quote Link */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>
                  Universal Public Quote Link
                </span>
                <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 600 }}>
                  Any supplier can open & quote
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.75rem' }}>
                Suppliers who open this link can select their company profile from the list and submit their rates without logging in.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/quote/${rfq.id}`}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.82rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#334155' }}
                />
                <button
                  type="button"
                  onClick={() => handleCopyQuoteLink(null)}
                  className="btn btn-secondary btn-sm"
                  style={{ minWidth: '110px', justifyContent: 'center' }}
                >
                  {copiedVendorId === 'general' ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                  <span>{copiedVendorId === 'general' ? 'Copied!' : 'Copy Link'}</span>
                </button>
                <a
                  href={`/quote/${rfq.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  title="Open public form preview in new tab"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {/* Section 2: Invited Vendors WhatsApp / 1-Click Dispatch */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                  Invited Vendors ({bids.length})
                </h4>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Send personalized links directly via WhatsApp or Email
                </span>
              </div>

              {bids.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                  No vendors are currently attached to this RFQ.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {bids.map((b) => {
                    const hasSubmitted = b.has_submitted || Number(b.quote_amount) > 0;
                    const vObj = {
                      id: b.vendor_id,
                      name: b.vendor_name,
                      phone: b.vendor_phone,
                      email: b.vendor_email
                    };

                    return (
                      <div 
                        key={b.vendor_id}
                        style={{
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{b.vendor_name}</strong>
                            {hasSubmitted ? (
                              <span style={{ background: '#dcfce7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 }}>
                                Quoted: ₹{Number(b.quote_amount || 0).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600 }}>
                                Pending Quote
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', gap: '0.75rem' }}>
                            {b.vendor_phone && <span>📞 {b.vendor_phone}</span>}
                            {b.vendor_email && <span>✉️ {b.vendor_email}</span>}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {/* WhatsApp button */}
                          <a
                            href={getVendorWhatsAppLink(vObj)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm"
                            style={{
                              background: '#25D366',
                              color: '#fff',
                              border: 'none',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              padding: '0.35rem 0.65rem'
                            }}
                            title="Share quote request on WhatsApp with pre-filled message"
                          >
                            <MessageCircle size={14} />
                            <span>WhatsApp</span>
                          </a>

                          {/* Email button */}
                          {b.vendor_email && (
                            <a
                              href={getVendorEmailLink(vObj)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                              title="Send Email"
                            >
                              <Mail size={13} />
                              <span>Email</span>
                            </a>
                          )}

                          {/* Copy Link */}
                          <button
                            type="button"
                            onClick={() => handleCopyQuoteLink(b.vendor_id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                            title="Copy personalized vendor link"
                          >
                            {copiedVendorId === b.vendor_id ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                            <span>{copiedVendorId === b.vendor_id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Generate Link for Any Other Vendor */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                Share with Another Vendor
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.75rem' }}>
                Pick a vendor from your master database to generate their direct quote link:
              </p>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={selectedShareVendorId}
                  onChange={(e) => setSelectedShareVendorId(e.target.value)}
                  className="form-control"
                  style={{ flex: 1, minWidth: '220px' }}
                >
                  <option value="">-- Select Vendor to Share With --</option>
                  {vendors
                    .filter(v => !bids.some(b => Number(b.vendor_id) === Number(v.id)))
                    .map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.phone ? `(${v.phone})` : ''}
                      </option>
                    ))}
                </select>

                {selectedShareVendorId && (() => {
                  const targetV = vendors.find(v => String(v.id) === String(selectedShareVendorId));
                  if (!targetV) return null;
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <a
                        href={getVendorWhatsAppLink(targetV)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm"
                        style={{ background: '#25D366', color: '#fff', border: 'none', fontWeight: 600 }}
                      >
                        <MessageCircle size={14} />
                        <span>WhatsApp</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyQuoteLink(targetV.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        {copiedVendorId === targetV.id ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                        <span>{copiedVendorId === targetV.id ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button 
                type="button" 
                onClick={() => setShowShareModal(false)} 
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
