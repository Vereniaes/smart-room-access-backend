// src/services/accessService.js
//
// -> handling validasi akses dari ESP32
//    -> validateAccess : RFID check + face inference, keduanya harus pass baru "allowed"
// -> flow dual-factor:
//    -> RFID lookup  : HMAC hash -> WHERE query O(1) dengan index -> < 5ms
//    -> face check   : call ML service /face/inference (opsional jika photo ada)
//    -> keduanya run paralel setelah RFID ditemukan
// -> GCS upload : async fire-and-forget, tidak blokir response

import { eq }           from 'drizzle-orm';
import axios            from 'axios';
import FormData         from 'form-data';
import { db }           from '../database/sql.js';
import { users, accessLogs, faceEmbeddings } from '../database/schema.js';
import { sendNotification }  from './botService.js';
import { emitAccessEvent }   from '../utils/socketServer.js';
import { getDataUserByRfid } from './userService.js';
import { getDataCardByRfid } from './cardService.js';
import { uploadToGcs }       from '../utils/gcsUpload.js';
import { inferFace }         from './faceService.js';
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
        // emit real-time event ke dashboard
        emitAccessEvent({ user_id: userId || null, uid, status, room, message, photo_url: photoUrl, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Gagal menambahkan log akses:', error);
    }
};


// tidak perlu callFaceInference manual karena sudah pakai inferFace dari faceService.js

// end of helper --------------------------------------------------------------------------


// function buat validasi akses dual-factor dari ESP32
// input param : uid - string raw RFID UID
//               room - string nama ruangan
//               photoBuffer - Buffer JPEG dari ESP32-CAM atau null
// output : payload json { status, message, face }
export const validateAccess = async (uid, room, photoBuffer = null) => {
    // upload foto di awal agar selalu tersimpan di log ketika ada error/ditolak
    let photoUrl = null;
    if (photoBuffer) {
        try {
            photoUrl = await uploadToGcs(photoBuffer, uid);
        } catch (err) {
            console.error('[GCS] Upload failed:', err.message);
        }
    }

    // 1. RFID lookup di tabel cards (Cek apakah kartu terdaftar)
    const card = await getDataCardByRfid(uid);

    if (!card) {
        const msg = 'Kartu RFID tidak terdaftar di sistem';
        await logAccess(null, uid, 'denied', room, msg, photoUrl);
        await sendNotification(null, room, 'denied', msg);
        return { status: 'denied', message: msg, face: null };
    }

    // waktu WIB (UTC+7) - Cloud Run berjalan di UTC
    const nowWIB      = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const today       = nowWIB.toISOString().split('T')[0];
    const currentTime = nowWIB.toISOString().slice(11, 16); // HH:MM

    // 2. Cek masa berlaku / status blokir kartu
    if (card.valid_until && today > card.valid_until) {
        const isBlocked = card.valid_until === '1970-01-01';
        const msg = isBlocked ? 'Kartu RFID diblokir oleh administrator' : 'Kartu RFID telah kadaluarsa';
        await logAccess(null, uid, 'denied', room, msg, photoUrl);
        await sendNotification(null, room, 'denied', msg);
        return { status: 'denied', message: msg, face: null };
    }

    // 3. Cek apakah kartu dikaitkan dengan user
    const user = await getDataUserByRfid(uid);
    if (!user) {
        const msg = 'Kartu RFID belum dikaitkan dengan pengguna';
        await logAccess(null, uid, 'denied', room, msg, photoUrl);
        await sendNotification(null, room, 'denied', msg);
        return { status: 'denied', message: msg, face: null };
    }

    // 4. Cek masa berlaku user
    if (user.valid_until && today > user.valid_until) {
        const msg = 'Masa berlaku akun pengguna telah habis';
        await logAccess(user.id, uid, 'denied', room, msg, photoUrl);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg, face: null };
    }

    // 5. Cek jadwal akses user
    if (currentTime < user.schedule_start || currentTime > user.schedule_end) {
        const msg = 'Akses ditolak di luar jadwal operasional';
        await logAccess(user.id, uid, 'denied', room, msg, photoUrl);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg, face: null };
    }

    // 6. face check - hanya jika photo tersedia DAN user memiliki wajah terdaftar di ML
    let faceResult = null;

    let hasFaceEmbeddings = false;
    if (user) {
        try {
            const faceEmbeds = await db.select({ id: faceEmbeddings.id })
                .from(faceEmbeddings)
                .where(eq(faceEmbeddings.user_id, user.id))
                .limit(1);
            hasFaceEmbeddings = faceEmbeds.length > 0;
        } catch (err) {
            console.error('[accessService] Gagal memeriksa face embeddings:', err.message);
        }
    }

    if (photoBuffer && hasFaceEmbeddings) {
        // face inference: sync - perlu hasil untuk keputusan akses
        const photoFile = { buffer: photoBuffer, fieldname: 'photo', originalname: 'capture.jpg', mimetype: 'image/jpeg' };
        
        try {
            faceResult = await inferFace(photoFile);
        } catch(err) {
            console.error('[face inference] Error:', err.message);
            faceResult = null;
        }

        if (faceResult === null) {
            // ML service tidak bisa dihubungi - tolak akses karena face check wajib jika photo ada
            const msg = 'Face verification gagal - ML service tidak tersedia';
            await logAccess(user.id, uid, 'denied', room, msg, photoUrl);
            await sendNotification(user, room, 'denied', msg);
            return { status: 'denied', message: msg, face: null };
        }

        if (!faceResult.matched) {
            // wajah tidak dikenali
            const msg = `Wajah tidak dikenali (similarity: ${faceResult.similarity?.toFixed(2) ?? 'N/A'} < ${FACE_MATCH_THRESHOLD})`;
            await logAccess(user.id, uid, 'denied', room, msg, photoUrl);
            await sendNotification(user, room, 'denied', msg);
            return { status: 'denied', message: msg, face: faceResult };
        }
    }

    // 7. semua check pass - akses diizinkan
    const msg = (photoBuffer && hasFaceEmbeddings)
        ? `Akses berhasil - RFID dan wajah terverifikasi (${faceResult?.person_name ?? 'unknown'})`
        : 'Akses berhasil diberikan (tanpa verifikasi wajah)';

    await logAccess(user.id, uid, 'allowed', room, msg, photoUrl);
    await sendNotification(user, room, 'allowed', msg);
    return { status: 'allowed', message: msg, face: faceResult };
};
