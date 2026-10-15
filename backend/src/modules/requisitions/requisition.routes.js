import { Router } from 'express';
import { RequisitionController } from './requisition.controller.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();

// All requisition routes require authentication
router.use(verifyJwt);

/**
 * @route   GET /api/v1/requisitions
 * @desc    Get paginated requisitions with tab counts and filters
 * @access  All authenticated portal users (Site supervisor scoped to own PRs)
 */
router.get('/', RequisitionController.getAll);

/**
 * @route   GET /api/v1/requisitions/pipeline/stats
 * @desc    Get counts for 7-stage procurement pipeline
 */
router.get('/pipeline/stats', RequisitionController.getPipelineStats);

/**
 * @route   GET /api/v1/requisitions/:id
 * @desc    Get requisition details with line items, history, edits, delivery receipts
 * @access  All authenticated portal users
 */
router.get('/:id', RequisitionController.getById);

/**
 * @route   POST /api/v1/requisitions
 * @desc    Site Supervisor, PC, Purchase, Admin raises a new material request
 * @access  Supervisor, PC, Purchase, Admin
 */
router.post(
  '/',
  requireRoles(ROLES.SUPERVISOR, ROLES.PC, ROLES.PURCHASE, ROLES.ADMIN),
  RequisitionController.create
);

/**
 * @route   PUT /api/v1/requisitions/:id/coordinator-edit
 * @desc    Project Coordinator edits items, quantities, dates, remarks before approving
 * @access  PC, Admin
 */
router.put(
  '/:id/coordinator-edit',
  requireRoles(ROLES.PC, ROLES.ADMIN),
  RequisitionController.coordinatorEdit
);

/**
 * @route   POST /api/v1/requisitions/:id/coordinator-approve
 * @desc    Project Coordinator approves and forwards request to Purchase Department
 * @access  PC, Admin
 */
router.post(
  '/:id/coordinator-approve',
  requireRoles(ROLES.PC, ROLES.ADMIN),
  RequisitionController.coordinatorApprove
);

/**
 * @route   POST /api/v1/requisitions/:id/coordinator-decline
 * @desc    Project Coordinator declines request with mandatory reason
 * @access  PC, Admin
 */
router.post(
  '/:id/coordinator-decline',
  requireRoles(ROLES.PC, ROLES.ADMIN),
  RequisitionController.coordinatorDecline
);

/**
 * @route   POST /api/v1/requisitions/:id/purchase-approve
 * @desc    Purchase Department approves request and sends RFQ to selected vendors
 * @access  Purchase, Admin
 */
router.post(
  '/:id/purchase-approve',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RequisitionController.purchaseApprove
);

/**
 * @route   PATCH /api/v1/requisitions/:id/payment-terms
 * @desc    Purchase Department configures payment terms on PR and linked RFQs
 * @access  Purchase, Admin
 */
router.patch(
  '/:id/payment-terms',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RequisitionController.updatePaymentTerms
);

/**
 * @route   POST /api/v1/requisitions/:id/purchase-decline
 * @desc    Purchase Department declines request with mandatory reason
 * @access  Purchase, Admin
 */
router.post(
  '/:id/purchase-decline',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RequisitionController.purchaseDecline
);

/**
 * @route   POST /api/v1/requisitions/:id/shortlist-vendor
 * @desc    Purchase Manager shortlists a vendor after Director approval
 * @access  Purchase, Admin
 */
router.post(
  '/:id/shortlist-vendor',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RequisitionController.shortlistVendor
);

/**
 * @route   POST /api/v1/requisitions/:id/dispatch
 * @desc    Vendor records dispatch details (dispatch date, vehicle, challan no, qty)
 * @access  Vendor, Purchase, Admin
 */
router.post(
  '/:id/dispatch',
  requireRoles(ROLES.VENDOR, ROLES.PURCHASE, ROLES.ADMIN),
  RequisitionController.dispatchDelivery
);

/**
 * @route   POST /api/v1/requisitions/:id/receive
 * @desc    Site Supervisor marks material as received and uploads proof
 * @access  Supervisor, PC, Purchase, Admin
 */
router.post(
  '/:id/receive',
  requireRoles(ROLES.SUPERVISOR, ROLES.PC, ROLES.PURCHASE, ROLES.ADMIN),
  RequisitionController.receiveDelivery
);

/**
 * @route   PATCH /api/v1/requisitions/:id/status
 * @desc    Generic status transition
 * @access  PC, Purchase, Director, Admin
 */
router.patch(
  '/:id/status',
  requireRoles(ROLES.PC, ROLES.PURCHASE, ROLES.DIRECTOR, ROLES.ADMIN),
  RequisitionController.updateStatus
);

/**
 * @route   PUT /api/v1/requisitions/:id/items
 * @desc    Legacy update items endpoint
 * @access  PC, Purchase, Supervisor, Admin
 */
router.put(
  '/:id/items',
  requireRoles(ROLES.PC, ROLES.PURCHASE, ROLES.SUPERVISOR, ROLES.ADMIN),
  RequisitionController.updateItems
);

/**
 * @route   PUT /api/v1/requisitions/:id/rates
 * @desc    Purchase updates estimated rates
 * @access  Purchase, Admin
 */
router.put(
  '/:id/rates',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RequisitionController.updateRates
);

/**
 * @route   DELETE /api/v1/requisitions/:id
 * @desc    Delete draft PR
 * @access  PC, Admin
 */
router.delete(
  '/:id',
  requireRoles(ROLES.PC, ROLES.ADMIN),
  RequisitionController.delete
);

/**
 * @route   POST /api/v1/requisitions/:id/reopen-dispatch
 * @desc    Reopen vendor dispatch link for corrections
 * @access  Purchase, Admin
 */
router.post(
  '/:id/reopen-dispatch',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RequisitionController.reopenDispatchLink
);

export default router;
