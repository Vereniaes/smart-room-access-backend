import multer from 'multer';
import { validateAccess } from '../services/accessService.js';
import { sendResponse, sendError } from '../utils/response.js';

// Store photo in memory (buffer) — no disk write needed
const upload = multer({ storage: multer.memoryStorage() });
export const uploadMiddleware = upload.single('photo');

export const handleAccessRequest = async (req, res) => {
    try {
        const { uid, room } = req.body;

        if (!uid || !room) {
            return sendError(res, 400, "Missing required fields: uid or room");
        }

        // req.file is set by multer if photo was uploaded (optional)
        const photoBuffer = req.file ? req.file.buffer : null;

        const result = await validateAccess(uid, room, photoBuffer);

        return sendResponse(res, 200, { status: result.status, message: result.message }, "Access request processed successfully");
    } catch (error) {
        console.error("Access Request Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};
