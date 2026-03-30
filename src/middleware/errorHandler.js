import { sendError } from '../utils/response.js';

export const errorHandler = (err, req, res, next) => {
    // console.error(err.stack);
    return sendError(res, err.status || 500, err.message || "Something went wrong!");
};
