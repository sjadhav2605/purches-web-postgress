import api from './api.js';

// Fast in-memory cache for master data
const cache = {
  materials: { data: null, timestamp: 0 },
  sites: { data: null, timestamp: 0 },
  vendors: { data: null, timestamp: 0 }
};

const CACHE_TTL_MS = 60 * 1000; // 1 minute fresh cache

export const masterService = {
  // Materials
  async getMaterials(search = '', siteId = null, category = null, forceRefresh = false) {
    if (!search && !siteId && !category && !forceRefresh && cache.materials.data && Date.now() - cache.materials.timestamp < CACHE_TTL_MS) {
      return cache.materials.data;
    }
    const params = {};
    if (search) params.search = search;
    if (siteId) params.site_id = siteId;
    if (category) params.category = category;

    const res = await api.get('/materials', { params });
    if (!search && !siteId && !category) {
      cache.materials = { data: res.data, timestamp: Date.now() };
    }
    return res.data;
  },
  async createMaterial(data) {
    cache.materials.data = null; // Invalidate cache
    const res = await api.post('/materials', data);
    return res.data;
  },
  async deleteMaterial(id) {
    cache.materials.data = null; // Invalidate cache
    const res = await api.delete(`/materials/${id}`);
    return res.data;
  },

  // Sites
  async getSites(search = '', forceRefresh = false) {
    if (!search && !forceRefresh && cache.sites.data && Date.now() - cache.sites.timestamp < CACHE_TTL_MS) {
      return cache.sites.data;
    }
    const res = await api.get('/sites', { params: { search } });
    if (!search) {
      cache.sites = { data: res.data, timestamp: Date.now() };
    }
    return res.data;
  },
  async createSite(data) {
    cache.sites.data = null; // Invalidate cache
    const res = await api.post('/sites', data);
    return res.data;
  },
  async deleteSite(id) {
    cache.sites.data = null; // Invalidate cache
    const res = await api.delete(`/sites/${id}`);
    return res.data;
  },

  // Vendors
  async getVendors(search = '', forceRefresh = false) {
    if (!search && !forceRefresh && cache.vendors.data && Date.now() - cache.vendors.timestamp < CACHE_TTL_MS) {
      return cache.vendors.data;
    }
    const res = await api.get('/vendors', { params: { search } });
    if (!search) {
      cache.vendors = { data: res.data, timestamp: Date.now() };
    }
    return res.data;
  },
  async createVendor(data) {
    cache.vendors.data = null; // Invalidate cache
    const res = await api.post('/vendors', data);
    return res.data;
  },
  async registerVendorPublic(data) {
    cache.vendors.data = null; // Invalidate cache
    const res = await api.post('/public/vendors/register', data);
    return res.data;
  },
  async sendVendorInvite(data) {
    const res = await api.post('/vendors/send-invite', data);
    return res.data;
  },
  async deleteVendor(id) {
    cache.vendors.data = null; // Invalidate cache
    const res = await api.delete(`/vendors/${id}`);
    return res.data;
  }
};
