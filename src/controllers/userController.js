import { sendResponse, sendError } from '../utils/response.js';
import { getDataAllUsers, getDataUserById, getDataUserByUid, createDataUser, updateDataUser, deleteDataUser } from '../services/userService.js';

export const getAllUsers = async (req, res) => {
    try {
        const usersData = await getDataAllUsers();
        return sendResponse(res, 200, { users: usersData }, "Users retrieved successfully");
    } catch (error) {
        return sendError(res, 500, "Internal server error");
    }
};

export const getUserById = async (req, res) => {
    try {
        const userData = await getDataUserById(req.params.id);
        if (!userData) {
            return sendError(res, 404, "User not found");
        }
        return sendResponse(res, 200, { user: userData }, "User retrieved successfully");
    } catch (error) {
        return sendError(res, 500, "Internal server error");
    }
};

export const getUserByUid = async (req, res) => {
    try {
        const userData = await getDataUserByUid(req.params.uid);
        if (!userData) {
            return sendError(res, 404, "User not found");
        }
        return sendResponse(res, 200, { user: userData }, "User retrieved successfully");
    } catch (error) {
        return sendError(res, 500, "Internal server error");
    }
};

export const createUser = async (req, res) => {
    try {
        const newUserData = await createDataUser(req.body);
        return sendResponse(res, 201, { user: newUserData }, "User created successfully");
    } catch (error) {
        if (error.code === "DUPLICATE_UID") {
            return sendError(res, 409, "RFID UID is already registered to another user");
        }
        return sendError(res, 500, "Internal server error");
    }
};

export const updateUser = async (req, res) => {
    try {
        const updatedUserData = await updateDataUser(req.params.id, req.body);
        if (!updatedUserData) {
            return sendError(res, 404, "User not found");
        }
        return sendResponse(res, 200, { user: updatedUserData }, "User updated successfully");
    } catch (error) {
        return sendError(res, 500, "Internal server error");
    }
};

export const deleteUser = async (req, res) => {
    try {
        const deletedUserData = await deleteDataUser(req.params.id);
        if (!deletedUserData) {
            return sendError(res, 404, "User not found");
        }
        return sendResponse(res, 200, { user: deletedUserData }, "User deleted successfully");
    } catch (error) {
        return sendError(res, 500, "Internal server error");
    }
};
