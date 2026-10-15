import { RequisitionService } from './requisition.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

/**
 * Requisition Controller:
 * Handles HTTP requests and delegates to RequisitionService with role checks.
 */
export const RequisitionController = {
  /**
   * POST /api/v1/requisitions
   */
  async create(req, res, next) {
    try {
      const result = await RequisitionService.createRequisition(req.body, req.user);
      return ApiResponse.created(res, result, 'Request created successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/requisitions
   */
  async getAll(req, res, next) {
    try {
      const result = await RequisitionService.getRequisitions(req.query, req.user);
      return ApiResponse.success(res, result, 'Requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/requisitions/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RequisitionService.getRequisitionById(Number(id), req.user);
      return ApiResponse.success(res, result, 'Request details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/requisitions/:id/coordinator-edit
   */
  async coordinatorEdit(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RequisitionService.coordinatorEdit(Number(id), req.body, req.user);
      return ApiResponse.success(res, result, 'Request edited successfully by Coordinator');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/requisitions/:id/coordinator-approve
   */
  async coordinatorApprove(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RequisitionService.coordinatorApprove(Number(id), req.user);
      return ApiResponse.success(res, result, 'Request approved and sent to Purchase Department');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/requisitions/:id/coordinator-decline
   */
  async coordinatorDecline(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await RequisitionService.coordinatorDecline(Number(id), { reason }, req.user);
      return ApiResponse.success(res, result, 'Request declined by Project Coordinator');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/requisitions/:id/purchase-approve
   */
  async purchaseApprove(req, res, next) {
    try {
      const { id } = req.params;
      const { vendor_ids, deadline, remarks, payment_terms, advance_pct, credit_days, payment_terms_notes } = req.body;
      const result = await RequisitionService.purchaseApprove(
        Number(id), 
        { vendor_ids, deadline, remarks, payment_terms, advance_pct, credit_days, payment_terms_notes }, 
        req.user
      );
      return ApiResponse.success(res, result, 'Request approved and RFQ sent to vendors');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/requisitions/:id/payment-terms
   */
  async updatePaymentTerms(req, res, next) {
    try {
      const { id } = req.params;
      const { payment_terms, advance_pct, credit_days, payment_terms_notes } = req.body;
      const result = await RequisitionService.updatePaymentTerms(
        Number(id),
        { payment_terms, advance_pct, credit_days, payment_terms_notes },
        req.user
      );
      return ApiResponse.success(res, result, 'Payment terms updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/requisitions/:id/purchase-decline
   */
  async purchaseDecline(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await RequisitionService.purchaseDecline(Number(id), { reason }, req.user);
      return ApiResponse.success(res, result, 'Request declined by Purchase Department');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/requisitions/:id/shortlist-vendor
   */
  async shortlistVendor(req, res, next) {
    try {
      const { id } = req.params;
      const { vendor_id, payment_terms, advance_pct, credit_days, payment_terms_notes } = req.body;
      const result = await RequisitionService.shortlistVendor(
        Number(id), 
        { vendor_id, payment_terms, advance_pct, credit_days, payment_terms_notes }, 
        req.user
      );
      return ApiResponse.success(res, result, 'Vendor shortlisted and terms finalized successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/requisitions/:id/dispatch
   */
  async dispatchDelivery(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RequisitionService.dispatchDelivery(Number(id), req.body, req.user);
      return ApiResponse.success(res, result, 'Delivery dispatch recorded successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/requisitions/:id/receive
   */
  async receiveDelivery(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RequisitionService.receiveDelivery(Number(id), req.body, req.user);
      return ApiResponse.success(res, result, 'Material delivery received and verified at site');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/requisitions/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;
      const result = await RequisitionService.updateStatus(Number(id), status, remarks, req.user);
      return ApiResponse.success(res, result, `Request status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/requisitions/:id/items
   */
  async updateItems(req, res, next) {
    try {
      const { id } = req.params;
      const { items } = req.body;
      const result = await RequisitionService.updateItems(Number(id), items, req.user);
      return ApiResponse.success(res, result, 'Request items updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/requisitions/:id/rates
   */
  async updateRates(req, res, next) {
    try {
      const { id } = req.params;
      const { items } = req.body;
      const result = await RequisitionService.updateEstimatedRates(Number(id), items, req.user);
      return ApiResponse.success(res, result, 'Estimated rates updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/requisitions/:id
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RequisitionService.deleteRequisition(Number(id), req.user);
      return ApiResponse.success(res, result, 'Request deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/requisitions/pipeline/stats
   */
  async getPipelineStats(req, res, next) {
    try {
      const stats = await RequisitionService.getPipelineStats();
      return ApiResponse.success(res, stats);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/requisitions/:id/reopen-dispatch
   */
  async reopenDispatchLink(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RequisitionService.reopenDispatchLink(Number(id), req.body, req.user);
      return ApiResponse.success(res, result, 'Dispatch link reopened for vendor corrections successfully');
    } catch (error) {
      next(error);
    }
  }
};
