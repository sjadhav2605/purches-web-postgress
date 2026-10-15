import { ApiError } from '../utils/apiError.js';
import { ROLES } from '../constants/roles.js';

/**
 * Role-Based Access Control (RBAC) Middleware:
 * Verifies if the authenticated user has one of the allowed roles.
 * Admins always have access to all routes.
 *
 * @param {Array<string>|string} allowedRoles
 */
export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    // Flatten if passed as an array
    const roles = allowedRoles.flat();

    // Admins bypass role checks
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
        )
      );
    }

    next();
  };
};
