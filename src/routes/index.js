import { Router } from 'express';
import accessRoutes from './accessRoutes.js';
import logRoutes from './logRoutes.js';
import userRoutes from './userRoutes.js';
import authRoutes from './authRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import { verifyJwt } from '../middleware/jwtMiddleware.js';

const router = Router();

router.use('/auth', authRoutes)
router.use('/access', accessRoutes);
router.use('/logs', verifyJwt, logRoutes);
router.use('/users', verifyJwt, userRoutes);
router.use('/dashboard', verifyJwt, dashboardRoutes);

export default router;
