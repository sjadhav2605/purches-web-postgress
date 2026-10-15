import api from './api.js';

export const auditService = {
  async getAuditLogs() {
    const res = await api.get('/audit');
    return res.data;
  }
};
