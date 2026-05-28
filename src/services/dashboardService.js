import { sql, eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../database/sql.js';
import { accessLogs, users } from '../database/schema.js';

export const getDashboardStats = async (range = 'today') => {
    try {
        const now = new Date();
        let startDate = new Date();
        let trendFormat = 'HH24'; // Default to hourly
        let trendLabelSuffix = ':00';

        if (range === 'week') {
            startDate.setDate(now.getDate() - 7);
            trendFormat = 'YYYY-MM-DD';
            trendLabelSuffix = '';
        } else if (range === 'month') {
            startDate.setMonth(now.getMonth() - 1);
            trendFormat = 'YYYY-MM-DD';
            trendLabelSuffix = '';
        } else if (range === 'year') {
            startDate.setFullYear(now.getFullYear() - 1);
            trendFormat = 'YYYY-MM';
            trendLabelSuffix = '';
        } else {
            // today
            startDate.setHours(0, 0, 0, 0);
        }

        // 1. Summary Stats (Filtered by range)
        const totalLogsRes = await db.select({ count: sql`count(*)` }).from(accessLogs)
            .where(gte(accessLogs.access_time, startDate));
        
        const allowedCountRes = await db.select({ count: sql`count(*)` }).from(accessLogs)
            .where(and(gte(accessLogs.access_time, startDate), eq(accessLogs.status, 'allowed')));
        
        const deniedCountRes = await db.select({ count: sql`count(*)` }).from(accessLogs)
            .where(and(gte(accessLogs.access_time, startDate), eq(accessLogs.status, 'denied')));
        
        const totalUsersRes = await db.select({ count: sql`count(*)` }).from(users);

        // 2. Access Trend - Dynamic based on range
        const trendData = await db.execute(sql`
            SELECT 
                TO_CHAR(access_time, ${trendFormat}) as label,
                count(*) as count,
                sum(case when status = 'allowed' then 1 else 0 end) as allowed,
                sum(case when status = 'denied' then 1 else 0 end) as denied
            FROM access_logs
            WHERE access_time >= ${startDate}
            GROUP BY label
            ORDER BY label ASC
        `);

        // 3. Most Active Rooms
        const roomStatsRes = await db.select({
            room: accessLogs.room,
            count: sql`count(*)`
        })
        .from(accessLogs)
        .where(gte(accessLogs.access_time, startDate))
        .groupBy(accessLogs.room)
        .orderBy(sql`count(*) DESC`)
        .limit(5);

        // 4. User Role Distribution
        const roleStatsRes = await db.select({
            role: users.role,
            count: sql`count(*)`
        })
        .from(users)
        .groupBy(users.role);

        return {
            summary: {
                total: parseInt(totalLogsRes[0]?.count || 0),
                allowed: parseInt(allowedCountRes[0]?.count || 0),
                denied: parseInt(deniedCountRes[0]?.count || 0),
                users: parseInt(totalUsersRes[0]?.count || 0),
            },
            trend: (trendData.rows || trendData).map(row => ({
                label: row.label + trendLabelSuffix,
                count: parseInt(row.count || 0),
                allowed: parseInt(row.allowed || 0),
                denied: parseInt(row.denied || 0)
            })),
            roomStats: roomStatsRes.map(row => ({
                room: row.room,
                count: parseInt(row.count || 0)
            })),
            roleStats: roleStatsRes.map(row => ({
                role: row.role,
                count: parseInt(row.count || 0)
            }))
        };
    } catch (error) {
        console.error("Dashboard Service Error:", error);
        throw error;
    }
};
