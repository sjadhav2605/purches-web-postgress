import Joi from 'joi';

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required'
  })
});

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).max(150).required(),
  role: Joi.string().valid('admin', 'director', 'purchase', 'pc', 'accounts', 'supervisor', 'vendor').required(),
  vendor_id: Joi.number().integer().allow(null).optional(),
  default_site_id: Joi.number().integer().allow(null).optional()
});
