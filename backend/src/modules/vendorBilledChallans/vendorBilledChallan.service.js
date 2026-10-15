import { VendorBilledChallanModel } from './vendorBilledChallan.model.js';
import { ApiError } from '../../utils/apiError.js';
import { saveBase64File } from '../../utils/storageService.js';
import { scopeFor, assertChallanVisible, CHALLAN_COLS } from '../../utils/dataScope.js';

/**
 * Uploads a Base64 challan attachment to Supabase Storage (local disk in dev)
 * and returns its public URL.
 */
const saveChallanDocument = async (docDataUrl, docName = '') => {
  if (!docDataUrl || typeof docDataUrl !== 'string' || !docDataUrl.startsWith('data:')) {
    return { dataUrl: docDataUrl, name: docName };
  }

  const saved = await saveBase64File(docDataUrl, docName, 'vendor_challans', 'challan');
  if (saved) {
    return { dataUrl: saved.url, name: docName || saved.filename };
  }

  return { dataUrl: docDataUrl, name: docName };
};

export const VendorBilledChallanService = {
  async getChallans(query, currentUser) {
    const scope = scopeFor(currentUser, CHALLAN_COLS);
    const rows = await VendorBilledChallanModel.findAll({
      search: query.search,
      site_id: query.site_id ? Number(query.site_id) : null,
      vendor_id: query.vendor_id ? Number(query.vendor_id) : null,
      po_id: query.po_id ? Number(query.po_id) : null,
      scope
    });
    return rows;
  },

  async getChallanById(id, currentUser) {
    const challan = await VendorBilledChallanModel.findById(id);
    if (!challan) {
      throw ApiError.notFound('Vendor billed challan not found');
    }
    await assertChallanVisible(id, currentUser); // 403 when outside the user's scope
    return challan;
  },

  async createChallan(payload, currentUser) {
    let {
      po_id,
      requisition_id,
      vendor_id,
      site_id
    } = payload;
    const {
      challan_no,
      challan_date,
      basic_amount = 0,
      freight_charges = 0,
      loading_unloading_charges = 0,
      packaging_charges = 0,
      other_charges = 0,
      gst_percent = 18,
      gst_amount = 0,
      total_amount,
      document_file,
      document_name,
      vehicle_no,
      notes,
      status = 'Submitted'
    } = payload;


    // A bill attached to a Purchase Order takes its vendor / site / requisition from that PO
    // (authoritative source), so the client can't omit or spoof them.
    if (po_id) {
      const poRefs = await VendorBilledChallanModel.findPoRefs(Number(po_id));
      if (!poRefs) {
        throw ApiError.notFound('Purchase Order not found for this billed challan');
      }
      if (vendor_id && Number(vendor_id) !== Number(poRefs.vendor_id)) {
        throw ApiError.badRequest('Selected vendor does not match the vendor of this Purchase Order');
      }
      vendor_id = poRefs.vendor_id;
      site_id = site_id || poRefs.site_id;
      requisition_id = requisition_id || poRefs.requisition_id;
    }

    if (!challan_no || !String(challan_no).trim()) {
      throw ApiError.badRequest('Challan / Bill Number is required');
    }
    if (!challan_date) {
      throw ApiError.badRequest('Challan Date is required');
    }
    if (!vendor_id) {
      throw ApiError.badRequest('Vendor is required');
    }
    if (!site_id) {
      throw ApiError.badRequest('Site is required');
    }

    const nBasic = Number(basic_amount) || 0;
    const nFreight = Number(freight_charges) || 0;
    const nLoading = Number(loading_unloading_charges) || 0;
    const nPack = Number(packaging_charges) || 0;
    const nOther = Number(other_charges) || 0;
    const nGstPct = Number(gst_percent) || 0;

    const subtotal = nBasic + nFreight + nLoading + nPack + nOther;
    const calculatedGst = Number(gst_amount) > 0 ? Number(gst_amount) : Math.round((subtotal * (nGstPct / 100)) * 100) / 100;
    const computedTotal = total_amount ? Number(total_amount) : subtotal + calculatedGst;

    let savedFile = null;
    let savedFileName = document_name || null;
    if (document_file) {
      const res = await saveChallanDocument(document_file, document_name);
      savedFile = res.dataUrl;
      savedFileName = res.name;
    }

    const id = await VendorBilledChallanModel.create({
      challan_no: String(challan_no).trim(),
      challan_date,
      po_id: po_id ? Number(po_id) : null,
      requisition_id: requisition_id ? Number(requisition_id) : null,
      vendor_id: Number(vendor_id),
      site_id: Number(site_id),
      basic_amount: nBasic,
      freight_charges: nFreight,
      loading_unloading_charges: nLoading,
      packaging_charges: nPack,
      other_charges: nOther,
      gst_percent: nGstPct,
      gst_amount: calculatedGst,
      total_amount: computedTotal,
      document_file: savedFile,
      document_name: savedFileName,
      vehicle_no: vehicle_no ? String(vehicle_no).trim() : null,
      notes: notes ? String(notes).trim() : null,
      created_by_id: currentUser?.id || null,
      created_by_name: currentUser?.name || 'Purchase Manager',
      status: status || 'Submitted'
    });

    return await VendorBilledChallanModel.findById(id);
  },

  async updateChallan(id, payload, currentUser) {
    const existing = await VendorBilledChallanModel.findById(id);
    if (!existing) {
      throw ApiError.notFound('Vendor billed challan not found');
    }

    const updateData = { ...payload };

    if (payload.document_file && payload.document_file.startsWith('data:')) {
      const res = await saveChallanDocument(payload.document_file, payload.document_name);
      updateData.document_file = res.dataUrl;
      updateData.document_name = res.name;
    }

    if (payload.basic_amount !== undefined || payload.freight_charges !== undefined || payload.loading_unloading_charges !== undefined) {
      const nBasic = Number(payload.basic_amount ?? existing.basic_amount) || 0;
      const nFreight = Number(payload.freight_charges ?? existing.freight_charges) || 0;
      const nLoading = Number(payload.loading_unloading_charges ?? existing.loading_unloading_charges) || 0;
      const nPack = Number(payload.packaging_charges ?? existing.packaging_charges) || 0;
      const nOther = Number(payload.other_charges ?? existing.other_charges) || 0;
      const nGstPct = Number(payload.gst_percent ?? existing.gst_percent) || 0;

      const subtotal = nBasic + nFreight + nLoading + nPack + nOther;
      const calculatedGst = payload.gst_amount !== undefined ? Number(payload.gst_amount) : Math.round((subtotal * (nGstPct / 100)) * 100) / 100;
      updateData.gst_amount = calculatedGst;
      updateData.total_amount = payload.total_amount ? Number(payload.total_amount) : subtotal + calculatedGst;
    }

    await VendorBilledChallanModel.update(id, updateData);
    return await VendorBilledChallanModel.findById(id);
  },

  async deleteChallan(id) {
    const existing = await VendorBilledChallanModel.findById(id);
    if (!existing) {
      throw ApiError.notFound('Vendor billed challan not found');
    }
    return await VendorBilledChallanModel.delete(id);
  },

  async getFinancialSummary(query = {}, currentUser) {
    return await VendorBilledChallanModel.getFinancialSummary({
      site_id: query.site_id ? Number(query.site_id) : null,
      vendor_id: query.vendor_id ? Number(query.vendor_id) : null,
      scope: scopeFor(currentUser, CHALLAN_COLS)
    });
  }
};
