import { DeliveryService } from './delivery.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export const DeliveryController = {
  async getAll(req, res, next) {
    try {
      const data = await DeliveryService.getAllDeliveries(req.user);
      return ApiResponse.success(res, data);
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const result = await DeliveryService.recordDelivery(req.body, req.user);
      return ApiResponse.created(res, result, 'Delivery recorded successfully');
    } catch (e) { next(e); }
  }
};
