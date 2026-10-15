import bcrypt from 'bcryptjs';
import { userModel } from './user.model.js';
import { ApiError } from '../../utils/apiError.js';

export const userService = {
  /**
   * Get active directors
   */
  async getDirectors() {
    return await userModel.findActiveDirectors();
  },

  /**
   * Get all portal users
   */
  async getAllUsers() {
    return await userModel.findAllUsers();
  },

  /**
   * Create a new user with password hashing and email check
   */
  async createUser({ name, email, phone, role, default_site_id, password }) {
    if (!name || !name.trim()) throw ApiError.badRequest('Name is required');
    if (!email || !email.trim()) throw ApiError.badRequest('Email is required');
    if (!role) throw ApiError.badRequest('Role is required');

    const validRoles = ['admin', 'supervisor', 'pc', 'purchase', 'director', 'accounts', 'vendor'];
    if (!validRoles.includes(role)) {
      throw ApiError.badRequest(`Invalid role. Valid roles are: ${validRoles.join(', ')}`);
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await userModel.findByEmail(cleanEmail);
    if (existing) {
      throw ApiError.badRequest(`User with email "${cleanEmail}" already exists`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertId = await userModel.createUser({
      name: name.trim(),
      email: cleanEmail,
      phone: phone?.trim() || null,
      role,
      default_site_id: default_site_id ? Number(default_site_id) : null,
      password_hash: passwordHash
    });

    return await userModel.findById(insertId);
  },

  /**
   * Update existing user fields
   */
  async updateUser(id, updateData) {
    const target = await userModel.findById(id);
    if (!target) throw ApiError.notFound('User not found');

    const { name, email, phone, role, status, vendor_id, default_site_id } = updateData;
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name.trim());
    }
    if (email !== undefined) {
      const cleanEmail = email.toLowerCase().trim();
      const duplicate = await userModel.findDuplicateEmail(cleanEmail, id);
      if (duplicate) {
        throw ApiError.badRequest(`Another user with email "${cleanEmail}" already exists`);
      }
      fields.push('email = ?');
      params.push(cleanEmail);
    }
    if (phone !== undefined) {
      fields.push('phone = ?');
      params.push(phone?.trim() || null);
    }
    if (role) {
      fields.push('role = ?');
      params.push(role);
    }
    if (status) {
      fields.push('status = ?');
      params.push(status);
    }
    if (vendor_id !== undefined) {
      fields.push('vendor_id = ?');
      params.push(vendor_id || null);
    }
    if (default_site_id !== undefined) {
      fields.push('default_site_id = ?');
      params.push(default_site_id || null);
    }

    if (fields.length > 0) {
      await userModel.updateUser(id, fields, params);
    }

    const updated = await userModel.findById(id);
    return {
      id: updated.id,
      email: updated.email,
      phone: updated.phone,
      name: updated.name,
      role: updated.role,
      status: updated.status
    };
  }
};

export default userService;
