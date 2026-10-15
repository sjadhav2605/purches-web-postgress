import { PurchaseOrderService } from './po.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export const PurchaseOrderController = {
  /**
   * POST /api/v1/orders
   */
  async create(req, res, next) {
    try {
      const result = await PurchaseOrderService.createPO(req.body, req.user);
      return ApiResponse.created(res, result, 'Purchase order generated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/orders
   */
  async getAll(req, res, next) {
    try {
      const result = await PurchaseOrderService.getPOs(req.query, req.user);
      return ApiResponse.success(res, result, 'Purchase orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/orders/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await PurchaseOrderService.getPOById(Number(id), req.user);
      return ApiResponse.success(res, result, 'Purchase order details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/orders/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, invoice_no, note, dispatch_date, expected_delivery_date, dispatch_notes } = req.body;
      const result = await PurchaseOrderService.updateStatus(
        Number(id), 
        status, 
        invoice_no, 
        note, 
        req.user,
        dispatch_date,
        expected_delivery_date,
        dispatch_notes
      );
      return ApiResponse.success(res, result, `Purchase order status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/orders/:id/commercial-terms
   */
  async updateCommercialTerms(req, res, next) {
    try {
      const { id } = req.params;
      const result = await PurchaseOrderService.updateCommercialTerms(Number(id), req.body, req.user);
      return ApiResponse.success(res, result, 'Commercial terms and declaration saved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/orders/public/delivery/:id
   */
  async getPublicDeliveryDetails(req, res, next) {
    try {
      const { id } = req.params;
      const vendorId = req.query.v || req.query.vendor_id || null;
      const sig = req.query.sig || null;
      const result = await PurchaseOrderService.getPublicDeliveryDetails(Number(id), vendorId, sig);
      return ApiResponse.success(res, result, 'Delivery details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/orders/public/delivery/:id/submit
   */
  async submitPublicDeliverySchedule(req, res, next) {
    try {
      const { id } = req.params;
      const result = await PurchaseOrderService.submitPublicDeliverySchedule(Number(id), req.body);
      return ApiResponse.success(res, result, 'Delivery schedule and dispatch confirmed successfully');
    } catch (error) {
      next(error);
    }
  }
};

