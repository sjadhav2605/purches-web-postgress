import { Router } from 'express';
import { PurchaseOrderController } from './po.controller.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createPoSchema,
  updatePoStatusSchema,
  queryPoSchema,
  updateCommercialTermsSchema
} from './po.validator.js';
import { ROLES } from '../../constants/roles.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Public Rate Limiters for vendor delivery schedule link
const publicDeliveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please wait a few minutes.'
  }
});

const publicDeliverySubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many delivery schedule submissions from this IP. Please wait a few minutes.'
  }
});

/**
 * Public Delivery Endpoints for external vendor dispatch links
 */
router.get('/public/delivery/:id', publicDeliveryLimiter, PurchaseOrderController.getPublicDeliveryDetails);
router.post('/public/delivery/:id/submit', publicDeliverySubmitLimiter, PurchaseOrderController.submitPublicDeliverySchedule);

router.use(verifyJwt);

/**
 * @route   GET /api/v1/orders
 * @desc    Get paginated POs with search and filter
 * @access  Authenticated portal users
 */
router.get(
  '/',
  validate(queryPoSchema, 'query'),
  PurchaseOrderController.getAll
);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get PO details with line items and vendor/site info
 * @access  Authenticated portal users
 */
router.get('/:id', PurchaseOrderController.getById);

/**
 * @route   POST /api/v1/orders
 * @desc    Create and issue new Purchase Order
 * @access  Director, Purchase, Admin
 */
router.post(
  '/',
  requireRoles(ROLES.DIRECTOR, ROLES.PURCHASE, ROLES.ADMIN),
  validate(createPoSchema, 'body'),
  PurchaseOrderController.create
);

/**
 * @route   PATCH /api/v1/orders/:id/status
 * @desc    Update PO status (Acknowledged, Dispatched, Site Verified, Cancelled)
 * @access  Director, Purchase, Supervisor, Vendor, Admin
 */
router.patch(
  '/:id/status',
  requireRoles(ROLES.PURCHASE, ROLES.DIRECTOR, ROLES.ADMIN),
  validate(updatePoStatusSchema, 'body'),
  PurchaseOrderController.updateStatus
);

/**
 * @route   PATCH /api/v1/orders/:id/commercial-terms
 * @desc    Add or edit Commercial Terms & Declaration
 * @access  Purchase Manager, Admin
 */
router.patch(
  '/:id/commercial-terms',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  validate(updateCommercialTermsSchema, 'body'),
  PurchaseOrderController.updateCommercialTerms
);

export default router;
