import { PaymentService } from './payment.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export const PaymentController = {
  async getAll(req, res, next) {
    try {
      const data = await PaymentService.getAllPayments();
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },

  async getPoSummary(req, res, next) {
    try {
      const data = await PaymentService.getPoSummary();
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },

  async getByPoId(req, res, next) {
    try {
      const data = await PaymentService.getPaymentsByPo(req.params.poId);
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const result = await PaymentService.recordPayment(req.body, req.user);
      return ApiResponse.created(res, result, 'Payment recorded successfully');
    } catch (e) { next(e); }
  }
};
