import { db as drizzleDb } from '../database/sql.js';
import { eq } from 'drizzle-orm';
import { users } from '../database/schema.js';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const getDataAllUsers = async () => {
    try {
        return await drizzleDb.select().from(users).orderBy(users.id);
    } catch (error) {
        console.error("Failed to get all users", error);
        throw error;
    }
}

export const getDataUserById = async (id) => {
    try {
        const result = await drizzleDb.select().from(users).where(eq(users.id, parseInt(id)));
        return result[0] || null;
    } catch (error) {
        console.error("Failed to get user by id", error);
        throw error;
    }
}

export const getDataUserByUid = async (uid) => {
    try {
        // nama kolom di schema adalah rfid_uid, bukan uid
        const result = await drizzleDb.select().from(users).where(eq(users.rfid_uid, uid));
        return result[0] || null;
    } catch (error) {
        console.error("Failed to get user by uid", error);
        throw error;
    }
}

export const createDataUser = async (userData) => {
    try {
        // 1. Cek apakah UID (plaintext) sudah ada di DB
        const allUsers = await getDataAllUsers();
        for (const u of allUsers) {
            const isDuplicate = await bcrypt.compare(userData.rfid_uid, u.rfid_uid);
            if (isDuplicate) {
                const error = new Error("UID_ALREADY_EXISTS");
                error.code = "DUPLICATE_UID";
                throw error;
            }
        }

        // 2. Jika aman, enkripsi dan simpan
        const hashedUid = await bcrypt.hash(userData.rfid_uid, SALT_ROUNDS);

        const result = await drizzleDb.insert(users).values({
            name: userData.name,
            rfid_uid: hashedUid,
            role: userData.role,
            schedule_start: userData.schedule_start,
            schedule_end: userData.schedule_end,
            valid_until: userData.valid_until || null
        }).returning();
        return result[0];
    } catch (error) {
        if (error.code !== "DUPLICATE_UID") {
            console.error("Failed to create user", error);
        }
        throw error;
    }
}

export const updateDataUser = async (id, updateData) => {
    try {
        let hashedUid = updateData.rfid_uid;
        if (hashedUid) {
            hashedUid = await bcrypt.hash(hashedUid, SALT_ROUNDS);
        }

        const result = await drizzleDb.update(users)
            .set({
                ...updateData,
                ...(hashedUid && { rfid_uid: hashedUid }),
                updated_at: new Date()
            })
            .where(eq(users.id, parseInt(id)))
            .returning();
        return result[0] || null;
    } catch (error) {
        console.error("Failed to update user", error);
        throw error;
    }
}

export const deleteDataUser = async (id) => {
    try {
        const result = await drizzleDb.delete(users)
            .where(eq(users.id, parseInt(id)))
            .returning();
        return result.length > 0;
    } catch (error) {
        console.error("Failed to delete user", error);
        throw error;
    }
}