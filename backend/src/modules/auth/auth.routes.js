import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { verifyJwt } from '../../middlewares/auth.middleware.js';
import { loginSchema } from './auth.validator.js';

const router = Router();

// Public routes
router.post('/login', validate(loginSchema, 'body'), AuthController.login);

// Protected routes (requires valid JWT token)
router.get('/me', verifyJwt, AuthController.me);

export default router;
