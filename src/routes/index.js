import { Router } from 'express';
import accessRoutes from './accessRoutes.js';
import logRoutes from './logRoutes.js';
import userRoutes from './userRoutes.js';
import authRoutes from './authRoutes.js';
import faceRoutes from './faceRoutes.js';
import { verifyJwt } from '../middleware/jwtMiddleware.js';

const router = Router();

router.use('/auth', authRoutes)
router.use('/access', accessRoutes);
router.use('/face', faceRoutes);           // public - tidak perlu JWT
router.use('/logs', verifyJwt, logRoutes);
router.use('/users', verifyJwt, userRoutes);

export default router;
