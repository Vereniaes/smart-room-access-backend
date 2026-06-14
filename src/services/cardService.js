// src/services/cardService.js
// -> handling business logic cards
//      -> get all cards
//      -> create card
//      -> update card
//      -> delete card
// -> disini buat orkestrasi skema, repo, sama security

import { db } from '../database/sql.js';
import { eq, sql } from 'drizzle-orm';
import { cards, users } from '../database/schema.js';
import { hashRfidUid } from '../utils/rfidHash.js';

// helper --------------------------------------------------------------------------

// function untuk mengambil semua kartu terdaftar beserta status penggunanya
// input param : none
// output : array of card objects (id, rfid_uid, valid_until, created_at, user_id, user_name, user_role)
export const getDataAllCards = async () => {
    try {
        const result = await db.select({
            id: cards.id,
            rfid_uid: cards.rfid_uid,
            card_no: cards.card_no,
            valid_until: cards.valid_until,
            created_at: cards.created_at,
            user_id: users.id,
            user_name: users.name,
            user_role: users.role
        })
        .from(cards)
        .leftJoin(users, eq(cards.rfid_uid, users.rfid_uid))
        .orderBy(cards.id);

        return result;
    } catch (error) {
        console.error('Failed to get all cards', error);
        throw error;
    }
};

// function untuk mendapatkan detail kartu berdasarkan ID
// input param : id -> integer
// output : card object atau null
export const getDataCardById = async (id) => {
    try {
        const result = await db.select().from(cards).where(eq(cards.id, parseInt(id)));
        return result[0] || null;
    } catch (error) {
        console.error('Failed to get card by id', error);
        throw error;
    }
};

// function untuk mendapatkan detail kartu berdasarkan RFID UID plaintext
// input param : uid -> string raw RFID UID
// output : card object atau null
export const getDataCardByRfid = async (uid) => {
    try {
        const hashed = hashRfidUid(uid);
        const result = await db.select().from(cards).where(eq(cards.rfid_uid, hashed));
        return result[0] || null;
    } catch (error) {
        console.error('Failed to get card by rfid', error);
        throw error;
    }
};

// function untuk mendaftarkan kartu baru
// input param : cardData -> { rfid_uid (plaintext), valid_until }
// output : card object yang baru dibuat
export const createDataCard = async (cardData) => {
    try {
        const hashedUid = hashRfidUid(cardData.rfid_uid);

        const result = await db.insert(cards).values({
            rfid_uid: hashedUid,
            card_no: cardData.rfid_uid.trim().toUpperCase(),
            valid_until: cardData.valid_until || null,
        }).returning();

        return result[0];
    } catch (error) {
        if (error.code === '23505') {
            const dupError = new Error('RFID_UID_ALREADY_EXISTS');
            dupError.code = 'DUPLICATE_RFID_UID';
            throw dupError;
        }
        console.error('Failed to create card', error);
        throw error;
    }
};

// function untuk memperbarui status/validity kartu
// input param : id -> integer, updateData -> { valid_until }
// output : card object yang diupdate atau null
export const updateDataCard = async (id, updateData) => {
    try {
        const result = await db.update(cards)
            .set(updateData)
            .where(eq(cards.id, parseInt(id)))
            .returning();
        return result[0] || null;
    } catch (error) {
        console.error('Failed to update card', error);
        throw error;
    }
};

// function untuk menghapus kartu dari database
// input param : id -> integer
// output : card object yang dihapus atau null
export const deleteDataCard = async (id) => {
    try {
        // Ambil info kartu terlebih dahulu untuk un-link user terkait jika ada
        const cardObj = await getDataCardById(id);
        if (cardObj) {
            // Un-link users yang memegang rfid_uid ini
            await db.update(users)
                .set({ rfid_uid: null, updated_at: new Date() })
                .where(eq(users.rfid_uid, cardObj.rfid_uid));
        }

        const result = await db.delete(cards)
            .where(eq(cards.id, parseInt(id)))
            .returning();
        return result[0] || null;
    } catch (error) {
        console.error('Failed to delete card', error);
        throw error;
    }
};

// end of helper ------------------------------------------------------------------
