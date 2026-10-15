import { Router } from 'express';
import { PaymentController } from './payment.controller.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();
router.use(verifyJwt);

router.get('/po-summary', PaymentController.getPoSummary);
router.get('/po/:poId', PaymentController.getByPoId);
router.get('/', PaymentController.getAll);
router.post(
  '/',
  requireRoles(ROLES.ACCOUNTS, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.PURCHASE),
  PaymentController.create
);

export default router;
