import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';
import pool from '../config/db.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }
  return secret;
};

/**
 * Authentication Middleware:
 * Verifies JWT token from Authorization Header ('Bearer <token>').
 * Fetches user profile from database and attaches to req.user.
 */
export const verifyJwt = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No authentication token provided');
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = getJwtSecret(); // throws 500 (not 401) if misconfigured
    let decoded;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Authentication token has expired');
      }
      throw ApiError.unauthorized('Invalid authentication token');
    }

    // Verify user exists and is active in database
    const [rows] = await pool.query(
      'SELECT id, email, name, role, status, vendor_id, default_site_id FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (rows.length === 0) {
      throw ApiError.unauthorized('User associated with this token no longer exists');
    }

    const user = rows[0];
    if (user.status !== 'active') {
      throw ApiError.forbidden('User account is inactive or suspended');
    }

    user.realId = user.id;
    user.realRole = user.role;

    // Attach user to request: ONLY Administrator can simulate other roles via x-active-role
    if (user.role === 'admin' && req.headers['x-active-role']) {
      const rawRole = String(req.headers['x-active-role']).trim();
      if (rawRole === 'director_1' || rawRole === 'director_2' || rawRole === 'director_3' || rawRole === 'director') {
        user.activeRole = 'director';
        const simulatedId = req.headers['x-active-user-id'] 
          ? Number(req.headers['x-active-user-id']) 
          : (rawRole === 'director_2' ? 6 : rawRole === 'director_3' ? 7 : 5);
        user.id = simulatedId;
        user.directorId = simulatedId;
        user.name = req.headers['x-active-user-name'] || (simulatedId === 6 || simulatedId === 10 ? 'Director 2' : simulatedId === 7 || simulatedId === 11 ? 'Director 3' : 'Director 1');
      } else {
        user.activeRole = rawRole;
      }
    } else {
      user.activeRole = user.role;
      if (user.role === 'director') {
        user.directorId = user.id;
      }
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
