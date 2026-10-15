import { ApiError } from '../utils/apiError.js';

/**
 * Centralized Error Handling Middleware:
 * Catches all errors from async handlers and controller layers.
 * Formats a clean, predictable JSON response and prevents internal stack trace leaks in production.
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // If error is not an instance of ApiError, wrap it
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  const isServerError = error.statusCode >= 500;

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message || 'Internal Server Error',
    errors: error.errors || []
  };

  // Include stack trace only in development mode
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  // Log server errors
  if (error.statusCode >= 500) {
    console.error('💥 Server Error:', err);
  }

  return res.status(error.statusCode).json(response);
};

/**
 * 404 Route Not Found Middleware
 */
export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Endpoint not found: ${req.method} ${req.originalUrl}`));
};
