import { MastersService } from './masters.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { emailService } from '../../utils/emailService.js';
import { saveBase64File } from '../../utils/storageService.js';

/**
 * Uploads Base64 vendor KYC documents to Supabase Storage (local disk in dev)
 * and replaces each data URL with its public file URL.
 */
const saveBase64Documents = async (documents = []) => {
  if (!Array.isArray(documents) || documents.length === 0) return [];

  return Promise.all(documents.map(async (doc, idx) => {
    if (doc && typeof doc.dataUrl === 'string' && doc.dataUrl.startsWith('data:')) {
      const saved = await saveBase64File(doc.dataUrl, doc.name, 'vendor_docs', `vdoc_${idx}`);
      if (saved) {
        return {
          typeId: doc.typeId || `doc_${idx}`,
          typeLabel: doc.typeLabel || doc.name || 'Document',
          name: doc.name || saved.filename,
          size: doc.size || saved.size,
          dataUrl: saved.url
        };
      }
    }
    return doc;
  }));
};

export const MastersController = {
  // Materials
  async getMaterials(req, res, next) {
    try {
      const data = await MastersService.getMaterials(req.query.search, req.query.site_id, req.query.category);
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },
  async createMaterial(req, res, next) {
    try {
      const data = await MastersService.createMaterial(req.body);
      return ApiResponse.created(res, data, 'Material added successfully');
    } catch (e) { next(e); }
  },
  async deleteMaterial(req, res, next) {
    try {
      await MastersService.deleteMaterial(req.params.id);
      return ApiResponse.success(res, null, 'Material deleted');
    } catch (e) { next(e); }
  },

  // Sites
  async getSites(req, res, next) {
    try {
      const data = await MastersService.getSites(req.query.search, req.user);
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },
  async createSite(req, res, next) {
    try {
      const data = await MastersService.createSite(req.body);
      return ApiResponse.created(res, data, 'Site added successfully');
    } catch (e) { next(e); }
  },
  async deleteSite(req, res, next) {
    try {
      await MastersService.deleteSite(req.params.id);
      return ApiResponse.success(res, null, 'Site deleted');
    } catch (e) { next(e); }
  },

  // Vendors
  async getVendors(req, res, next) {
    try {
      const data = await MastersService.getVendors(req.query.search);
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },
  async createVendor(req, res, next) {
    try {
      const body = { ...req.body };
      if (body.documents) {
        body.documents = await saveBase64Documents(body.documents);
      }
      const data = await MastersService.createVendor(body);
      return ApiResponse.created(res, data, 'Vendor added successfully');
    } catch (e) { next(e); }
  },
  async registerVendorPublic(req, res, next) {
    try {
      const body = { ...req.body };
      if (!body.name || !body.name.trim()) {
        return res.status(400).json({ success: false, message: 'Vendor or Company name is required' });
      }
      if (body.documents) {
        body.documents = await saveBase64Documents(body.documents);
      }
      const data = await MastersService.createVendor({
        ...body,
        form_submitted: 'Self-Registered via Online Portal'
      });
      return ApiResponse.created(res, data, 'Vendor registration and KYC submitted successfully');
    } catch (e) { next(e); }
  },
  async sendVendorInvite(req, res, next) {
    try {
      const { email, phone, vendorName } = req.body;
      const origin = req.headers.origin || 'http://localhost:5173';
      const inviteLink = `${origin}/vendor-registration`;

      let emailSent = false;
      if (email && email.trim()) {
        await emailService.sendEmail({
          to: email.trim(),
          subject: 'Vendor Registration & Onboarding - Decent Decor Pvt. Ltd.',
          text: `Dear ${vendorName ? vendorName.trim() : 'Vendor Partner'},\n\nYou have been invited to register as an approved vendor/supplier for Decent Decor Pvt. Ltd. (DDPL) Procurement.\n\nPlease complete your business profile, GST/PAN information, bank KYC details, and upload your verification documents using this link:\n\n${inviteLink}\n\nFor any questions, please contact the DDPL Purchase Department.\n\nWarm regards,\nDecent Decor Pvt. Ltd. Procurement Team`
        });
        emailSent = true;
      }

      return ApiResponse.success(res, { inviteLink, emailSent }, 'Vendor registration invitation generated successfully');
    } catch (e) { next(e); }
  },
  async deleteVendor(req, res, next) {
    try {
      await MastersService.deleteVendor(req.params.id);
      return ApiResponse.success(res, null, 'Vendor deleted');
    } catch (e) { next(e); }
  }
};
