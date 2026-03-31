import { sendResponse, sendError } from "../utils/response.js";
import { loginUser, refreshToken, logoutUser } from "../services/authService.js";
import { NODE_ENV } from "../../config/env.js";

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const { accessToken, refreshToken: tokenForCookie, user } = await loginUser(username, password);

        // Simpan Refresh Token di Cookie (HttpOnly)
        res.cookie("refreshToken", tokenForCookie, {
            httpOnly: true,
            secure: NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Kirim Access Token di Body
        return sendResponse(res, 200, { accessToken, user }, "Login successfully");
    } catch (error) {
        if (error.status) {
            return sendError(res, error.status, error.message);
        }
        console.error("Login Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

export const handleRefreshToken = async (req, res) => {
    try {
        const tokenFromCookie = req.cookies.refreshToken;
        if (!tokenFromCookie) {
            return sendError(res, 401, "Refresh token missing");
        }

        const newAccessToken = await refreshToken(tokenFromCookie);
        
        return sendResponse(res, 200, { accessToken: newAccessToken }, "Token refreshed successfully");
    } catch (error) {
        if (error.status) {
            return sendError(res, error.status, error.message);
        }
        return sendError(res, 500, "Internal server error");
    }
};

export const logout = async (req, res) => {
    try {
        // req.user biasanya diisi oleh middleware verifyJwt
        const userId = req.user?.id;
        
        if (userId) {
            await logoutUser(userId);
        }

        const { iat, exp, ...userData} = req.user

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
        });
        return sendResponse(res, 200, {user: userData}, "Logout successfully");
    } catch (error) {
        return sendError(res, 500, "Logout failed");
    }
};