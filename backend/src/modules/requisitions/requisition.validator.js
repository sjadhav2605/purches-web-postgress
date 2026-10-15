import Joi from 'joi';

/**
 * Requisition Item Validation Schema
 */
const requisitionItemSchema = Joi.object({
  material_id: Joi.number().integer().allow(null).optional(),
  description: Joi.string().min(2).max(255).required().messages({
    'any.required': 'Item description is required'
  }),
  spec: Joi.string().allow('', null).optional(),
  unit: Joi.string().max(50).required().messages({
    'any.required': 'Unit is required (e.g. Bag, Brass, Kg)'
  }),
  quantity: Joi.number().positive().required().messages({
    'number.positive': 'Quantity must be greater than zero',
    'any.required': 'Quantity is required'
  }),
  est_rate: Joi.number().min(0).default(0.00),
  is_custom: Joi.boolean().default(false),
  justification: Joi.string().allow('', null).optional(),
  photos: Joi.array().items(Joi.any()).default([])
});

/**
 * Create Requisition (PR) Schema
 */
export const createRequisitionSchema = Joi.object({
  site_id: Joi.number().integer().required().messages({
    'any.required': 'Project site is required'
  }),
  category: Joi.string().min(2).max(150).required().messages({
    'any.required': 'Category is required (e.g. Civil / Structural, Paint)'
  }),
  required_by_date: Joi.date().iso().allow(null).optional(),
  remarks: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('Draft', 'Pending PC Approval', 'PR Raised').optional(),
  items: Joi.array().items(requisitionItemSchema).min(1).required().messages({
    'array.min': 'A request must have at least one item',
    'any.required': 'Items list is required'
  })
});

/**
 * Update Requisition Schema
 */
export const updateRequisitionSchema = Joi.object({
  category: Joi.string().min(2).max(150).optional(),
  required_by_date: Joi.date().iso().allow(null).optional(),
  remarks: Joi.string().allow('', null).optional(),
  status: Joi.string().valid(
    'Draft', 'Pending PC Approval', 'PR Raised', 'RFQ Sent', 'Bids In', 'Shortlisted', 'Approved', 'PO Issued', 'Dispatched', 'Site Verified', 'Rejected'
  ).optional()
});

/**
 * Status Update Schema
 */
export const updateStatusSchema = Joi.object({
  status: Joi.string().valid(
    'Draft', 'Pending PC Approval', 'PR Raised', 'RFQ Sent', 'Bids In', 'Shortlisted', 'Approved', 'PO Issued', 'Dispatched', 'Site Verified', 'Rejected'
  ).required().messages({
    'any.required': 'New status is required'
  }),
  remarks: Joi.string().allow('', null).optional()
});

/**
 * Update Estimated Rates Schema (Purchase Manager)
 */
export const updateRatesSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().required(),
      est_rate: Joi.number().min(0).required()
    })
  ).min(1).required().messages({
    'array.min': 'At least one item rate must be provided'
  })
});

/**
 * Update Requisition Items & Quantities Schema (Project Coordinator / Admin)
 */
export const updateRequisitionItemsSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().allow(null).optional(),
      material_id: Joi.number().integer().allow(null).optional(),
      description: Joi.string().min(2).max(255).required().messages({
        'any.required': 'Item description is required'
      }),
      spec: Joi.string().allow('', null).optional(),
      unit: Joi.string().max(50).required().messages({
        'any.required': 'Unit is required'
      }),
      quantity: Joi.number().positive().required().messages({
        'number.positive': 'Quantity must be greater than zero',
        'any.required': 'Quantity is required'
      }),
      est_rate: Joi.number().min(0).default(0.00),
      is_custom: Joi.boolean().default(false),
      justification: Joi.string().allow('', null).optional(),
      photos: Joi.array().items(Joi.any()).default([])
    })
  ).min(1).required().messages({
    'array.min': 'Request must have at least one item'
  })
});

/**
 * Query / Filter Schema (Search & Pagination)
 */
export const queryRequisitionSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow('', null).optional(),
  status: Joi.string().allow('', null).optional(),
  site_id: Joi.number().integer().allow(null).optional(),
  sort_by: Joi.string().valid('created_at', 'pr_no', 'status', 'category').default('created_at'),
  order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC')
});
