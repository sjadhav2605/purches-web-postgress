import { AuthService } from './auth.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

/**
 * Auth Controller:
 * Handles incoming HTTP requests and outgoing responses.
 */
export const AuthController = {
  /**
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      return ApiResponse.success(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async me(req, res, next) {
    try {
      const targetUserId = req.user.realId || req.user.id;
      const user = await AuthService.getProfile(targetUserId);
      return ApiResponse.success(res, { 
        ...user, 
        activeRole: req.user.activeRole,
        activeDirectorId: req.user.directorId || (req.user.role === 'director' ? req.user.id : null),
        activeDirectorName: req.user.name
      }, 'Profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
};
