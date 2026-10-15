import { Router } from 'express';
import { DeliveryController } from './delivery.controller.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();
router.use(verifyJwt);

router.get('/', DeliveryController.getAll);
router.post(
  '/',
  requireRoles(ROLES.SUPERVISOR, ROLES.PC, ROLES.PURCHASE, ROLES.ADMIN),
  DeliveryController.create
);

export default router;
