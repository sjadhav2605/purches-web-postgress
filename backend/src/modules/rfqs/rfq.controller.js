import { RfqService } from './rfq.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export const RfqController = {
  async getAll(req, res, next) {
    try {
      const data = await RfqService.getAllRfqs(req.query, req.user);
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },

  async getById(req, res, next) {
    try {
      const data = await RfqService.getRfqById(req.params.id, req.user);
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const data = await RfqService.createFromPR(req.body, req.user);
      return ApiResponse.created(res, data, 'RFQ created successfully');
    } catch (e) { next(e); }
  },

  async submitBid(req, res, next) {
    try {
      const data = await RfqService.submitQuote(req.body, req.user);
      return ApiResponse.success(res, data, 'Quote submitted successfully');
    } catch (e) { next(e); }
  },

  async selectWinner(req, res, next) {
    try {
      const data = await RfqService.selectWinner(req.body, req.user);
      return ApiResponse.success(res, data, 'Winning vendor selected and approved');
    } catch (e) { next(e); }
  },

  async shortlist(req, res, next) {
    try {
      const data = await RfqService.shortlistBids({
        rfq_id: Number(req.params.id),
        shortlisted_vendor_ids: req.body.shortlisted_vendor_ids,
        override_reason: req.body.override_reason,
        target_director_id: req.body.target_director_id
      }, req.user);
      return ApiResponse.success(res, data, 'Vendors shortlisted and sent to Director for approval');
    } catch (e) { next(e); }
  },

  async directorApprove(req, res, next) {
    try {
      const data = await RfqService.directorApprove({
        rfq_id: Number(req.params.id),
        vendor_id: Number(req.body.vendor_id),
        note: req.body.note
      }, req.user);
      return ApiResponse.success(res, data, `Winning vendor approved! PO ${data.po_no} created and forwarded to Purchase Manager for shortlisting.`);
    } catch (e) { next(e); }
  },

  async directorDecline(req, res, next) {
    try {
      const data = await RfqService.directorDecline({
        rfq_id: Number(req.params.id),
        remark: req.body.remark || req.body.reason
      }, req.user);
      return ApiResponse.success(res, data, 'RFQ declined by Director');
    } catch (e) { next(e); }
  },

  async sendBack(req, res, next) {
    try {
      const data = await RfqService.sendBackToPurchase({
        rfq_id: Number(req.params.id),
        note: req.body.note
      }, req.user);
      return ApiResponse.success(res, data, 'RFQ sent back to Purchase Department with note');
    } catch (e) { next(e); }
  },

  async createRevision(req, res, next) {
    try {
      const data = await RfqService.createRevision({
        rfq_id: Number(req.params.id),
        reason: req.body.reason,
        deadline: req.body.deadline,
        vendor_ids: req.body.vendor_ids
      }, req.user);
      return ApiResponse.created(res, data, 'New RFQ revision created successfully');
    } catch (e) { next(e); }
  },

  async sendBidRevision(req, res, next) {
    try {
      const data = await RfqService.sendBidRevision({
        rfq_id: Number(req.params.id),
        bid_id: Number(req.params.bidId),
        items: req.body.items,
        remarks: req.body.remarks
      }, req.user);
      return ApiResponse.success(res, data, 'Revision requested sent to vendor successfully');
    } catch (e) { next(e); }
  },

  async saveNegotiatedRates(req, res, next) {
    try {
      const data = await RfqService.saveNegotiatedRates({
        rfq_id: Number(req.params.id),
        bid_id: Number(req.params.bidId),
        items: req.body.items,
        remarks: req.body.remarks,
        send_to_director: Boolean(req.body.send_to_director),
        target_director_id: req.body.target_director_id ? Number(req.body.target_director_id) : null
      }, req.user);
      return ApiResponse.success(
        res,
        data,
        req.body.send_to_director
          ? 'Negotiated rates saved and RFQ sent to Director successfully'
          : 'Negotiated rates saved successfully'
      );
    } catch (e) { next(e); }
  },

  async respondBidRevision(req, res, next) {
    try {
      const data = await RfqService.respondToRevision({
        rfq_id: Number(req.params.id),
        bid_id: Number(req.params.bidId),
        response_type: req.body.response_type,
        remarks: req.body.remarks,
        items: req.body.items
      }, req.user);
      return ApiResponse.success(res, data, 'Revised rates submitted successfully');
    } catch (e) { next(e); }
  },

  async rejectBidRevision(req, res, next) {
    try {
      const data = await RfqService.rejectRevision({
        rfq_id: Number(req.params.id),
        bid_id: Number(req.params.bidId),
        remarks: req.body.remarks
      }, req.user);
      return ApiResponse.success(res, data, 'Revision request rejected');
    } catch (e) { next(e); }
  },

  async updatePaymentTerms(req, res, next) {
    try {
      const data = await RfqService.updatePaymentTerms(
        Number(req.params.id),
        req.body,
        req.user
      );
      return ApiResponse.success(res, data, 'Payment terms updated successfully');
    } catch (e) { next(e); }
  },

  async getPublicQuoteDetails(req, res, next) {
    try {
      const data = await RfqService.getPublicQuoteDetails(
        req.params.id, 
        req.query.vendor_id || req.query.v,
        req.query.sig
      );
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },

  async submitPublicQuote(req, res, next) {
    try {
      const data = await RfqService.submitPublicQuote(req.body);
      return ApiResponse.success(res, data, 'Quotation submitted successfully');
    } catch (e) { next(e); }
  },

  async submitPublicDispatch(req, res, next) {
    try {
      const rfqId = req.params.id ? Number(req.params.id) : (req.body.rfq_id ? Number(req.body.rfq_id) : null);
      const data = await RfqService.submitPublicQuoteDispatch({
        ...req.body,
        rfq_id: rfqId
      });
      return ApiResponse.success(res, data, 'Dispatch and delivery schedule recorded successfully');
    } catch (e) { next(e); }
  },

  async reopenDispatchLink(req, res, next) {
    try {
      const rfqId = Number(req.params.id);
      const data = await RfqService.reopenDispatchLink(rfqId, req.body, req.user);
      return ApiResponse.success(res, data, 'Dispatch link reopened for vendor corrections successfully');
    } catch (e) { next(e); }
  }
};
