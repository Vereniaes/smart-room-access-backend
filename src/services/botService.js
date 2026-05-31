import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_GROUP_ID } from '../../config/env.js';
import { getIO } from '../utils/socketServer.js';
import { getAllLogs } from './logService.js';
import { getDashboardStats } from './dashboardService.js';
import { getDataAllUsers, updateDataUser } from './userService.js';

let bot = null;

if (TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
} else {
    console.warn("TELEGRAM_BOT_TOKEN is not defined in environment variables. Telegram notifications will be disabled.");
}

export const sendNotification = async (user, room, status, accessTypeMessage = "") => {
    if (!bot || !TELEGRAM_GROUP_ID) {
        console.log("Mock Telegram Notification:", { user, room, status, accessTypeMessage });
        return;
    }

    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const isDenied = status !== "allowed";

    const message = `
*Access Notification*
👤 User: ${user ? user.name : 'Unknown User'}
🚪 Room: ${room}
ℹ️ Status: ${isDenied ? `Access Denied ❌\nReason: ${accessTypeMessage}` : "Access Granted ✅"}
🕒 Time: ${time}
    `.trim();

    const options = { parse_mode: 'Markdown' };

    if (isDenied) {
        options.reply_markup = {
            inline_keyboard: [
                [
                    { text: '🔓 Allow Once', callback_data: `open_${room}` },
                    { text: '🚫 Ignore', callback_data: 'ignore' }
                ]
            ]
        };
    }

    try {
        await bot.sendMessage(TELEGRAM_GROUP_ID, message, options);
    } catch (error) {
        console.error("Failed to send telegram notification", error);
    }
};

