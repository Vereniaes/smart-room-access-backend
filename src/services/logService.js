import { eq, desc } from 'drizzle-orm';
import { db } from '../database/sql.js';
import { accessLogs } from '../database/schema.js';

export const getAllLogs = async () => {
    try {
        return await db.select().from(accessLogs).orderBy(desc(accessLogs.access_time));
    } catch (error) {
        console.error("Failed to get all logs", error);
        throw error;
    }
}
