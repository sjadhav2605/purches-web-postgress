import { MastersModel } from './masters.model.js';
import { ApiError } from '../../utils/apiError.js';
import { cacheService } from '../../utils/cacheService.js';

export const MastersService = {
  // Materials (Cached: 10 mins TTL)
  async getMaterials(search, siteId, category) {
    const cacheKey = `materials:${search || ''}:${siteId || ''}:${category || ''}`;
    return await cacheService.getOrSet(
      cacheKey,
      async () => await MastersModel.getMaterials(search, siteId, category),
      600
    );
  },
  async createMaterial(data) {
    const id = await MastersModel.createMaterial(data);
    await cacheService.delByPattern('materials:*');
    return { id, ...data };
  },
  async deleteMaterial(id) {
    const result = await MastersModel.deleteMaterial(id);
    await cacheService.delByPattern('materials:*');
    return result;
  },

  // Sites (Cached: 10 mins TTL)
  async getSites(search, currentUser = null) {
    const userScope = currentUser?.id || 'all';
    const cacheKey = `sites:${search || ''}:${userScope}`;
    return await cacheService.getOrSet(
      cacheKey,
      async () => await MastersModel.getSites(search, currentUser),
      600
    );
  },
  async createSite(data) {
    const id = await MastersModel.createSite(data);
    await cacheService.delByPattern('sites:*');
    return { id, ...data };
  },
  async deleteSite(id) {
    const result = await MastersModel.deleteSite(id);
    await cacheService.delByPattern('sites:*');
    return result;
  },

  // Vendors (Cached: 5 mins TTL)
  async getVendors(search) {
    const cacheKey = `vendors:${search || ''}`;
    return await cacheService.getOrSet(
      cacheKey,
      async () => await MastersModel.getVendors(search),
      300
    );
  },
  async createVendor(data) {
    const id = await MastersModel.createVendor(data);
    await cacheService.delByPattern('vendors:*');
    return { id, ...data };
  },
  async deleteVendor(id) {
    const result = await MastersModel.deleteVendor(id);
    await cacheService.delByPattern('vendors:*');
    return result;
  }
};
