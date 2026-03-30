import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { JWT_SECRET } from "../../config/env.js";
import { db } from "../database/sql.js";
import { eq } from "drizzle-orm";
import { users } from "../database/schema.js";

export const loginUser = async (username, password) => {
    try {
        const result = await db.select().from(users).where(eq(users.username, username))
        const user = result[0]

        if(!user) {
            const error = new Error("Invalid username or password");
            error.status = 401;
            throw error;
        }

        if(user.role !== "admin") {
            const error = new Error("Access denied: Insufficient privileges");
            error.status = 403;
            throw error;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if(!isPasswordValid) {
            const error = new Error("Invalid username or password");
            error.status = 401;
            throw error;
        }

        const token = jwt.sign({
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name
        }, JWT_SECRET, { expiresIn: "1h" });

        return token;

    } catch (err) {
        throw err;
    }
}