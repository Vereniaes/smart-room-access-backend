import { API_KEY } from "../../config/env.js";
import { sendError } from "../utils/response.js";

export const verifyApiKey = (req, res, next) => {
    const userApiKey = req.header('X-API-KEY');

    if (!userApiKey || userApiKey !== API_KEY) {
        return sendError(res, 401, "Unauthorized: Invalid or missing API Key");
    }

    next();
};