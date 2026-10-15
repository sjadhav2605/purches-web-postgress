import { userService } from './user.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export const userController = {
  async getDirectors(req, res, next) {
    try {
      const directors = await userService.getDirectors();
      return ApiResponse.success(res, directors);
    } catch (e) {
      next(e);
    }
  },

  async getAllUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      return ApiResponse.success(res, users);
    } catch (e) {
      next(e);
    }
  },

  async createUser(req, res, next) {
    try {
      const newUser = await userService.createUser(req.body);
      return ApiResponse.created(res, newUser, 'User created and assigned successfully');
    } catch (e) {
      next(e);
    }
  },

  async updateUser(req, res, next) {
    try {
      const updatedUser = await userService.updateUser(req.params.id, req.body);
      return ApiResponse.success(res, updatedUser, 'User updated successfully');
    } catch (e) {
      next(e);
    }
  }
};

export default userController;