if (bot) {
    // Basic Commands
    bot.onText(/\/(start|help)/, (msg) => {
        const chatId = msg.chat.id;
        const helpMessage = `
🤖 *Smart Room Access Bot*
Here are the available commands:

*Remote Control:*
/open [room] - Open a specific room
/lock [room] - Lock a specific room
/status [room] - Check room status

*User Management:*
/check [name or id] - Check user info and status
/block [id] - Block a user's access instantly
/unblock [id] - Unblock a user

*Reports & Logs:*
/today - Get today's access statistics
/logs - View the last 5 access logs
/alerts - View denied access alerts (last 24h)

*Settings:*
/help - Show this message
        `.trim();
        bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // Remote Control Commands
    bot.onText(/\/(open|lock|status)(?: (.+))?/, (msg, match) => {
        const chatId = msg.chat.id;
        const command = match[1];
        const room = match[2];

        if (!room) {
            return bot.sendMessage(chatId, `Please specify a room. Example: /${command} server_room`);
        }

        const io = getIO();
        if (io) {
            io.emit('door_command', { action: command, room });
            if (command === 'status') {
                bot.sendMessage(chatId, `⏳ Requesting status for room: *${room}*...`, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, `✅ Command '${command}' sent to room: *${room}*`, { parse_mode: 'Markdown' });
            }
        } else {
            bot.sendMessage(chatId, `❌ Failed to send command. Hardware interface (Socket) is not connected.`);
        }
    });

    // User Management
    bot.onText(/\/check (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const query = match[1].toLowerCase();

        try {
            const users = await getDataAllUsers();
            const foundUser = users.find(u => u.id.toString() === query || u.name.toLowerCase().includes(query));

            if (!foundUser) {
                return bot.sendMessage(chatId, `❌ User not found matching: ${query}`);
            }

            const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
            const today = nowWIB.toISOString().split('T')[0];
            const isExpired = foundUser.valid_until && today > foundUser.valid_until;
            const isBlocked = foundUser.valid_until === "1970-01-01"; // Our convention for blocked users

            let statusText = "Active ✅";
            if (isBlocked) statusText = "Blocked ⛔";
            else if (isExpired) statusText = "Expired ⚠️";

            const message = `
🔍 *User Info*
*ID:* ${foundUser.id}
*Name:* ${foundUser.name}
*Role:* ${foundUser.role}
*Schedule:* ${foundUser.schedule_start} - ${foundUser.schedule_end}
*Valid Until:* ${foundUser.valid_until || "Unlimited"}
*Status:* ${statusText}
            `.trim();

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            bot.sendMessage(chatId, "❌ Failed to check user.");
        }
    });

    bot.onText(/\/(block|unblock) (\d+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const action = match[1];
        const userId = match[2];

        try {
            // "1970-01-01" will automatically fail the valid_until check in accessService
            const validUntil = action === 'block' ? "1970-01-01" : null;

            const updatedUser = await updateDataUser(userId, { valid_until: validUntil });
            if (!updatedUser) {
                return bot.sendMessage(chatId, `❌ User with ID ${userId} not found.`);
            }

            const msgText = action === 'block'
                ? `⛔ User *${updatedUser.name}* (ID: ${updatedUser.id}) has been *BLOCKED*.`
                : `✅ User *${updatedUser.name}* (ID: ${updatedUser.id}) has been *UNBLOCKED*.`;

            bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error("Failed to update user", error);
            bot.sendMessage(chatId, `❌ Failed to ${action} user.`);
        }
    });

    // Report Commands
    bot.onText(/\/today/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            const stats = await getDashboardStats('today');
            const summary = stats.summary;
            const message = `
📊 *Today's Access Stats*
Total Scans: ${summary.total_scans}
✅ Allowed: ${summary.total_allowed}
❌ Denied: ${summary.total_denied}
            `.trim();
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (err) {
            bot.sendMessage(chatId, "❌ Failed to retrieve stats.");
        }
    });

    bot.onText(/\/logs/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            const logsData = await getAllLogs(1, 5); // Assuming getAllLogs(page, limit)
            if (!logsData.logs || logsData.logs.length === 0) {
                return bot.sendMessage(chatId, "No recent logs found.");
            }

            let message = `📋 *Last 5 Access Logs*\n\n`;
            logsData.logs.forEach(log => {
                const time = new Date(log.access_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const icon = log.status === 'allowed' ? '✅' : '❌';
                message += `${icon} *${log.name || log.user_name || 'Unknown'}* -> ${log.room} at ${time}\n`;
            });

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (err) {
            bot.sendMessage(chatId, "❌ Failed to retrieve logs.");
        }
    });

    bot.onText(/\/alerts/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            // Fetch more logs to filter for denied ones
            const logsData = await getAllLogs(1, 50);
            if (!logsData.logs || logsData.logs.length === 0) {
                return bot.sendMessage(chatId, "No recent logs found.");
            }

            // Filter for denied status in the last 24h
            const now = new Date();
            const alerts = logsData.logs.filter(log => {
                const logTime = new Date(log.access_time);
                const isWithin24h = (now - logTime) < 24 * 60 * 60 * 1000;
                return log.status === 'denied' && isWithin24h;
            }).slice(0, 10); // Show up to 10 alerts

            if (alerts.length === 0) {
                return bot.sendMessage(chatId, "✅ No denied access alerts in the last 24 hours.");
            }

            let message = `⚠️ *Recent Access Alerts (24h)*\n\n`;
            alerts.forEach(log => {
                const time = new Date(log.access_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                message += `❌ *${log.name || log.user_name || 'Unknown'}* -> ${log.room} at ${time}\n`;
            });

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (err) {
            bot.sendMessage(chatId, "❌ Failed to retrieve alerts.");
        }
    });

    // Callback Query for Interactive Buttons
    bot.on('callback_query', (query) => {
        const data = query.data;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        if (data.startsWith('open_')) {
            const room = data.replace('open_', '');
            const io = getIO();
            if (io) {
                io.emit('door_command', { action: 'open', room });
                bot.answerCallbackQuery(query.id, { text: `Opened ${room} remotely!` });
                bot.sendMessage(chatId, `✅ *${query.from.first_name}* manually opened room: *${room}*`, { parse_mode: 'Markdown' });
            } else {
                bot.answerCallbackQuery(query.id, { text: 'Hardware disconnected.', show_alert: true });
            }
        } else if (data === 'ignore') {
            bot.answerCallbackQuery(query.id, { text: 'Alert ignored.' });
        }

        // Remove the inline keyboard after action is taken
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
    });
}

export default bot;