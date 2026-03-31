import { Router } from "express";
import { login, handleRefreshToken, logout } from "../controllers/authController.js";
import { verifyJwt } from "../middleware/jwtMiddleware.js";

const router = Router();

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login admin user
 *     description: Authenticate with username and password to receive a JWT token for dashboard access.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", login);

/**
 * @openapi
 * /api/v1/auth/refresh:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token
 *     description: Uses the refresh token from cookies to issue a new access token.
 *     responses:
 *       200:
 *         description: Token refreshed.
 */
router.get("/refresh-token", handleRefreshToken);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user
 *     description: Clears the refresh token from the database and removes the cookie.
 *     security:
 *       - BearerAuth: []
 */
router.post("/logout", verifyJwt, logout);
export default router;