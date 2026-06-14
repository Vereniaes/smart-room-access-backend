/**
 * src/controllers/systemController.js
 * 
 * -> controller untuk handling request data info sistem & test telegram
 *      -> getSystemInfo: mengembalikan data health, env, dan metrik
 *      -> testTelegramConnection: memicu pesan ping Telegram bot
 * -> disini buat orkestrasi service sistem, service telegram, dan pengiriman response JSON
 */

import { sendResponse, sendError } from '../utils/response.js';
import { checkDatabaseHealth, checkMlServiceHealth, getSystemMetrics, getConnectedDevices } from '../services/systemService.js';
import { sendTestNotification } from '../services/notificationService.js';
import { 
    TELEGRAM_BOT_TOKEN, 
    TELEGRAM_GROUP_ID, 
    DATABASE_URL, 
    JWT_SECRET, 
    HMAC_SECRET, 
    GCP_BUCKET_NAME, 
    ML_SERVICE_URL 
} from '../../config/env.js';

// helper --------------------------------------------------------------------------

// function untuk menyamarkan string sensitif (token / key)
// input param : str (string yang akan disamarkan), visibleCount (jumlah karakter yang dibiarkan terlihat di awal & akhir)
// output      : string (hasil penyamaran, misal: 123456******7890)
const maskSensitiveString = (str, visibleCount = 4) => {
    if (!str) return "Not Configured";
    if (str.length <= visibleCount * 2) return "*****";
    const start = str.slice(0, visibleCount);
    const end = str.slice(-visibleCount);
    return `${start}*****${end}`;
};

// function untuk mendapatkan informasi detail & kesehatan sistem
// input param : req (request), res (response)
// output      : JSON response dengan data kesehatan database, ML service, metrik, dan env status
export const getSystemInfo = async (req, res) => {
    try {
        const isDbOnline = await checkDatabaseHealth();
        const isMlOnline = await checkMlServiceHealth();
        const metrics = getSystemMetrics();
        const devices = await getConnectedDevices();

        const envStatus = {
            DATABASE_URL: DATABASE_URL ? "Configured" : "Missing",
            JWT_SECRET: JWT_SECRET ? "Configured" : "Missing",
            HMAC_SECRET: HMAC_SECRET ? "Configured" : "Missing",
            ML_SERVICE_URL: ML_SERVICE_URL || "http://localhost:8001 (Default)",
            GCP_BUCKET_NAME: GCP_BUCKET_NAME || "Not Configured",
            TELEGRAM_BOT_TOKEN: maskSensitiveString(TELEGRAM_BOT_TOKEN, 6),
            TELEGRAM_GROUP_ID: maskSensitiveString(TELEGRAM_GROUP_ID, 4),
        };

        const systemInfo = {
            health: {
                database: isDbOnline ? "Online" : "Offline",
                mlService: isMlOnline ? "Online" : "Offline",
                backend: "Online"
            },
            metrics,
            envStatus,
            devices,
            adminProfile: req.user // { id, username, role, name }
        };

        return sendResponse(res, 200, systemInfo, "System info retrieved successfully");
    } catch (error) {
        return sendError(res, 500, `Internal server error: ${error.message}`);
    }
};

// function untuk memicu test ping notifikasi telegram
// input param : req (request), res (response)
// output      : JSON response indikasi keberhasilan pengiriman telegram
export const testTelegramConnection = async (req, res) => {
    try {
        await sendTestNotification();
        return sendResponse(res, 200, null, "Test notification sent successfully");
    } catch (error) {
        return sendError(res, 400, `Gagal mengirim notifikasi uji coba: ${error.message}`);
    }
};

// end of helper ------------------------------------------------------------------
