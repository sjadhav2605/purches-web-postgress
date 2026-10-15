import api from './api.js';

export const rfqService = {
  async getRfqs(status = '') {
    const res = await api.get('/rfqs', { params: { status } });
    return res.data;
  },

  async getRfqById(id) {
    const res = await api.get(`/rfqs/${id}`);
    return res.data;
  },

  async createRfq(data) {
    const res = await api.post('/rfqs', data);
    return res.data;
  },

  async submitBid(data) {
    const res = await api.post('/rfqs/bid', data);
    return res.data;
  },

  async selectWinner(data) {
    const res = await api.post('/rfqs/winner', data);
    return res.data;
  },

  async shortlistBids(rfqId, data) {
    const res = await api.post(`/rfqs/${rfqId}/shortlist`, data);
    return res.data;
  },

  async directorApprove(rfqId, data) {
    const res = await api.post(`/rfqs/${rfqId}/director-approve`, data);
    return res.data;
  },

  async directorDecline(rfqId, data) {
    const res = await api.post(`/rfqs/${rfqId}/director-decline`, data);
    return res.data;
  },

  async sendBackToPurchase(rfqId, data) {
    const res = await api.post(`/rfqs/${rfqId}/send-back`, data);
    return res.data;
  },

  async createRevision(rfqId, data) {
    const res = await api.post(`/rfqs/${rfqId}/revision`, data);
    return res.data;
  },

  async sendBidRevision(rfqId, bidId, data) {
    const res = await api.post(`/rfqs/${rfqId}/bids/${bidId}/send-revision`, data);
    return res.data;
  },

  async saveNegotiatedRates(rfqId, bidId, data) {
    const res = await api.post(`/rfqs/${rfqId}/bids/${bidId}/negotiated-rates`, data);
    return res.data;
  },

  async respondBidRevision(rfqId, bidId, data) {
    const res = await api.post(`/rfqs/${rfqId}/bids/${bidId}/respond-revision`, data);
    return res.data;
  },

  async rejectBidRevision(rfqId, bidId, data) {
    const res = await api.post(`/rfqs/${rfqId}/bids/${bidId}/reject-revision`, data);
    return res.data;
  },

  async updatePaymentTerms(rfqId, data) {
    const res = await api.patch(`/rfqs/${rfqId}/payment-terms`, data);
    return res.data;
  },

  async getPublicQuote(rfqId, vendorId = '', sig = '') {
    const params = {};
    if (vendorId) params.v = vendorId;
    if (sig) params.sig = sig;
    const res = await api.get(`/rfqs/public/quote/${rfqId}`, { params });
    return res.data;
  },

  async submitPublicQuote(data) {
    const res = await api.post('/rfqs/public/quote/submit', data);
    return res.data;
  },

  async submitPublicDispatch(rfqId, data) {
    const endpoint = rfqId ? `/rfqs/public/quote/${rfqId}/dispatch` : '/rfqs/public/quote/dispatch';
    const res = await api.post(endpoint, data);
    return res.data;
  },

  async reopenDispatch(rfqId, reason = '') {
    const res = await api.post(`/rfqs/${rfqId}/reopen-dispatch`, { reason });
    return res.data;
  }
};
