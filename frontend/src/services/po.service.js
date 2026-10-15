import api from './api.js';

export const poService = {
  /**
   * Get paginated POs with search and filter
   */
  async getPOs(params = {}) {
    const response = await api.get('/orders', { params });
    return response.data; // { items, pagination }
  },

  /**
   * Alias for getPOs
   */
  async getOrders(params = {}) {
    return this.getPOs(params);
  },

  /**
   * Get PO details by ID
   */
  async getPOById(id) {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  /**
   * Create new PO
   */
  async createPO(payload) {
    const response = await api.post('/orders', payload);
    return response.data;
  },

  /**
   * Update PO status (e.g. Dispatched, Site Verified)
   */
  async updateStatus(id, status, invoice_no = '', note = '', dispatch_date = null, expected_delivery_date = null, dispatch_notes = null) {
    const response = await api.patch(`/orders/${id}/status`, { 
      status, 
      invoice_no, 
      note,
      dispatch_date,
      expected_delivery_date,
      dispatch_notes
    });
    return response.data;
  },

  /**
   * Update Commercial Terms & Declaration (Purchase Manager)
   */
  async updateCommercialTerms(id, termsData) {
    const response = await api.patch(`/orders/${id}/commercial-terms`, termsData);
    return response.data;
  },

  /**
   * Public: Fetch delivery details for vendor link
   */
  async getPublicDelivery(id, vendorId = '', sig = '') {
    const params = {};
    if (vendorId) params.v = vendorId;
    if (sig) params.sig = sig;
    const response = await api.get(`/orders/public/delivery/${id}`, { params });
    return response.data;
  },

  /**
   * Public: Vendor submits expected delivery schedule & dispatch details
   */
  async submitPublicDelivery(id, payload) {
    const response = await api.post(`/orders/public/delivery/${id}/submit`, payload);
    return response.data;
  }
};

