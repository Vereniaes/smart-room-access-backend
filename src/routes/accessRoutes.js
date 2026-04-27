import { Router } from 'express';
import { handleAccessRequest, uploadMiddleware } from '../controllers/accessController.js';
import { verifyApiKey } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * @openapi
 * /api/v1/access:
 *   post:
 *     tags:
 *       - Access (IoT Device)
 *     summary: Validate room access
 *     description: Validates whether an RFID card holder is allowed to enter a specific room. Accepts multipart/form-data with optional photo from ESP32-CAM. Photo is uploaded to GCP Cloud Storage. Requires API Key authentication via the `X-API-KEY` header.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [uid, room]
 *             properties:
 *               uid:
 *                 type: string
 *                 example: "7B E6 40 02"
 *               room:
 *                 type: string
 *                 example: "lab-iot"
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Optional JPEG photo from ESP32-CAM
 *     responses:
 *       200:
 *         description: Access validation result
 *         content:
 *           application/json:
 *             examples:
 *               allowed:
 *                 value:
 *                   status: allowed
 *                   message: Akses berhasil diberikan
 *               denied:
 *                 value:
 *                   status: denied
 *                   message: Akses ditolak di luar jadwal operasional
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid or missing API Key
 *       500:
 *         description: Internal server error
 */

// uploadMiddleware (multer) must run BEFORE verifyApiKey so req.body is parsed
router.post('/', uploadMiddleware, verifyApiKey, handleAccessRequest);

export default router;
