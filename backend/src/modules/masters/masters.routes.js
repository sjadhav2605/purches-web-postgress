import { Router } from 'express';
import { MastersController } from './masters.controller.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();

// Public routes for vendor self-registration (NO auth token needed)
router.post('/public/vendors/register', MastersController.registerVendorPublic);

// Guard only masters endpoints with verifyJwt
router.use(['/materials', '/sites', '/vendors'], verifyJwt);

// Materials
router.get('/materials', MastersController.getMaterials);
router.post('/materials', requireRoles(ROLES.ADMIN, ROLES.PURCHASE), MastersController.createMaterial);
router.delete('/materials/:id', requireRoles(ROLES.ADMIN), MastersController.deleteMaterial);

// Sites
router.get('/sites', MastersController.getSites);
router.post('/sites', requireRoles(ROLES.ADMIN, ROLES.PURCHASE), MastersController.createSite);
router.delete('/sites/:id', requireRoles(ROLES.ADMIN), MastersController.deleteSite);

// Vendors
router.get('/vendors', MastersController.getVendors);
router.post('/vendors', requireRoles(ROLES.ADMIN, ROLES.PURCHASE), MastersController.createVendor);
router.post('/vendors/send-invite', requireRoles(ROLES.ADMIN, ROLES.PURCHASE), MastersController.sendVendorInvite);
router.delete('/vendors/:id', requireRoles(ROLES.ADMIN), MastersController.deleteVendor);

export default router;
