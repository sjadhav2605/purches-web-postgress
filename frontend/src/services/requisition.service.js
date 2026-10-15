import api from './api.js';

let pipelineStatsPromise = null;
let cachedPipelineStats = null;
let lastPipelineStatsTime = 0;
const STATS_CACHE_TTL = 8000; // 8 seconds client-side cache

export const invalidatePipelineStatsCache = () => {
  cachedPipelineStats = null;
  lastPipelineStatsTime = 0;
  pipelineStatsPromise = null;
};

export const requisitionService = {
  /**
   * Fetch paginated requisitions with search, tab, and filter parameters
   */
  async getRequisitions(params = {}) {
    const response = await api.get('/requisitions', { params });
    return response.data; // { items, tabCounts, pagination }
  },

  /**
   * Get single requisition by ID with items, history, edits, delivery receipts
   */
  async getRequisitionById(id) {
    const response = await api.get(`/requisitions/${id}`);
    return response.data;
  },

  /**
   * Create new requisition with items
   */
  async createRequisition(payload) {
    invalidatePipelineStatsCache();
    const response = await api.post('/requisitions', payload);
    return response.data;
  },

  /**
   * Coordinator edits request fields and line items before approving
   */
  async coordinatorEdit(id, payload) {
    invalidatePipelineStatsCache();
    const response = await api.put(`/requisitions/${id}/coordinator-edit`, payload);
    return response.data;
  },

  /**
   * Coordinator approves request and forwards to Purchase Department
   */
  async coordinatorApprove(id) {
    invalidatePipelineStatsCache();
    const response = await api.post(`/requisitions/${id}/coordinator-approve`);
    return response.data;
  },

  /**
   * Coordinator declines request with mandatory reason
   */
  async coordinatorDecline(id, reason) {
    invalidatePipelineStatsCache();
    const response = await api.post(`/requisitions/${id}/coordinator-decline`, { reason });
    return response.data;
  },

  /**
   * Purchase Department approves request and sends RFQ to selected vendors
   */
  async purchaseApprove(id, { vendor_ids, deadline, remarks, payment_terms, advance_pct, credit_days, payment_terms_notes }) {
    invalidatePipelineStatsCache();
    const response = await api.post(`/requisitions/${id}/purchase-approve`, { 
      vendor_ids, 
      deadline, 
      remarks, 
      payment_terms, 
      advance_pct, 
      credit_days, 
      payment_terms_notes 
    });
    return response.data;
  },

  /**
   * Update Payment Terms on Requisition
   */
  async updatePaymentTerms(id, payload) {
    const response = await api.patch(`/requisitions/${id}/payment-terms`, payload);
    return response.data;
  },

  /**
   * Purchase Department declines request with mandatory reason
   */
  async purchaseDecline(id, reason) {
    invalidatePipelineStatsCache();
    const response = await api.post(`/requisitions/${id}/purchase-decline`, { reason });
    return response.data;
  },

  /**
   * Purchase Manager shortlists one vendor and finalizes terms after Director approval
   */
  async shortlistVendor(id, payload) {
    invalidatePipelineStatsCache();
    const body = typeof payload === 'object' ? payload : { vendor_id: payload };
    const response = await api.post(`/requisitions/${id}/shortlist-vendor`, body);
    return response.data;
  },

  /**
   * Vendor records delivery dispatch details
   */
  async dispatchDelivery(id, payload) {
    invalidatePipelineStatsCache();
    const response = await api.post(`/requisitions/${id}/dispatch`, payload);
    return response.data;
  },

  /**
   * Reopen vendor dispatch link for corrections
   */
  async reopenDispatch(id, reason = '') {
    invalidatePipelineStatsCache();
    const response = await api.post(`/requisitions/${id}/reopen-dispatch`, { reason });
    return response.data;
  },

  /**
   * Site Supervisor marks delivery as received and uploads proof
   */
  async receiveDelivery(id, payload) {
    invalidatePipelineStatsCache();
    const response = await api.post(`/requisitions/${id}/receive`, payload);
    return response.data;
  },

  /**
   * Update PR Status (generic)
   */
  async updateStatus(id, status, remarks = '') {
    invalidatePipelineStatsCache();
    const response = await api.patch(`/requisitions/${id}/status`, { status, remarks });
    return response.data;
  },

  /**
   * Update Line Items and Quantities (PC, Purchase, Admin)
   */
  async updateItems(id, items) {
    invalidatePipelineStatsCache();
    const response = await api.put(`/requisitions/${id}/items`, { items });
    return response.data;
  },

  /**
   * Update Estimated Rates (Purchase Department)
   */
  async updateEstimatedRates(id, items) {
    invalidatePipelineStatsCache();
    const response = await api.put(`/requisitions/${id}/rates`, { items });
    return response.data;
  },

  /**
   * Delete Draft PR
   */
  async deleteRequisition(id) {
    invalidatePipelineStatsCache();
    const response = await api.delete(`/requisitions/${id}`);
    return response.data;
  },

  /**
   * Get 7-stage procurement pipeline live counts (Deduplicated & Cached)
   */
  async getPipelineStats(force = false) {
    const now = Date.now();
    if (!force && cachedPipelineStats && (now - lastPipelineStatsTime) < STATS_CACHE_TTL) {
      return cachedPipelineStats;
    }

    if (pipelineStatsPromise) {
      return pipelineStatsPromise;
    }

    pipelineStatsPromise = api.get('/requisitions/pipeline/stats')
      .then((response) => {
        cachedPipelineStats = response.data;
        lastPipelineStatsTime = Date.now();
        pipelineStatsPromise = null;
        return response.data;
      })
      .catch((err) => {
        pipelineStatsPromise = null;
        throw err;
      });

    return pipelineStatsPromise;
  }
};
