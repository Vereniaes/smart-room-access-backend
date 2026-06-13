// src/routes/faceRoutes.js
//
// -> endpoint face recognition
//    -> POST /api/v1/face/register  : panggil ML service, simpan embedding ke DB
//    -> POST /api/v1/face/inference : panggil ML service, cek kemiripan di DB pakai pgvector
// -> menggunakan multer untuk terima multipart/form-data dari client

import { Router } from 'express';
import multer from 'multer';
import { sendError } from '../utils/response.js';
import { registerFace, inferFace } from '../services/faceService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ========================================================================================
// POST /api/v1/face/register
// ========================================================================================

router.post(
    '/register',
    upload.fields([
        { name: 'photo_1', maxCount: 1 },
        { name: 'photo_2', maxCount: 1 },
        { name: 'photo_3', maxCount: 1 },
    ]),
    async (req, res) => {
        const { person_name, user_id } = req.body;
        if (!person_name) {
            return sendError(res, 400, 'person_name wajib diisi');
        }

        const files = req.files;
        if (!files?.photo_1?.[0] || !files?.photo_2?.[0] || !files?.photo_3?.[0]) {
            return sendError(res, 400, 'Butuh 3 foto: photo_1, photo_2, photo_3');
        }

        try {
            const photoFiles = [
                { ...files.photo_1[0], fieldname: 'photo_1' },
                { ...files.photo_2[0], fieldname: 'photo_2' },
                { ...files.photo_3[0], fieldname: 'photo_3' },
            ];

            const result = await registerFace(person_name, user_id ? parseInt(user_id) : null, photoFiles);
            
            return res.status(201).json({
                success: true,
                message: "Face registered successfully",
                data: result
            });
        } catch (err) {
            if (err.response) {
                return res.status(err.response.status).json(err.response.data);
            }
            console.error('[face/register] error:', err.message);
            return sendError(res, 500, `Internal Server Error: ${err.message}`);
        }
    },
);

// ========================================================================================
// POST /api/v1/face/inference
// ========================================================================================

router.post(
    '/inference',
    upload.single('photo'),
    async (req, res) => {
        if (!req.file) {
            return sendError(res, 400, 'File foto dengan field name "photo" wajib diisi');
        }

        try {
            const photoFile = { ...req.file, fieldname: 'photo' };
            const result = await inferFace(photoFile);
            
            return res.status(200).json({
                success: true,
                message: result.matched ? "Match found" : "No match found",
                data: result
            });
        } catch (err) {
            if (err.response) {
                return res.status(err.response.status).json(err.response.data);
            }
            console.error('[face/inference] error:', err.message);
            return sendError(res, 500, `Internal Server Error: ${err.message}`);
        }
    },
);

export default router;
