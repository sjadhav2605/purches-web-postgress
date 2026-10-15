import api from './api.js';

export const paymentService = {
  async getPayments() {
    const res = await api.get('/payments');
    return res.data;
  },
  async getPoSummary() {
    const res = await api.get('/payments/po-summary');
    return res.data;
  },
  async getPaymentsByPo(poId) {
    const res = await api.get(`/payments/po/${poId}`);
    return res.data;
  },
  async recordPayment(data) {
    const res = await api.post('/payments', data);
    return res.data;
  }
};
