import { Router } from 'express';
import { RfqController } from './rfq.controller.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { ROLES } from '../../constants/roles.js';

import rateLimit from 'express-rate-limit';

const router = Router();

// Dedicated Rate Limiters for unauthenticated public quote portal
const publicQuoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after a few minutes.'
  }
});

const publicSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many quote submissions from this IP. Please wait a few minutes before trying again.'
  }
});

// Public Quote Link Endpoints (No JWT required for external vendors)
router.get('/public/quote/:id', publicQuoteLimiter, RfqController.getPublicQuoteDetails);
router.post('/public/quote/submit', publicSubmitLimiter, RfqController.submitPublicQuote);
router.post('/public/quote/:id/submit', publicSubmitLimiter, RfqController.submitPublicQuote);
router.post('/public/quote/dispatch', publicSubmitLimiter, RfqController.submitPublicDispatch);
router.post('/public/quote/:id/dispatch', publicSubmitLimiter, RfqController.submitPublicDispatch);

router.use(verifyJwt);

router.get('/', RfqController.getAll);
router.get('/:id', RfqController.getById);

router.post(
  '/',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.create
);

router.post(
  '/bid',
  requireRoles(ROLES.VENDOR, ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.submitBid
);

router.post(
  '/winner',
  requireRoles(ROLES.DIRECTOR, ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.selectWinner
);

router.post(
  '/:id/shortlist',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.shortlist
);

router.post(
  '/:id/director-approve',
  requireRoles(ROLES.DIRECTOR, ROLES.ADMIN),
  RfqController.directorApprove
);

router.post(
  '/:id/director-decline',
  requireRoles(ROLES.DIRECTOR, ROLES.ADMIN),
  RfqController.directorDecline
);

router.post(
  '/:id/send-back',
  requireRoles(ROLES.DIRECTOR, ROLES.ADMIN),
  RfqController.sendBack
);

router.post(
  '/:id/revision',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.createRevision
);

router.post(
  '/:id/bids/:bidId/send-revision',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.sendBidRevision
);

router.post(
  '/:id/bids/:bidId/negotiated-rates',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.saveNegotiatedRates
);

router.post(
  '/:id/bids/:bidId/respond-revision',
  requireRoles(ROLES.VENDOR, ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.respondBidRevision
);

router.post(
  '/:id/bids/:bidId/reject-revision',
  requireRoles(ROLES.VENDOR, ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.rejectBidRevision
);

router.patch(
  '/:id/payment-terms',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.updatePaymentTerms
);

router.post(
  '/:id/reopen-dispatch',
  requireRoles(ROLES.PURCHASE, ROLES.ADMIN),
  RfqController.reopenDispatchLink
);

export default router;
