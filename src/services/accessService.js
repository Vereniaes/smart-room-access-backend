import { db } from '../database/sql.js';
import { accessLogs } from '../database/schema.js';
import { sendNotification } from './notificationService.js';
import { getDataAllUsers } from './userService.js';
import bcrypt from 'bcryptjs';

export const validateAccess = async (uid, room) => {
    // 1. Cek User Terdaftar (Menggunakan Bcrypt)
    const allUsers = await getDataAllUsers();
    let user = null;

    // Cari user yang hash UIDs-nya cocok dengan UID asli yang masuk
    for (const u of allUsers) {
        const isMatch = await bcrypt.compare(uid, u.rfid_uid);
        if (isMatch) {
            user = u;
            break;
        }
    }

    if (!user) {
        const msg = 'RFID tidak terdaftar di sistem';
        await logAccess(null, uid, 'denied', room, msg);
        await sendNotification(null, room, 'denied', msg);
        return { status: 'denied', message: msg };
    }

    const today = new Date().toISOString().split('T')[0]

    // 2. Cek Masa Berlaku Kartu (Kadaluarsa)
    if (user.valid_until && today > user.valid_until) {
        const msg = 'Kartu RFID telah kadaluarsa';
        await logAccess(user.id, uid, 'denied', room, msg);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg };
    }

    // 3. Cek Jadwal Akses Ruangan
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // Format "HH:MM"

    if (currentTime < user.schedule_start || currentTime > user.schedule_end) {
        const msg = 'Akses ditolak di luar jadwal operasional';
        await logAccess(user.id, uid, 'denied', room, msg);
        await sendNotification(user, room, 'denied', msg);
        return { status: 'denied', message: msg };
    }

    // 4. Jika semua lolos, Akses Diizinkan!
    const msg = 'Akses berhasil diberikan';
    await logAccess(user.id, uid, 'allowed', room, msg);
    await sendNotification(user, room, 'allowed', msg);
    return { status: 'allowed', message: msg };
};

// Fungsi internal untuk mecetak log kini wajib menerima param 'message'
const logAccess = async (userId, uid, status, room, message) => {
    try {
        await db.insert(accessLogs).values({
            user_id: userId || null,
            uid: uid,
            status: status,
            room: room,
            message: message
        });
    } catch (error) {
        console.error("Gagal menambahkan log akses:", error);
    }
};
