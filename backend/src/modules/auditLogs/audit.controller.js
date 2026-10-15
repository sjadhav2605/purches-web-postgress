import { auditService } from './audit.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export const auditController = {
  async getAuditLogs(req, res, next) {
    try {
      const logs = await auditService.getRecentAuditLogs(req.query.limit || 150);
      return ApiResponse.success(res, logs);
    } catch (e) {
      next(e);
    }
  }
};

export default auditController;
