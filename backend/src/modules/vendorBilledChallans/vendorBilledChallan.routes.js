import { Router } from 'express';
import { VendorBilledChallanController } from './vendorBilledChallan.controller.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();

// Guard all routes with authentication
router.use(verifyJwt);

// Read routes: Admin/Purchase/Accounts see all; Director and Vendor are record-scoped in the service (utils/dataScope)
router.get(
  '/',
  requireRoles(ROLES.ADMIN, ROLES.PURCHASE, ROLES.DIRECTOR, ROLES.ACCOUNTS, ROLES.VENDOR),
  VendorBilledChallanController.getChallans
);

router.get(
  '/summary',
  requireRoles(ROLES.ADMIN, ROLES.PURCHASE, ROLES.DIRECTOR, ROLES.ACCOUNTS, ROLES.VENDOR),
  VendorBilledChallanController.getSummary
);

router.get(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.PURCHASE, ROLES.DIRECTOR, ROLES.ACCOUNTS, ROLES.VENDOR),
  VendorBilledChallanController.getChallanById
);

// Create route: Purchase Manager and Admin can add vendor billed challans
router.post(
  '/',
  requireRoles(ROLES.ADMIN, ROLES.PURCHASE),
  VendorBilledChallanController.createChallan
);

// Update route: Purchase Manager and Admin
router.put(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.PURCHASE),
  VendorBilledChallanController.updateChallan
);

// Delete route: Admin and Purchase Manager
router.delete(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.PURCHASE),
  VendorBilledChallanController.deleteChallan
);

export default router;
