import { VendorBilledChallanService } from './vendorBilledChallan.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export const VendorBilledChallanController = {
  async getChallans(req, res, next) {
    try {
      const data = await VendorBilledChallanService.getChallans(req.query, req.user);
      return ApiResponse.success(res, data);
    } catch (e) {
      next(e);
    }
  },

  async getSummary(req, res, next) {
    try {
      const data = await VendorBilledChallanService.getFinancialSummary(req.query, req.user);
      return ApiResponse.success(res, data);
    } catch (e) {
      next(e);
    }
  },

  async getChallanById(req, res, next) {
    try {
      const data = await VendorBilledChallanService.getChallanById(req.params.id, req.user);
      return ApiResponse.success(res, data);
    } catch (e) {
      next(e);
    }
  },

  async createChallan(req, res, next) {
    try {
      const data = await VendorBilledChallanService.createChallan(req.body, req.user);
      return ApiResponse.created(res, data, 'Vendor Billed Challan recorded successfully');
    } catch (e) {
      next(e);
    }
  },

  async updateChallan(req, res, next) {
    try {
      const data = await VendorBilledChallanService.updateChallan(req.params.id, req.body, req.user);
      return ApiResponse.success(res, data, 'Vendor Billed Challan updated');
    } catch (e) {
      next(e);
    }
  },

  async deleteChallan(req, res, next) {
    try {
      await VendorBilledChallanService.deleteChallan(req.params.id);
      return ApiResponse.success(res, null, 'Vendor Billed Challan deleted');
    } catch (e) {
      next(e);
    }
  }
};
