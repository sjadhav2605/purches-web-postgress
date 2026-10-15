import api from './api.js';

export const userService = {
  async getUsers() {
    const res = await api.get('/users');
    return res.data;
  },

  async getDirectors() {
    const res = await api.get('/users/directors');
    return res.data;
  },

  async createUser(data) {
    const res = await api.post('/users', data);
    return res.data;
  },

  async updateUser(id, data) {
    const res = await api.patch(`/users/${id}`, data);
    return res.data;
  }
};
