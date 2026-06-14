// src/services/logService.js
//
// -> handling query data log dari database
// -> disini buat orkestrasi skema log akses
//

import { eq, desc } from 'drizzle-orm';
import { db } from '../database/sql.js';
import { accessLogs, users } from '../database/schema.js';

// helper --------------------------------------------------------------------------

// tidak ada helper khusus untuk logService

// end of helper ------------------------------------------------------------------

// function buat ambil semua log akses dengan nama user
// input param : none
// output : array log object dengan field user_name
export const getAllLogs = async () => {
    try {
        return await db
            .select({
                id: accessLogs.id,
                user_id: accessLogs.user_id,
                uid: accessLogs.uid,
                access_time: accessLogs.access_time,
                status: accessLogs.status,
                room: accessLogs.room,
                message: accessLogs.message,
                photo_url: accessLogs.photo_url,
                user_name: users.name,
            })
            .from(accessLogs)
            .leftJoin(users, eq(accessLogs.user_id, users.id))
            .orderBy(desc(accessLogs.access_time));
    } catch (error) {
        console.error("Failed to get all logs", error);
        throw error;
    }
}

