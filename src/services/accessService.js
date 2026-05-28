import { db } from '../database/sql.js';
import { accessLogs } from '../database/schema.js';
import { sendNotification } from './notificationService.js';
import { getDataAllUsers } from './userService.js';
import { uploadToGcs } from '../utils/gcsUpload.js';
import bcrypt from 'bcryptjs';
import { emitAccessEvent } from '../utils/socketServer.js';

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

    // Gunakan waktu WIB (UTC+7) — Cloud Run berjalan di UTC
    const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const today = nowWIB.toISOString().split('T')[0];

    // 2. Cek Masa Berlaku Kartu
    if (user.valid_until && today > user.valid_until) {
        const msg = 'Kartu RFID telah kadaluarsa';
        await logAccess(user, uid, 'denied', room, msg, photoUrl);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg };
    }

    // 3. Cek Jadwal Akses (pakai WIB UTC+7)
    const currentTime = nowWIB.toISOString().slice(11, 16); // HH:MM in WIB

    if (currentTime < user.schedule_start || currentTime > user.schedule_end) {
        const msg = 'Akses ditolak di luar jadwal operasional';
        await logAccess(user, uid, 'denied', room, msg, photoUrl);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg };
    }

    // 4. Akses Diizinkan
    const msg = 'Akses berhasil diberikan';
    await logAccess(user, uid, 'allowed', room, msg, photoUrl);
    await sendNotification(user, room, 'allowed', msg);
    return { status: 'allowed', message: msg };
};

const logAccess = async (userOrId, uid, status, room, message, photoUrl = null) => {
    // Support both old (userId number) and new (user object) calling convention
    const userId = typeof userOrId === 'object' && userOrId !== null ? userOrId.id : (userOrId || null);
    const userName = typeof userOrId === 'object' && userOrId !== null ? userOrId.name : null;
    const userRole = typeof userOrId === 'object' && userOrId !== null ? userOrId.role : null;

    try {
        await db.insert(accessLogs).values({
            user_id: userId || null,
            uid,
            status,
            room,
            message,
            photo_url: photoUrl,
        });
        // Emit real-time event for monitoring clients
        const payload = {
            user_id: userId || null,
            user_name: userName,
            user_role: userRole,
            uid,
            status,
            room,
            message,
            photo_url: photoUrl,
            timestamp: new Date().toISOString(),
        }
        emitAccessEvent(payload)
    } catch (error) {
        console.error('Gagal menambahkan log akses:', error);
    }
};
