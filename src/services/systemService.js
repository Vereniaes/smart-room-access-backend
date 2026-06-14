/**
 * src/services/systemService.js
 * 
 * -> handling business logic untuk system & server health check
 *      -> cek konektivitas database Postgres
 *      -> cek konektivitas ML microservice Python
 *      -> baca metrik sistem (uptime, memory usage, node version)
 *      -> cek list device IoT terhubung berdasarkan log akses terakhir
 * -> disini buat orkestrasi skema, pemanggilan endpoint eksternal, dan pembacaan resource OS
 */

import { sql } from 'drizzle-orm';
import axios from 'axios';
import { db } from '../database/sql.js';
import { ML_SERVICE_URL } from '../../config/env.js';

// helper --------------------------------------------------------------------------

// function buat cek status koneksi database
// input param : none
// output      : boolean (true jika terhubung, false jika error)
export const checkDatabaseHealth = async () => {
    try {
        await db.execute(sql`SELECT 1`);
        return true;
    } catch (error) {
        console.error("[HealthCheck] Database connection error:", error.message);
        return false;
    }
};

// function buat cek status koneksi ML service
// input param : none
// output      : boolean (true jika terhubung & status ok, false jika error)
export const checkMlServiceHealth = async () => {
    const mlBase = ML_SERVICE_URL || 'http://localhost:8001';
    try {
        const res = await axios.get(`${mlBase}/health`, { timeout: 3000 });
        return res.data && res.data.status === "ok";
    } catch (error) {
        console.error("[HealthCheck] ML Service error:", error.message);
        return false;
    }
};

// function buat ambil metrik performa & status server Node.js
// input param : none
// output      : object { uptime, memoryUsage, nodeVersion, platform }
export const getSystemMetrics = () => {
    const uptime = process.uptime(); // dalam detik
    const memory = process.memoryUsage();
    return {
        uptime: Math.round(uptime),
        memoryUsage: {
            rss: Math.round(memory.rss / (1024 * 1024)), // MB
            heapTotal: Math.round(memory.heapTotal / (1024 * 1024)), // MB
            heapUsed: Math.round(memory.heapUsed / (1024 * 1024)), // MB
        },
        nodeVersion: process.version,
        platform: process.platform,
    };
};

// function buat ambil daftar device IoT dari log akses terakhir
// input param : none
// output      : array of objects [ { room, lastSeen, totalTaps, status } ]
export const getConnectedDevices = async () => {
    try {
        const results = await db.execute(sql`
            SELECT 
                room, 
                MAX(access_time) AS last_seen,
                COUNT(*) AS total_taps
            FROM access_logs
            GROUP BY room
            ORDER BY last_seen DESC
        `);
        
        const now = new Date();
        return results.rows.map(row => {
            const lastSeenDate = new Date(row.last_seen);
            const diffMs = now.getTime() - lastSeenDate.getTime();
            const diffMinutes = diffMs / (1000 * 60);
            
            // Anggap device "Aktif" jika log terkirim dalam 15 menit terakhir
            // jika lebih dari 15 menit dianggap "Standby"
            let status = "Standby";
            if (diffMinutes <= 15) {
                status = "Aktif";
            }
            
            return {
                room: row.room,
                lastSeen: row.last_seen,
                totalTaps: parseInt(row.total_taps),
                status
            };
        });
    } catch (error) {
        console.error("[getConnectedDevices] Error fetching device logs:", error.message);
        return [];
    }
};

// end of helper ------------------------------------------------------------------
