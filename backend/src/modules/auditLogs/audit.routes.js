import { Router } from 'express';
import { auditController } from './audit.controller.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();
router.use(verifyJwt);
router.use(requireRoles(ROLES.ADMIN, ROLES.DIRECTOR));

router.get('/', auditController.getAuditLogs);

export default router;
