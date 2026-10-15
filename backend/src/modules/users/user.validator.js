import Joi from 'joi';
import { ALL_ROLES } from '../../constants/roles.js';

export const userIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

export const createUserSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().trim().required(),
  phone: Joi.string().trim().allow(null, ''),
  role: Joi.string().required(),
  default_site_id: Joi.number().integer().positive().allow(null, ''),
  password: Joi.string().trim().min(8).required().messages({
    'any.required': 'Password is required',
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 8 characters long'
  })
});

export const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).messages({
    'string.empty': 'Name is required',
    'string.min': 'Name must be at least 2 characters'
  }),
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(150).messages({
    'string.empty': 'Email is required',
    'string.email': 'Enter a valid email address'
  }),
  phone: Joi.string().trim().pattern(/^\+?[0-9][0-9\s\-()]{6,19}$/).allow(null, '').messages({
    'string.pattern.base': 'Enter a valid phone number (7-20 digits; spaces, -, ( ) and a leading + allowed)'
  }),
  role: Joi.string().valid(...ALL_ROLES),
  status: Joi.string().valid('active', 'inactive', 'suspended'),
  vendor_id: Joi.number().integer().positive().allow(null, ''),
  default_site_id: Joi.number().integer().positive().allow(null, '')
}).min(1);
