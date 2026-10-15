import api from './api.js';

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    return response.data; // { token, user }
  },

  async getProfile() {
    const response = await api.get('/auth/me');
    return response.data;
  }
};
