// src/controllers/accessController.js
//
// -> controller untuk endpoint POST /api/v1/access
//    -> terima multipart/form-data dari ESP32
//    -> parse uid (wajib), room (wajib), photo (opsional)
//    -> forward ke validateAccess service (RFID + face dual-factor)

import multer from 'multer';
import sharp from 'sharp';
import { validateAccess }         from '../services/accessService.js';
import { sendResponse, sendError } from '../utils/response.js';

// simpan photo di memory buffer - tidak perlu tulis ke disk
const upload = multer({ storage: multer.memoryStorage() });
export const uploadMiddleware = upload.single('photo');


// handler POST /api/v1/access
// input  : req.body.uid  -> string raw RFID UID dari ESP32 (wajib)
//          req.body.room -> string nama ruangan (wajib)
//          req.file      -> JPEG photo dari ESP32-CAM (opsional, multer parsed)
// output : JSON { status: "allowed"|"denied", message, face }
export const handleAccessRequest = async (req, res) => {
    try {
        const { uid, room } = req.body;

        if (!uid || !room) {
            return sendError(res, 400, 'Missing required fields: uid or room');
        }

        let photoBuffer = req.file ? req.file.buffer : null;

        // rotate 180 - ESP32-CAM terpasang terbalik
        if (photoBuffer) {
            photoBuffer = await sharp(photoBuffer).rotate(180).toBuffer();
        }

        const result = await validateAccess(uid, room, photoBuffer);

        return sendResponse(
            res,
            200,
            {
                status:  result.status,
                message: result.message,
                ...(result.face && { face: result.face }), // include face result jika ada
            },
            'Access request processed successfully',
        );
    } catch (error) {
        console.error('Access Request Error:', error);
        return sendError(res, 500, 'Internal server error');
    }
};
