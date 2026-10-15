import Joi from 'joi';

const poItemSchema = Joi.object({
  description: Joi.string().min(2).max(255).required(),
  unit: Joi.string().max(50).required(),
  qty: Joi.number().positive().required(),
  rate: Joi.number().positive().required(),
  spec: Joi.string().allow('', null).optional()
});

export const createPoSchema = Joi.object({
  requisition_id: Joi.number().integer().required().messages({
    'any.required': 'Request (PR) is required'
  }),
  vendor_id: Joi.number().integer().required().messages({
    'any.required': 'Vendor is required'
  }),
  site_id: Joi.number().integer().required().messages({
    'any.required': 'Site is required'
  }),
  payment_terms: Joi.object({
    advance_pct: Joi.number().min(0).max(100).default(0),
    credit_days: Joi.number().integer().min(0).default(0),
    notes: Joi.string().allow('', null).optional()
  }).default({ advance_pct: 0, credit_days: 0, notes: '' }),
  items: Joi.array().items(poItemSchema).min(1).required().messages({
    'array.min': 'Purchase order must have at least one item'
  }),
  extra_charges: Joi.object().optional().default({})
}).unknown(true);

export const updatePoStatusSchema = Joi.object({
  status: Joi.string().valid(
    'Approved', 'Issued', 'Acknowledged', 'Dispatched', 'Partially Received', 'Site Verified', 'Cancelled'
  ).required().messages({
    'any.required': 'Status is required'
  }),
  invoice_no: Joi.string().allow('', null).optional(),
  note: Joi.string().allow('', null).optional()
});

export const queryPoSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow('', null).optional(),
  status: Joi.string().allow('', null).optional(),
  vendor_id: Joi.number().integer().allow(null).optional(),
  site_id: Joi.number().integer().allow(null).optional(),
  sort_by: Joi.string().valid('created_at', 'po_no', 'status', 'total_amount').default('created_at'),
  order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC')
});

export const updateCommercialTermsSchema = Joi.object({
  advance_pct: Joi.number().min(0).max(100).required().messages({
    'number.base': 'Advance payment (%) must be a valid number',
    'number.min': 'Advance payment (%) must be between 0 and 100',
    'number.max': 'Advance payment (%) must be between 0 and 100',
    'any.required': 'Advance payment (%) is required'
  }),
  credit_days: Joi.number().integer().min(0).required().messages({
    'number.base': 'Credit period must be a valid number',
    'number.integer': 'Credit period must be a whole number',
    'number.min': 'Credit period must be greater than or equal to 0',
    'any.required': 'Credit period (in days) is required'
  }),
  payment_terms: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Payment terms and conditions must not be empty',
    'any.required': 'Payment terms and conditions are required'
  }),
  declaration_text: Joi.string().trim().allow('', null).optional(),
  extra_charges: Joi.object().optional().default({})
}).unknown(true);
