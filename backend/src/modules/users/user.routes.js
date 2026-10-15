import { Router } from 'express';
import { userController } from './user.controller.js';
import { createUserSchema, updateUserSchema, userIdParamSchema } from './user.validator.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();
router.use(verifyJwt);

// Get active directors list for shortlist assignment
router.get(
  '/directors',
  requireRoles(ROLES.ADMIN, ROLES.DIRECTOR, ROLES.PURCHASE),
  userController.getDirectors
);

// Get all portal users
router.get(
  '/',
  requireRoles(ROLES.ADMIN, ROLES.DIRECTOR, ROLES.PURCHASE),
  userController.getAllUsers
);

// Create new portal user with assigned site
router.post(
  '/',
  requireRoles(ROLES.ADMIN),
  validate(createUserSchema, 'body'),
  userController.createUser
);

// Update user role or status
router.patch(
  '/:id',
  requireRoles(ROLES.ADMIN),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema, 'body'),
  userController.updateUser
);

export default router;
