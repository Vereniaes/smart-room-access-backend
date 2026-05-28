import { eq, desc } from 'drizzle-orm';
import { db } from '../database/sql.js';
import { accessLogs } from '../database/schema.js';

import { users } from '../database/schema.js';

export const getAllLogs = async () => {
    try {
        return await db.select({
            id: accessLogs.id,
            user_id: accessLogs.user_id,
            uid: accessLogs.uid,
            room: accessLogs.room,
            status: accessLogs.status,
            photo_url: accessLogs.photo_url,
            access_time: accessLogs.access_time,
            username: users.username,
            name: users.name
        })
        .from(accessLogs)
        .leftJoin(users, eq(accessLogs.user_id, users.id))
        .orderBy(desc(accessLogs.access_time));
    } catch (error) {
        console.error("Failed to get all logs", error);
        throw error;
    }
}
