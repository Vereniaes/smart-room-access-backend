// src/routes/faceRoutes.js
//
// -> proxy routes face recognition ke Python ML service
//    -> POST /api/v1/face/register  -> forward ke ML service /face/register
//    -> POST /api/v1/face/inference -> forward ke ML service /face/inference
// -> menggunakan multer untuk terima multipart/form-data dari client
// -> tidak pakai JWT auth (public endpoint, seperti /access)
// -> jika ML_SERVICE_URL tidak di-set, return 503 langsung

import { Router }   from 'express';
import multer        from 'multer';
import axios         from 'axios';
import FormData      from 'form-data';
import { ML_SERVICE_URL } from '../../config/env.js';
import { sendError }      from '../utils/response.js';

const router  = Router();
// simpan file di memory (buffer), bukan disk — supaya bisa forward langsung
const upload  = multer({ storage: multer.memoryStorage() });

// base URL ML service dari env (default fallback ke localhost:8001)
const ML_BASE = ML_SERVICE_URL || 'http://localhost:8001';


// helper ---------------------------------------------------------------------------------

// fungsi forward multipart request ke ML service
// input param : files  -> array of { fieldname, buffer, mimetype, originalname }
//               fields -> object { key: value } untuk form fields non-file
//               path   -> string path di ML service (contoh: /face/register)
// output : response data dari ML service
// error  : throw jika ML service tidak bisa dihubungi atau return error
async function forwardMultipart(files, fields, path) {
    const form = new FormData();

    // tambah semua text fields
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) {
            form.append(key, String(value));
        }
    }

    // tambah semua file fields
    for (const file of files) {
        form.append(file.fieldname, file.buffer, {
            filename:    file.originalname,
            contentType: file.mimetype,
        });
    }

    const response = await axios.post(`${ML_BASE}${path}`, form, {
        headers: form.getHeaders(),
        timeout: 30000,   // 30 detik timeout (inference bisa agak lama)
    });

    return response.data;
}

// end of helper --------------------------------------------------------------------------


// ========================================================================================
// POST /api/v1/face/register
// ========================================================================================

/**
 * @openapi
 * /api/v1/face/register:
 *   post:
 *     tags:
 *       - Face Recognition
 *     summary: Register person face (3 photos)
 *     description: |
 *       Daftarkan wajah seseorang dengan 3 foto.
 *       Foto 2 dan 3 divalidasi harus mirip dengan foto 1 (cosine similarity >= 0.40).
 *       Embedding 512-dim disimpan ke tabel face_embeddings.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [person_name, photo_1, photo_2, photo_3]
 *             properties:
 *               person_name:
 *                 type: string
 *                 example: John Doe
 *               user_id:
 *                 type: integer
 *                 description: ID user di tabel users (opsional)
 *               photo_1:
 *                 type: string
 *                 format: binary
 *               photo_2:
 *                 type: string
 *                 format: binary
 *               photo_3:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Face registered successfully
 *       422:
 *         description: Face mismatch - photos are not the same person
 *       503:
 *         description: ML service tidak tersedia
 */
router.post(
    '/register',
    upload.fields([
        { name: 'photo_1', maxCount: 1 },
        { name: 'photo_2', maxCount: 1 },
        { name: 'photo_3', maxCount: 1 },
    ]),
    async (req, res) => {
        // validasi input
        const { person_name, user_id } = req.body;
        if (!person_name) {
            return sendError(res, 400, 'person_name wajib diisi');
        }

        const files = req.files;
        if (!files?.photo_1?.[0] || !files?.photo_2?.[0] || !files?.photo_3?.[0]) {
            return sendError(res, 400, 'Butuh 3 foto: photo_1, photo_2, photo_3');
        }

        try {
            const data = await forwardMultipart(
                [
                    { ...files.photo_1[0], fieldname: 'photo_1' },
                    { ...files.photo_2[0], fieldname: 'photo_2' },
                    { ...files.photo_3[0], fieldname: 'photo_3' },
                ],
                { person_name, user_id },
                '/face/register',
            );
            return res.status(201).json(data);
        } catch (err) {
            if (err.response) {
                // error dari ML service (misal: wajah tidak terdeteksi)
                return res.status(err.response.status).json(err.response.data);
            }
            // ML service tidak bisa dihubungi
            console.error('[face/register] ML service error:', err.message);
            return sendError(res, 503, `ML service tidak tersedia: ${err.message}`);
        }
    },
);


// ========================================================================================
// POST /api/v1/face/inference
// ========================================================================================

/**
 * @openapi
 * /api/v1/face/inference:
 *   post:
 *     tags:
 *       - Face Recognition
 *     summary: Identify person from face photo (1 photo)
 *     description: |
 *       Kenali wajah dari 1 foto.
 *       Mencari best match dari semua embedding yang terdaftar di database.
 *       Threshold cosine similarity: 0.40 (sesuai cermin-new pipeline).
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo]
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Inference result (matched atau not matched)
 *       422:
 *         description: Wajah tidak terdeteksi di foto
 *       503:
 *         description: ML service tidak tersedia
 */
router.post(
    '/inference',
    upload.single('photo'),
    async (req, res) => {
        if (!req.file) {
            return sendError(res, 400, 'File foto dengan field name "photo" wajib diisi');
        }

        try {
            const data = await forwardMultipart(
                [{ ...req.file, fieldname: 'photo' }],
                {},
                '/face/inference',
            );
            return res.status(200).json(data);
        } catch (err) {
            if (err.response) {
                return res.status(err.response.status).json(err.response.data);
            }
            console.error('[face/inference] ML service error:', err.message);
            return sendError(res, 503, `ML service tidak tersedia: ${err.message}`);
        }
    },
);

export default router;
