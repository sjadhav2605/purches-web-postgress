import { ApiError } from '../utils/apiError.js';

/**
 * Joi Schema Validation Middleware:
 * Validates request data (body, query, or params) against a provided Joi schema.
 *
 * @param {Object} schema - Joi validation schema
 * @param {'body'|'query'|'params'} source - Part of request to validate
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,     // Return all validation errors, not just the first
      stripUnknown: true,   // Remove unknown fields for security
      errors: { wrap: { label: '' } }
    });

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return next(ApiError.badRequest('Input validation failed', errorDetails));
    }

    // Replace request data with sanitized validated data
    req[source] = value;
    next();
  };
};
