import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deliveryService } from '@/services/delivery.service.js';
import { poService } from '@/services/po.service.js';
import { masterService } from '@/services/master.service.js';
import { vendorBilledChallanService } from '@/services/vendorBilledChallan.service.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { compressImage } from '@/utils';
import { VendorBilledChallansSection } from './VendorBilledChallansSection.jsx';
import {
  DeliveryStats,
  DeliveryFilters,
  DeliveryTable,
  DeliveryUploadModal,
  DeliveryPhotoGalleryModal,
  DeliveryShareModal,
  DeliveryVendorNoticeModal,
  DeliveryBillModal
} from './components';

export const DeliveriesPage = ({ defaultTab = 'site-receipts' }) => {
  const { user, activeRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeMainTab, setActiveMainTab] = useState(tabFromUrl || defaultTab);

  useEffect(() => {
    if (tabFromUrl && ['site-receipts', 'vendor-challans'].includes(tabFromUrl)) {
      setActiveMainTab(tabFromUrl);
    } else if (defaultTab && !tabFromUrl) {
      setActiveMainTab(defaultTab);
    }
  }, [tabFromUrl, defaultTab]);

  const handleTabChange = (t) => {
    setActiveMainTab(t);
    setSearchParams({ tab: t });
  };

  // Main Data States
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pos, setPos] = useState([]);
  const [sites, setSites] = useState([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [filterCondition, setFilterCondition] = useState('all');

  // Record Delivery Modal & Form States
  const [showModal, setShowModal] = useState(false);
  const [poId, setPoId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('Materials received at site in good physical condition');
  const [damageRemarks, setDamageRemarks] = useState('');
  const [poItems, setPoItems] = useState([]);
  const [challanPhotos, setChallanPhotos] = useState([]);
  const [materialPhotos, setMaterialPhotos] = useState([]);
  const [damagePhotos, setDamagePhotos] = useState([]);

  // Vendor Receipt / Inspection Notice Modal State
  const [vendorNoticeModal, setVendorNoticeModal] = useState(null);
  const [copiedNoticeText, setCopiedNoticeText] = useState(false);

  // Attachment Viewer & Lightbox Modal States
  const [photoGalleryModal, setPhotoGalleryModal] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Share Delivery Schedule Link Modal States
  const [shareModalPo, setShareModalPo] = useState(null);
  const [copiedLinkPoId, setCopiedLinkPoId] = useState(null);

  // Commercial Billed Challan Modals & Form States
  const [billedChallans, setBilledChallans] = useState([]);
  const [billUploadModal, setBillUploadModal] = useState(null);
  const [viewBillModal, setViewBillModal] = useState(null);
  const [billSubmitting, setBillSubmitting] = useState(false);
  const [formBillChallanNo, setFormBillChallanNo] = useState('');
  const [formBillDate, setFormBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [formBillVehicleNo, setFormBillVehicleNo] = useState('');
  const [formBillBasic, setFormBillBasic] = useState('');
  const [formBillFreight, setFormBillFreight] = useState('');
  const [formBillLoading, setFormBillLoading] = useState('');
  const [formBillPack, setFormBillPack] = useState('');
  const [formBillOther, setFormBillOther] = useState('');
  const [formBillGstPct, setFormBillGstPct] = useState('18');
  const [formBillNotes, setFormBillNotes] = useState('');
  const [formBillDoc, setFormBillDoc] = useState(null);

  const canRecordReceipt = ['supervisor', 'pc', 'purchase', 'admin'].includes(activeRole);
  const canUploadBill = ['admin', 'purchase'].includes(activeRole);

  // Financial calculations for bill modal
  const numBillBasic = Number(formBillBasic) || 0;
  const numBillFreight = Number(formBillFreight) || 0;
  const numBillLoading = Number(formBillLoading) || 0;
  const numBillPack = Number(formBillPack) || 0;
  const numBillOther = Number(formBillOther) || 0;
  const numBillGstPct = Number(formBillGstPct) || 0;
  const billSubtotal = numBillBasic + numBillFreight + numBillLoading + numBillPack + numBillOther;
  const billGstAmount = Math.round((billSubtotal * (numBillGstPct / 100)) * 100) / 100;
  const billGrandTotal = billSubtotal + billGstAmount;

  // Data Loading Orchestration
  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const [delData, vbcData] = await Promise.all([
        deliveryService.getDeliveries(),
        vendorBilledChallanService.getChallans().catch(() => [])
      ]);
      setDeliveries(delData || []);
      setBilledChallans(vbcData || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadModalData = async () => {
    try {
      const [posData, sitesData] = await Promise.all([
        poService.getOrders({ limit: 100 }).catch(() => ({ items: [] })),
        masterService.getSites().catch(() => [])
      ]);

      const poList = posData.items || posData.data || (Array.isArray(posData) ? posData : []);
      const pendingPos = poList.filter(p => ['Issued', 'Acknowledged', 'Dispatched'].includes(p.status));
      setPos(pendingPos.length > 0 ? pendingPos : poList);

      if (poList.length > 0) {
        const firstPo = pendingPos.length > 0 ? pendingPos[0] : poList[0];
        setPoId(firstPo.id);
        if (firstPo.site_id) setSiteId(firstPo.site_id);
        if (firstPo.invoice_no) setChallanNo(firstPo.invoice_no);
        loadPoItems(firstPo.id);
      }

      setSites(sitesData || []);
    } catch (err) {
      console.error('Failed to load modal masters:', err);
    }
  };

  const loadPoItems = async (selectedPoId) => {
    try {
      const singlePo = await poService.getPOById(selectedPoId);
      if (singlePo && singlePo.items && Array.isArray(singlePo.items)) {
        setPoItems(
          singlePo.items.map(it => ({
            description: it.description,
            spec: it.spec || '',
            unit: it.unit || 'Nos',
            ordered_qty: Number(it.qty || 0),
            received_qty: Number(it.qty || 0),
            damaged_qty: 0
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load PO items:', err);
    }
  };

  useEffect(() => {
    fetchDeliveries();
    loadModalData();
  }, []);

  // Delivery Form Actions
  const handlePoChange = (selectedPoId) => {
    setPoId(selectedPoId);
    const selectedPo = pos.find((p) => String(p.id) === String(selectedPoId));
    if (selectedPo) {
      if (selectedPo.site_id) setSiteId(selectedPo.site_id);
      if (selectedPo.invoice_no) setChallanNo(selectedPo.invoice_no);
    }
    loadPoItems(selectedPoId);
  };

  const handleOpenReceiptForPo = (selectedPo) => {
    setPoId(selectedPo.id);
    if (selectedPo.site_id) setSiteId(selectedPo.site_id);
    setChallanNo(selectedPo.invoice_no || '');
    loadPoItems(selectedPo.id);
    setShowModal(true);
  };

  const handleItemQtyChange = (index, field, val) => {
    const updated = [...poItems];
    updated[index][field] = Number(val) || 0;
    setPoItems(updated);
  };

  const handleChallanPhotoUpload = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const compressed = [];
      for (const f of Array.from(files)) {
        const c = await compressImage(f);
        compressed.push(c);
      }
      setChallanPhotos(prev => [...prev, ...compressed]);
    } catch (err) {
      alert('Photo compression failed: ' + err.message);
    }
  };

  const handleMaterialPhotoUpload = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const compressed = [];
      for (const f of Array.from(files)) {
        const c = await compressImage(f);
        compressed.push(c);
      }
      setMaterialPhotos(prev => [...prev, ...compressed]);
    } catch (err) {
      alert('Photo compression failed: ' + err.message);
    }
  };

  const handleDamagePhotoUpload = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const compressed = [];
      for (const f of Array.from(files)) {
        const c = await compressImage(f);
        compressed.push(c);
      }
      setDamagePhotos(prev => [...prev, ...compressed]);
    } catch (err) {
      alert('Photo compression failed: ' + err.message);
    }
  };

  // Vendor Notice Message Builder & Sharing
  const buildReceiptVendorMessage = (data) => {
    const { vendor, po_no, site_code, site_name, challan_no, received_date, total_received, total_damaged, damage_remarks, items } = data;
    const vendorName = vendor?.name || 'Partner Vendor';
    
    const itemsLines = (items || []).map((it, idx) => {
      const dmg = Number(it.damaged_qty || 0);
      return `  ${idx + 1}. ${it.description}: ${it.received_qty} ${it.unit} received${dmg > 0 ? ` (⚠️ ${dmg} DAMAGED/DEFECTIVE)` : ' (✓ Intact & OK)'}`;
    }).join('\n');

    return `*Decent Decor Pvt. Ltd. (DDPL)* - Site Material Receipt & Delivery Acknowledgment\n` +
`--------------------------------------------------\n` +
`Hello *${vendorName}*,\n\n` +
`Your shipment for Purchase Order *${po_no}* has been physically received and inspected at project site *${site_code} (${site_name})*.\n\n` +
`*Delivery Information:*\n` +
`• Vendor Challan / Bill: *${challan_no}*\n` +
`• Receipt Date: ${received_date}\n` +
`• Inspection: Physical material & challan verification\n\n` +
`*Line-by-Line Item Verification:*\n` +
`${itemsLines}\n\n` +
`--------------------------------------------------\n` +
`• Total Accepted Pieces: ${Math.max(0, total_received - total_damaged)}\n` +
`• Defective / Damaged Pieces: ${total_damaged > 0 ? `⚠️ ${total_damaged} Damaged Piece(s) Reported` : '✓ 0 (All items in 100% good condition)'}\n` +
(total_damaged > 0 ? `• Defect Notes: ${damage_remarks || 'Physical defects/breakage recorded'}\n⚠️ Photo proof has been logged to DDPL portal. Please coordinate replacement or credit note.\n\n` : '\n') +
`Thank you,\nSite Operations & Purchase Department\nDecent Decor Pvt. Ltd.`;
  };

  const handleSendVendorReceiptWhatsapp = (data) => {
    const phone = (data.vendor?.phone || '').replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(buildReceiptVendorMessage(data));
    const url = phone.length >= 10
      ? `https://api.whatsapp.com/send?phone=91${phone.slice(-10)}&text=${msg}`
      : `https://api.whatsapp.com/send?text=${msg}`;
    window.open(url, '_blank');
  };

  const handleSendVendorReceiptEmail = (data) => {
    const email = data.vendor?.email || '';
    const subject = `Material Receipt & Inspection Report: PO ${data.po_no} (Challan ${data.challan_no}) - DDPL`;
    const body = buildReceiptVendorMessage(data).replace(/\*/g, '');
    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const handleCopyNoticeText = (data) => {
    const text = buildReceiptVendorMessage(data);
    navigator.clipboard.writeText(text);
    setCopiedNoticeText(true);
    setTimeout(() => setCopiedNoticeText(false), 2500);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!poId || !siteId) {
      alert('Please select both Purchase Order and Project Site');
      return;
    }
    if (!challanNo.trim()) {
      alert('Delivery Challan Number is REQUIRED');
      return;
    }
    if (challanPhotos.length === 0) {
      alert('At least 1 Delivery Challan photo (image or PDF) is REQUIRED');
      return;
    }
    if (materialPhotos.length === 0) {
      alert('At least 1 Material photo showing received goods at site is REQUIRED');
      return;
    }

    const totalDamaged = poItems.reduce((acc, it) => acc + (Number(it.damaged_qty) || 0), 0);
    if (totalDamaged > 0 && damagePhotos.length === 0) {
      const confirmProceed = window.confirm(`You reported ${totalDamaged} damaged/defective pieces. We recommend attaching at least 1 Damage Photo as proof for the vendor. Proceed anyway?`);
      if (!confirmProceed) return;
    }

    setSubmitting(true);
    try {
      const res = await deliveryService.recordDelivery({
        po_id: Number(poId),
        site_id: Number(siteId),
        challan_no: challanNo.trim(),
        received_date: receivedDate,
        remarks,
        damage_remarks: damageRemarks,
        received_items: poItems,
        damaged_items: poItems.filter(it => Number(it.damaged_qty) > 0),
        challan_photos: challanPhotos,
        material_photos: materialPhotos,
        damage_photos: damagePhotos
      });

      setShowModal(false);
      setChallanNo('');
      setChallanPhotos([]);
      setMaterialPhotos([]);
      setDamagePhotos([]);
      setDamageRemarks('');
      fetchDeliveries();

      const currentSelectedPo = pos.find((p) => String(p.id) === String(poId));
      const targetVendor = res?.vendor || {
        name: currentSelectedPo?.vendor_name || 'Vendor',
        phone: currentSelectedPo?.vendor_phone || '',
        email: currentSelectedPo?.vendor_email || ''
      };

      setVendorNoticeModal({
        vendor: targetVendor,
        po_no: res?.po_no || currentSelectedPo?.po_no,
        site_code: res?.site_code || currentSelectedPo?.site_code,
        site_name: res?.site_name || currentSelectedPo?.site_name,
        challan_no: challanNo.trim(),
        received_date: receivedDate,
        total_received: poItems.reduce((acc, it) => acc + (Number(it.received_qty) || 0), 0),
        total_damaged: totalDamaged,
        damage_remarks: damageRemarks,
        items: poItems
      });
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delivery Schedule Share URL Helpers
  const getDeliveryShareUrl = (p) => {
    const sigParam = p.delivery_sig ? `&sig=${p.delivery_sig}` : '';
    return `${window.location.origin}/delivery-schedule/${p.id}?v=${p.vendor_id || ''}${sigParam}`;
  };

  const handleCopyDeliveryLink = (p) => {
    const url = getDeliveryShareUrl(p);
    navigator.clipboard.writeText(url);
    setCopiedLinkPoId(p.id);
    setTimeout(() => setCopiedLinkPoId(null), 2500);
  };

  const handleWhatsAppShare = (p) => {
    const url = getDeliveryShareUrl(p);
    const msg = `Hello ${p.vendor_name || 'Vendor'},\n\nPlease specify your expected delivery date and dispatch details for Purchase Order *${p.po_no}* (${p.site_name || 'Site'}):\n${url}\n\nThank you,\nDDPL Purchase Department`;
    const phone = (p.vendor_phone || '').replace(/[^0-9]/g, '');
    const waUrl = phone ? `https://wa.me/91${phone.length === 10 ? phone : phone}?text=${encodeURIComponent(msg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Commercial Billed Challan Handlers
  const handleOpenUploadBill = (del, existingBill = null) => {
    const matchedPo = pos.find(p => String(p.id) === String(del.po_id) || p.po_no === del.po_no);
    setBillUploadModal({
      po_id: del.po_id,
      po_no: del.po_no,
      vendor_id: del.vendor_id || matchedPo?.vendor_id || '',
      vendor_name: del.vendor_name || matchedPo?.vendor_name || '',
      site_id: del.site_id || matchedPo?.site_id || '',
      site_name: del.site_name || matchedPo?.site_name || '',
      existingBill: existingBill || null
    });
    setFormBillChallanNo(existingBill?.challan_no || del.challan_no || '');
    setFormBillDate(existingBill?.challan_date ? existingBill.challan_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormBillVehicleNo(existingBill?.vehicle_no || '');
    setFormBillBasic(existingBill?.basic_amount !== undefined && existingBill?.basic_amount !== null ? String(existingBill.basic_amount) : '');
    setFormBillFreight(existingBill?.freight_charges ? String(existingBill.freight_charges) : '');
    setFormBillLoading(existingBill?.loading_unloading_charges ? String(existingBill.loading_unloading_charges) : '');
    setFormBillPack(existingBill?.packaging_charges ? String(existingBill.packaging_charges) : '');
    setFormBillOther(existingBill?.other_charges ? String(existingBill.other_charges) : '');
    setFormBillGstPct(existingBill?.gst_percent ? String(existingBill.gst_percent) : '18');
    setFormBillNotes(existingBill?.notes || '');
    setFormBillDoc(existingBill?.document_file ? { name: existingBill.document_name || 'Attached_Invoice', dataUrl: existingBill.document_file } : null);
  };

  const handleSaveBill = async (e) => {
    e.preventDefault();
    if (!formBillChallanNo.trim()) {
      alert('Please enter Billed Challan / Invoice number');
      return;
    }
    setBillSubmitting(true);
    try {
      const payload = {
        po_id: Number(billUploadModal.po_id),
        vendor_id: Number(billUploadModal.vendor_id) || undefined,
        site_id: Number(billUploadModal.site_id) || undefined,
        challan_no: formBillChallanNo.trim(),
        challan_date: formBillDate,
        vehicle_no: formBillVehicleNo.trim(),
        basic_amount: numBillBasic,
        freight_charges: numBillFreight,
        loading_unloading_charges: numBillLoading,
        packaging_charges: numBillPack,
        other_charges: numBillOther,
        gst_percent: numBillGstPct,
        gst_amount: billGstAmount,
        total_amount: billGrandTotal,
        document_file: formBillDoc?.dataUrl || null,
        document_name: formBillDoc?.name || null,
        notes: formBillNotes.trim()
      };

      if (billUploadModal.existingBill?.id) {
        await vendorBilledChallanService.updateChallan(billUploadModal.existingBill.id, payload);
      } else {
        await vendorBilledChallanService.createChallan(payload);
      }

      setBillUploadModal(null);
      await fetchDeliveries();
    } catch (err) {
      alert('Failed to save billed challan: ' + (err.response?.data?.message || err.message));
    } finally {
      setBillSubmitting(false);
    }
  };

  // KPI Counter Calculations
  const incomingCount = pos.filter(p => ['Dispatched', 'Acknowledged', 'Issued'].includes(p.status)).length;
  const billedCount = billedChallans.length;
  const defectsCount = deliveries.filter(d => {
    const items = Array.isArray(d.damaged_items) ? d.damaged_items : [];
    const photos = Array.isArray(d.damage_photos) ? d.damage_photos : [];
    return items.reduce((acc, it) => acc + (Number(it.damaged_qty) || 0), 0) > 0 || photos.length > 0;
  }).length;

  return (
    <div>
      {/* Top Header & Search/Tabs Filters */}
      <DeliveryFilters
        activeMainTab={activeMainTab}
        onTabChange={handleTabChange}
        totalReceipts={deliveries.length}
        canRecordReceipt={canRecordReceipt}
        onOpenRecordModal={() => { loadModalData(); setShowModal(true); }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedSite={selectedSite}
        onSiteChange={setSelectedSite}
        sites={sites}
        filterCondition={filterCondition}
        onConditionChange={setFilterCondition}
      />

      {/* Main Tab 2: Vendor Billed Challans */}
      {activeMainTab === 'vendor-challans' && (
        <VendorBilledChallansSection />
      )}

      {/* Main Tab 1: Site Delivery Receipts & Inspections */}
      {activeMainTab === 'site-receipts' && (
        <>
          {error && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {/* KPI Summary Cards */}
          <DeliveryStats
            totalReceipts={deliveries.length}
            incomingCount={incomingCount}
            billedChallansCount={billedCount}
            defectsCount={defectsCount}
          />

          {/* Tables: Incoming Shipments & Verified Site Receipts */}
          <DeliveryTable
            deliveries={deliveries}
            loading={loading}
            pos={pos}
            billedChallans={billedChallans}
            canUploadBill={canUploadBill}
            copiedLinkPoId={copiedLinkPoId}
            onOpenReceiptForPo={handleOpenReceiptForPo}
            onSharePo={(p) => setShareModalPo(p)}
            onOpenUploadBill={handleOpenUploadBill}
            onViewBill={(bill) => setViewBillModal(bill)}
            onOpenPhotoGallery={(gallery) => setPhotoGalleryModal(gallery)}
            onOpenVendorNotice={(notice) => setVendorNoticeModal(notice)}
            searchQuery={searchQuery}
            selectedSite={selectedSite}
            filterCondition={filterCondition}
          />
        </>
      )}

      {/* Record Site Delivery Receipt Modal */}
      <DeliveryUploadModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreate}
        submitting={submitting}
        pos={pos}
        sites={sites}
        poId={poId}
        onPoChange={handlePoChange}
        siteId={siteId}
        onSiteChange={setSiteId}
        challanNo={challanNo}
        onChallanNoChange={setChallanNo}
        receivedDate={receivedDate}
        onReceivedDateChange={setReceivedDate}
        remarks={remarks}
        onRemarksChange={setRemarks}
        damageRemarks={damageRemarks}
        onDamageRemarksChange={setDamageRemarks}
        poItems={poItems}
        onItemQtyChange={handleItemQtyChange}
        challanPhotos={challanPhotos}
        onChallanPhotoUpload={handleChallanPhotoUpload}
        onRemoveChallanPhoto={(idx) => setChallanPhotos(challanPhotos.filter((_, i) => i !== idx))}
        materialPhotos={materialPhotos}
        onMaterialPhotoUpload={handleMaterialPhotoUpload}
        onRemoveMaterialPhoto={(idx) => setMaterialPhotos(materialPhotos.filter((_, i) => i !== idx))}
        damagePhotos={damagePhotos}
        onDamagePhotoUpload={handleDamagePhotoUpload}
        onRemoveDamagePhoto={(idx) => setDamagePhotos(damagePhotos.filter((_, i) => i !== idx))}
        onPreviewPhoto={(url) => setPreviewPhoto(url)}
      />

      {/* Share Delivery Schedule Link Modal */}
      <DeliveryShareModal
        po={shareModalPo}
        onClose={() => setShareModalPo(null)}
        copiedLinkPoId={copiedLinkPoId}
        onCopyLink={handleCopyDeliveryLink}
        onWhatsAppShare={handleWhatsAppShare}
        getDeliveryShareUrl={getDeliveryShareUrl}
      />

      {/* Vendor Delivery & Defect Notice Modal */}
      <DeliveryVendorNoticeModal
        notice={vendorNoticeModal}
        onClose={() => setVendorNoticeModal(null)}
        copiedNoticeText={copiedNoticeText}
        onCopyNoticeText={handleCopyNoticeText}
        onSendEmail={handleSendVendorReceiptEmail}
        onSendWhatsApp={handleSendVendorReceiptWhatsapp}
        buildReceiptVendorMessage={buildReceiptVendorMessage}
      />

      {/* Photo Attachment Gallery & Lightbox Modal */}
      <DeliveryPhotoGalleryModal
        gallery={photoGalleryModal}
        onCloseGallery={() => setPhotoGalleryModal(null)}
        previewPhoto={previewPhoto}
        onClosePreview={() => setPreviewPhoto(null)}
        onOpenPreview={(url) => setPreviewPhoto(url)}
      />

      {/* Upload/Edit & View Commercial Billed Challan Modals */}
      <DeliveryBillModal
        uploadModal={billUploadModal}
        onCloseUpload={() => setBillUploadModal(null)}
        onSubmitBill={handleSaveBill}
        billSubmitting={billSubmitting}
        formChallanNo={formBillChallanNo}
        onChallanNoChange={setFormBillChallanNo}
        formDate={formBillDate}
        onDateChange={setFormBillDate}
        formVehicleNo={formBillVehicleNo}
        onVehicleNoChange={setFormBillVehicleNo}
        formBasic={formBillBasic}
        onBasicChange={setFormBillBasic}
        formFreight={formBillFreight}
        onFreightChange={setFormBillFreight}
        formLoading={formBillLoading}
        onLoadingChange={setFormBillLoading}
        formPack={formBillPack}
        onPackChange={setFormBillPack}
        formOther={formBillOther}
        onOtherChange={setFormBillOther}
        formGstPct={formBillGstPct}
        onGstPctChange={setFormBillGstPct}
        formNotes={formBillNotes}
        onNotesChange={setFormBillNotes}
        formDoc={formBillDoc}
        onDocChange={setFormBillDoc}
        billSubtotal={billSubtotal}
        billGstAmount={billGstAmount}
        billGrandTotal={billGrandTotal}
        viewModal={viewBillModal}
        onCloseView={() => setViewBillModal(null)}
        onPreviewPhoto={(url) => setPreviewPhoto(url)}
      />
    </div>
  );
};

export default DeliveriesPage;
