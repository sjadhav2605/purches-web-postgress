import api from './api.js';

export const deliveryService = {
  async getDeliveries() {
    const res = await api.get('/deliveries');
    return res.data;
  },
  async recordDelivery(data) {
    const res = await api.post('/deliveries', data);
    return res.data;
  }
};
