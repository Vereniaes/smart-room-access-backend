// src/services/userService.js
//
// -> handling data user dari database
//    -> getDataAllUsers    : ambil semua user
//    -> getDataUserById    : ambil user by primary key
//    -> getDataUserByRfid  : ambil user by RFID UID (pakai HMAC hash, O(1) dengan index)
//    -> createDataUser     : buat user baru, hash RFID pakai HMAC-SHA256
//    -> updateDataUser     : update user, re-hash RFID kalau berubah
//    -> deleteDataUser     : hapus user
// -> rfid_uid disimpan sebagai HMAC-SHA256 hex (bukan bcrypt)
//    -> deterministic -> bisa WHERE rfid_uid = ? -> bisa di-index -> O(1)

import { db as drizzleDb } from '../database/sql.js';
import { eq }              from 'drizzle-orm';
import { users }           from '../database/schema.js';
import bcrypt              from 'bcryptjs';
import { hashRfidUid }     from '../utils/rfidHash.js';

const SALT_ROUNDS = 10;

// helper ---------------------------------------------------------------------------------

// fungsi ambil semua user dari DB
// output : array of user objects
export const getDataAllUsers = async () => {
    try {
        return await drizzleDb.select().from(users).orderBy(users.id);
    } catch (error) {
        console.error('Failed to get all users', error);
        throw error;
    }
};

// fungsi ambil user berdasarkan ID
// input param : id -> integer primary key
// output : user object atau null
export const getDataUserById = async (id) => {
    try {
        const result = await drizzleDb.select().from(users).where(eq(users.id, parseInt(id)));
        return result[0] || null;
    } catch (error) {
        console.error('Failed to get user by id', error);
        throw error;
    }
};

// fungsi ambil user berdasarkan RFID UID plaintext
// input param : uid -> string raw RFID UID (plaintext, akan di-hash dulu)
// output : user object atau null
// note   : pakai HMAC hash -> single query O(1), tidak perlu loop
export const getDataUserByRfid = async (uid) => {
    try {
        const hashed = hashRfidUid(uid);
        const result = await drizzleDb.select().from(users).where(eq(users.rfid_uid, hashed));
        return result[0] || null;
    } catch (error) {
        console.error('Failed to get user by rfid', error);
        throw error;
    }
};

// fungsi ambil user berdasarkan hash rfid_uid yang sudah ada (untuk dashboard)
// input param : uid -> string bisa berupa value dari param URL
// output : user object atau null
export const getDataUserByUid = async (uid) => {
    try {
        const result = await drizzleDb.select().from(users).where(eq(users.rfid_uid, uid));
        return result[0] || null;
    } catch (error) {
        console.error('Failed to get user by uid', error);
        throw error;
    }
};

// end of helper --------------------------------------------------------------------------


// fungsi buat user baru
// input param : userData -> { name, rfid_uid (plaintext), role, schedule_start, schedule_end, valid_until }
// output : user object yang baru dibuat
// error  : DUPLICATE_UID jika rfid_uid sudah terdaftar (ditangkap dari DB unique constraint)
export const createDataUser = async (userData) => {
    try {
        // hash RFID pakai HMAC-SHA256 (deterministic, bisa di-index)
        const hashedUid = hashRfidUid(userData.rfid_uid);

        const result = await drizzleDb.insert(users).values({
            name:           userData.name,
            rfid_uid:       hashedUid,
            role:           userData.role,
            schedule_start: userData.schedule_start,
            schedule_end:   userData.schedule_end,
            valid_until:    userData.valid_until || null,
        }).returning();

        return result[0];
    } catch (error) {
        // DB unique constraint violation -> UID sudah terdaftar
        if (error.code === '23505') {
            const dupError = new Error('UID_ALREADY_EXISTS');
            dupError.code  = 'DUPLICATE_UID';
            throw dupError;
        }
        if (error.code !== 'DUPLICATE_UID') {
            console.error('Failed to create user', error);
        }
        throw error;
    }
};


// fungsi update user
// input param : id -> integer
//               updateData -> field yang ingin diupdate
// output : user object yang sudah diupdate atau null
export const updateDataUser = async (id, updateData) => {
    try {
        const payload = { ...updateData, updated_at: new Date() };

        // re-hash RFID kalau ada perubahan UID
        if (payload.rfid_uid) {
            payload.rfid_uid = hashRfidUid(payload.rfid_uid);
        }

        const result = await drizzleDb.update(users)
            .set(payload)
            .where(eq(users.id, parseInt(id)))
            .returning();

        return result[0] || null;
    } catch (error) {
        console.error('Failed to update user', error);
        throw error;
    }
};


// fungsi hapus user
// input param : id -> integer
// output : user object yang dihapus atau null
export const deleteDataUser = async (id) => {
    try {
        const result = await drizzleDb.delete(users)
            .where(eq(users.id, parseInt(id)))
            .returning();
        return result[0] || null;
    } catch (error) {
        console.error('Failed to delete user', error);
        throw error;
    }
};