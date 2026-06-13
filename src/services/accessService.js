// src/services/accessService.js
//
// -> handling validasi akses dari ESP32
//    -> validateAccess : RFID check + face inference, keduanya harus pass baru "allowed"
// -> flow dual-factor:
//    -> RFID lookup  : HMAC hash -> WHERE query O(1) dengan index -> < 5ms
//    -> face check   : call ML service /face/inference (opsional jika photo ada)
//    -> keduanya run paralel setelah RFID ditemukan
// -> GCS upload : async fire-and-forget, tidak blokir response

import axios            from 'axios';
import FormData         from 'form-data';
import { db }           from '../database/sql.js';
import { accessLogs }   from '../database/schema.js';
import { sendNotification }  from './notificationService.js';
import { getDataUserByRfid } from './userService.js';
import { uploadToGcs }       from '../utils/gcsUpload.js';
import { ML_SERVICE_URL }    from '../../config/env.js';

const ML_BASE           = ML_SERVICE_URL || 'http://localhost:8001';
const FACE_MATCH_THRESHOLD = 0.40;

// helper ---------------------------------------------------------------------------------

// fungsi insert ke tabel access_logs
// input param : userId   -> integer atau null
//               uid      -> string raw UID dari ESP32
//               status   -> "allowed" atau "denied"
//               room     -> string nama ruangan
//               message  -> string alasan akses
//               photoUrl -> string URL GCS atau null
const logAccess = async (userId, uid, status, room, message, photoUrl = null) => {
    try {
        await db.insert(accessLogs).values({
            user_id:   userId || null,
            uid,
            status,
            room,
            message,
            photo_url: photoUrl,
        });
    } catch (error) {
        console.error('Gagal menambahkan log akses:', error);
    }
};


// fungsi call ML service untuk inference wajah dari photo buffer
// input param : photoBuffer -> Buffer JPEG dari ESP32-CAM
// output : { matched: bool, person_name: str, similarity: float } atau null jika ML error
// note   : error ML service tidak crash akses - di-handle gracefully
const callFaceInference = async (photoBuffer) => {
    try {
        const form = new FormData();
        form.append('photo', photoBuffer, {
            filename:    'capture.jpg',
            contentType: 'image/jpeg',
        });

        const response = await axios.post(`${ML_BASE}/face/inference`, form, {
            headers: form.getHeaders(),
            timeout: 10000,   // 10 detik timeout untuk inference
        });

        return response.data?.data || null;
    } catch (err) {
        console.error('[face inference] ML service error:', err.message);
        return null;  // null = ML tidak bisa dihubungi, treated sebagai "skip face check"
    }
};

// end of helper --------------------------------------------------------------------------


// fungsi utama validasi akses dual-factor dari ESP32
// input param : uid         -> string raw RFID UID (plaintext)
//               room        -> string nama ruangan
//               photoBuffer -> Buffer JPEG dari ESP32-CAM atau null
// output : { status: "allowed"|"denied", message: string, face: object|null }
//
// flow:
//   1. RFID lookup O(1) -> jika tidak ada: denied langsung
//   2. cek masa berlaku + jadwal akses
//   3. jika ada photo:
//      - GCS upload (async, fire-and-forget)
//      - face inference (sync, harus tunggu hasilnya)
//      - jika face tidak match: denied
//   4. jika tidak ada photo: skip face check, lanjut dengan RFID saja
//   5. log + notif Telegram
export const validateAccess = async (uid, room, photoBuffer = null) => {
    // 1. RFID lookup - single query O(1) dengan HMAC hash + index
    const user = await getDataUserByRfid(uid);

    if (!user) {
        const msg = 'RFID tidak terdaftar di sistem';
        await logAccess(null, uid, 'denied', room, msg, null);
        await sendNotification(null, room, 'denied', msg);
        return { status: 'denied', message: msg, face: null };
    }

    // waktu WIB (UTC+7) - Cloud Run berjalan di UTC
    const nowWIB      = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const today       = nowWIB.toISOString().split('T')[0];
    const currentTime = nowWIB.toISOString().slice(11, 16); // HH:MM

    // 2. cek masa berlaku kartu
    if (user.valid_until && today > user.valid_until) {
        const msg = 'Kartu RFID telah kadaluarsa';
        await logAccess(user.id, uid, 'denied', room, msg, null);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg, face: null };
    }

    // 3. cek jadwal akses
    if (currentTime < user.schedule_start || currentTime > user.schedule_end) {
        const msg = 'Akses ditolak di luar jadwal operasional';
        await logAccess(user.id, uid, 'denied', room, msg, null);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg, face: null };
    }

    // 4. face check - hanya jika photo tersedia
    let faceResult = null;

    if (photoBuffer) {
        // GCS upload: async fire-and-forget - tidak perlu tunggu
        uploadToGcs(photoBuffer, uid).catch(err =>
            console.error('[GCS] Upload failed:', err.message)
        );

        // face inference: sync - perlu hasil untuk keputusan akses
        faceResult = await callFaceInference(photoBuffer);

        if (faceResult === null) {
            // ML service tidak bisa dihubungi - tolak akses karena face check wajib jika photo ada
            const msg = 'Face verification gagal - ML service tidak tersedia';
            await logAccess(user.id, uid, 'denied', room, msg, null);
            await sendNotification(user, room, 'denied', msg);
            return { status: 'denied', message: msg, face: null };
        }

        if (!faceResult.matched) {
            // wajah tidak dikenali
            const msg = `Wajah tidak dikenali (similarity: ${faceResult.similarity?.toFixed(2) ?? 'N/A'} < ${FACE_MATCH_THRESHOLD})`;
            await logAccess(user.id, uid, 'denied', room, msg, null);
            await sendNotification(user, room, 'denied', msg);
            return { status: 'denied', message: msg, face: faceResult };
        }
    }

    // 5. semua check pass - akses diizinkan
    const msg = photoBuffer
        ? `Akses berhasil - RFID dan wajah terverifikasi (${faceResult?.person_name ?? 'unknown'})`
        : 'Akses berhasil diberikan (tanpa verifikasi wajah)';

    await logAccess(user.id, uid, 'allowed', room, msg, null);
    await sendNotification(user, room, 'allowed', msg);
    return { status: 'allowed', message: msg, face: faceResult };
};
