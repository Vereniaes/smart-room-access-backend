import { sendResponse, sendError } from "../utils/response.js";
import { loginUser } from "../services/authService.js";

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const token = await loginUser(username, password);

        return sendResponse(res, 200, { token }, "Login successfully");
    } catch (error) {
        if (error.status) {
            return sendError(res, error.status, error.message);
        }
        
        console.error("Login Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};