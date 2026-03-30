import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../config/env.js";
import { sendError } from "../utils/response.js";

export const verifyJwt = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendError(res, 401, "Unauthorized: No token provided or invalid format");
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;

        next();
    } catch (error) {
        return sendError(res, 403, "Unauthorized: Invalid token or expired token");
    }
};