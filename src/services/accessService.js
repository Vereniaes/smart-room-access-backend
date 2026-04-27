import { db } from '../database/sql.js';
import { accessLogs } from '../database/schema.js';
import { sendNotification } from './notificationService.js';
import { getDataAllUsers } from './userService.js';
import { uploadToGcs } from '../utils/gcsUpload.js';
import bcrypt from 'bcryptjs';

/**
 * Validate RFID access and log the attempt with optional photo
 * @param {string} uid - Raw RFID UID from ESP32
 * @param {string} room - Room name
 * @param {Buffer|null} photoBuffer - JPEG photo buffer from ESP32 (optional)
 */
export const validateAccess = async (uid, room, photoBuffer = null) => {
    // 1. Cek User Terdaftar (Menggunakan Bcrypt)
    const allUsers = await getDataAllUsers();
    let user = null;

    for (const u of allUsers) {
        const isMatch = await bcrypt.compare(uid, u.rfid_uid);
        if (isMatch) {
            user = u;
            break;
        }
    }

    // Upload foto ke GCS (async, tidak blokir validasi)
    let photoUrl = null;
    if (photoBuffer) {
        try {
            photoUrl = await uploadToGcs(photoBuffer, uid);
        } catch (err) {
            console.error('[GCS] Upload failed:', err.message);
            // Tidak gagalkan request jika GCS error
        }
    }

    if (!user) {
        const msg = 'RFID tidak terdaftar di sistem';
        await logAccess(null, uid, 'denied', room, msg, photoUrl);
        await sendNotification(null, room, 'denied', msg);
        return { status: 'denied', message: msg };
    }

    const today = new Date().toISOString().split('T')[0];

    // 2. Cek Masa Berlaku Kartu
    if (user.valid_until && today > user.valid_until) {
        const msg = 'Kartu RFID telah kadaluarsa';
        await logAccess(user.id, uid, 'denied', room, msg, photoUrl);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg };
    }

    // 3. Cek Jadwal Akses
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    if (currentTime < user.schedule_start || currentTime > user.schedule_end) {
        const msg = 'Akses ditolak di luar jadwal operasional';
        await logAccess(user.id, uid, 'denied', room, msg, photoUrl);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg };
    }

    // 4. Akses Diizinkan
    const msg = 'Akses berhasil diberikan';
    await logAccess(user.id, uid, 'allowed', room, msg, photoUrl);
    await sendNotification(user, room, 'allowed', msg);
    return { status: 'allowed', message: msg };
};

const logAccess = async (userId, uid, status, room, message, photoUrl = null) => {
    try {
        await db.insert(accessLogs).values({
            user_id: userId || null,
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
