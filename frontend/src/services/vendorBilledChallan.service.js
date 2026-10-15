import api from './api.js';

export const vendorBilledChallanService = {
  async getChallans(params = {}) {
    const res = await api.get('/vendor-billed-challans', { params });
    return res.data || [];
  },

  async getChallanById(id) {
    const res = await api.get(`/vendor-billed-challans/${id}`);
    return res.data;
  },

  async createChallan(data) {
    const res = await api.post('/vendor-billed-challans', data);
    return res.data;
  },

  async updateChallan(id, data) {
    const res = await api.put(`/vendor-billed-challans/${id}`, data);
    return res.data;
  },

  async deleteChallan(id) {
    const res = await api.delete(`/vendor-billed-challans/${id}`);
    return res.data;
  },

  async getSummary(params = {}) {
    const res = await api.get('/vendor-billed-challans/summary', { params });
    return res.data;
  }
};
