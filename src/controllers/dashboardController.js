import { getDashboardStats } from '../services/dashboardService.js';
import { sendResponse } from '../utils/response.js';

export const getStats = async (req, res) => {
    try {
        const { range } = req.query;
        const stats = await getDashboardStats(range);
        return sendResponse(res, 200, stats, 'Dashboard statistics retrieved successfully');
    } catch (error) {
        return sendResponse(res, 500, 'Failed to retrieve dashboard statistics', { error: error.message });
    }
};
