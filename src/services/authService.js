import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { JWT_SECRET, REFRESH_TOKEN_SECRET } from "../../config/env.js";
import { db } from "../database/sql.js";
import { eq } from "drizzle-orm";
import { users } from "../database/schema.js";

export const loginUser = async (username, password) => {
    try {
        const result = await db.select().from(users).where(eq(users.username, username))
        const user = result[0]

        // 1. Cek User Exist dulu
        if (!user) {
            const error = new Error("Invalid username or password");
            error.status = 401;
            throw error;
        }

        // 2. Cek Password
        const isPasswordValid = await bcrypt.compare(password, user.password)
        if (!isPasswordValid) {
            const error = new Error("Invalid username or password");
            error.status = 401;
            throw error;
        }
        
        // 3. Cek Role (Dashboard hanya untuk admin/staff)
        if (user.role !== "admin" && user.role !== "staff") {
            const error = new Error("Access denied: Insufficient privileges");
            error.status = 403;
            throw error;
        }

        const userData = {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name
        }

        // Sign data langsung (tanpa dibungkus {userData}) agar konsisten
        const accessToken = jwt.sign(userData, JWT_SECRET, { expiresIn: "15m" })
        const refreshToken = jwt.sign(userData, REFRESH_TOKEN_SECRET, { expiresIn: "7d" })
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10)

        await db.update(users).set({ refresh_token: hashedRefreshToken, updated_at: new Date() }).where(eq(users.id, user.id))

        return {
            accessToken,
            refreshToken,
            user: userData
        }

    } catch (err) {
        throw err;
    }
}

export const logoutUser = async (userId) => {
    try {
        await db.update(users).set({refresh_token: null, updated_at: new Date()}).where(eq(users.id, userId))
        return true
    } catch (err) {
        err = new Error("Logout failed");
        err.status = 500;
        throw err
    }
}

export const refreshToken = async (tokenFromCookie) => {
    try {
        const decoded = jwt.verify(tokenFromCookie, REFRESH_TOKEN_SECRET)

        // Cari berdasarkan id yang ada di payload (bukan decoded.userData.id)
        const result = await db.select().from(users).where(eq(users.id, decoded.id))
        const user = result[0]

        if(!user || !user.refresh_token) {
            const error = new Error("Invalid session")
            error.status = 401
            throw error
        }

        const isMatch = await bcrypt.compare(tokenFromCookie, user.refresh_token)
        if(!isMatch) {
            const error = new Error("Invalid session")
            error.status = 401
            throw error
        }

        const userData = {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name
        }

        const newAccessToken = jwt.sign(userData, JWT_SECRET, {expiresIn: "15m"})
        
        return newAccessToken
    } catch (err) {
        if (err.status) throw err;
        
        const error = new Error("Unauthorized: refresh token invalid")
        error.status = 401
        throw error
    }
}