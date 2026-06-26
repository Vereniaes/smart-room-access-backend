// src/services/botService.js
//
// -> handling semua fungsi Telegram bot
//    -> sendNotification   : kirim notif akses ke grup (allowed/denied + inline keyboard)
//    -> sendTestNotification : test koneksi bot
//    -> bot polling commands : 2-way communication (open, lock, status, check, block, unblock, today, logs, alerts)
// -> polling mode aktif agar bot bisa terima perintah dari admin
// -> disini orkestrasi bot, socketServer, logService, userService

import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_ID } from '../../config/env.js';
import { getIO } from '../utils/socketServer.js';
import { getAllLogs } from './logService.js';
import { getDataAllUsers, updateDataUser } from './userService.js';

let bot = null;

if (TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
} else {
    console.warn('TELEGRAM_BOT_TOKEN tidak dikonfigurasi. Bot Telegram dinonaktifkan.');
}

// helper --------------------------------------------------------------------------

// fungsi format pesan akses (allowed/denied)
// input param : user - object user atau null
//               room - string nama ruangan
//               status - 'allowed' atau 'denied'
//               accessTypeMessage - string alasan (untuk denied)
//               time - string waktu WIB
// output : string pesan markdown
const formatAccessMessage = (user, room, status, accessTypeMessage, time) => {
    const isDenied = status !== 'allowed';
    return `
*Access Notification*
👤 User: ${user ? user.name : 'Unknown User'}
🚪 Room: ${room}
ℹ️ Status: ${isDenied ? `Access Denied ❌\nReason: ${accessTypeMessage}` : 'Access Granted ✅'}
🕒 Time: ${time}
    `.trim();
};

// end of helper ------------------------------------------------------------------


// fungsi kirim notifikasi akses ke grup Telegram
// input param : user - object user atau null
//               room - string nama ruangan
//               status - 'allowed' atau 'denied'
//               accessTypeMessage - string alasan (untuk denied)
// output : void
export const sendNotification = async (user, room, status, accessTypeMessage = '') => {
    if (!bot || !TELEGRAM_GROUP_ID) {
        console.log('Mock Telegram Notification:', { user, room, status, accessTypeMessage });
        return;
    }

    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const message = formatAccessMessage(user, room, status, accessTypeMessage, time);
    const isDenied = status !== 'allowed';

    const options = { parse_mode: 'Markdown' };

    // tambah inline keyboard untuk denied - admin bisa allow sekali atau ignore
    if (isDenied) {
        options.reply_markup = {
            inline_keyboard: [
                [
                    { text: '🔓 Allow Once', callback_data: `open_${room}` },
                    { text: '🚫 Ignore', callback_data: 'ignore' },
                ],
            ],
        };
    }

    try {
        await bot.sendMessage(TELEGRAM_GROUP_ID, message, options);
    } catch (error) {
        console.error('Failed to send telegram notification', error);
    }
};


// fungsi test koneksi bot - dipanggil dari systemController
// input param : none
// output : void (throw error jika bot tidak aktif)
export const sendTestNotification = async () => {
    if (!bot || !TELEGRAM_GROUP_ID) {
        throw new Error('Telegram bot belum aktif atau TELEGRAM_GROUP_ID tidak dikonfigurasi.');
    }
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const message = `🔔 *Smart Room Access - Test Connection*\n\nKoneksi bot Telegram Anda ke server dashboard berhasil terjalin!\nWaktu Uji: ${time} WIB`;
    await bot.sendMessage(TELEGRAM_GROUP_ID, message, { parse_mode: 'Markdown' });
};


// bot 2-way commands - hanya aktif jika bot ada
if (bot) {
    // /start atau /help
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

    // /open [room] | /lock [room] | /status [room]
    bot.onText(/\/(open|lock|status)(?: (.+))?/, (msg, match) => {
        const chatId = msg.chat.id;
        const command = match[1];
        const room = match[2];

        if (!room) {
            return bot.sendMessage(chatId, `Harap tentukan ruangan. Contoh: /${command} server_room`);
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
            bot.sendMessage(chatId, '❌ Failed to send command. Hardware interface (Socket) is not connected.');
        }
    });

    // /check [name atau id]
    bot.onText(/\/check (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const query = match[1].toLowerCase();

        try {
            const allUsers = await getDataAllUsers();
            const foundUser = allUsers.find(
                (u) => u.id.toString() === query || u.name.toLowerCase().includes(query)
            );

            if (!foundUser) {
                return bot.sendMessage(chatId, `❌ User tidak ditemukan: ${query}`);
            }

            const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
            const today = nowWIB.toISOString().split('T')[0];
            const isBlocked = foundUser.valid_until === '1970-01-01';
            const isExpired = foundUser.valid_until && today > foundUser.valid_until;

            let statusText = 'Active ✅';
            if (isBlocked) statusText = 'Blocked ⛔';
            else if (isExpired) statusText = 'Expired ⚠️';

            const message = `
🔍 *User Info*
*ID:* ${foundUser.id}
*Name:* ${foundUser.name}
*Role:* ${foundUser.role}
*Schedule:* ${foundUser.schedule_start} - ${foundUser.schedule_end}
*Valid Until:* ${foundUser.valid_until || 'Unlimited'}
*Status:* ${statusText}
            `.trim();

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            bot.sendMessage(chatId, '❌ Failed to check user.');
        }
    });

    // /block [id] | /unblock [id]
    bot.onText(/\/(block|unblock) (\d+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const action = match[1];
        const userId = match[2];

        try {
            // valid_until = '1970-01-01' -> blocked, null -> unblocked
            const validUntil = action === 'block' ? '1970-01-01' : null;

            const updatedUser = await updateDataUser(userId, { valid_until: validUntil });
            if (!updatedUser) {
                return bot.sendMessage(chatId, `❌ User dengan ID ${userId} tidak ditemukan.`);
            }

            const msgText = action === 'block'
                ? `⛔ User *${updatedUser.name}* (ID: ${updatedUser.id}) telah di-*BLOCK*.`
                : `✅ User *${updatedUser.name}* (ID: ${updatedUser.id}) telah di-*UNBLOCK*.`;

            bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Failed to update user via bot', error);
            bot.sendMessage(chatId, `❌ Gagal ${action} user.`);
        }
    });

    // /today - statistik akses hari ini
    bot.onText(/\/today/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            const logs = await getAllLogs();

            const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
            const todayStr = nowWIB.toISOString().split('T')[0];

            // filter log hari ini
            const todayLogs = logs.filter((log) => {
                const logDate = new Date(log.access_time).toISOString().split('T')[0];
                return logDate === todayStr;
            });

            const total = todayLogs.length;
            const allowed = todayLogs.filter((l) => l.status === 'allowed').length;
            const denied = todayLogs.filter((l) => l.status === 'denied').length;

            const message = `
📊 *Today's Access Stats*
Total Scans: ${total}
✅ Allowed: ${allowed}
❌ Denied: ${denied}
            `.trim();
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (err) {
            bot.sendMessage(chatId, '❌ Failed to retrieve stats.');
        }
    });

    // /logs - 5 log terakhir
    bot.onText(/\/logs/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            const logs = await getAllLogs();
            const recent = logs.slice(0, 5);

            if (recent.length === 0) {
                return bot.sendMessage(chatId, 'Tidak ada log terbaru.');
            }

            let message = `📋 *Last 5 Access Logs*\n\n`;
            recent.forEach((log) => {
                const time = new Date(log.access_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const icon = log.status === 'allowed' ? '✅' : '❌';
                message += `${icon} *${log.user_name || 'Unknown'}* -> ${log.room} at ${time}\n`;
            });

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (err) {
            bot.sendMessage(chatId, '❌ Failed to retrieve logs.');
        }
    });

    // /alerts - denied access dalam 24 jam terakhir
    bot.onText(/\/alerts/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            const logs = await getAllLogs();
            const now = new Date();

            // filter denied dalam 24 jam terakhir
            const alerts = logs
                .filter((log) => {
                    const logTime = new Date(log.access_time);
                    const isWithin24h = now - logTime < 24 * 60 * 60 * 1000;
                    return log.status === 'denied' && isWithin24h;
                })
                .slice(0, 10);

            if (alerts.length === 0) {
                return bot.sendMessage(chatId, '✅ Tidak ada denied access dalam 24 jam terakhir.');
            }

            let message = `⚠️ *Recent Access Alerts (24h)*\n\n`;
            alerts.forEach((log) => {
                const time = new Date(log.access_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                message += `❌ *${log.user_name || 'Unknown'}* -> ${log.room} at ${time}\n`;
            });

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (err) {
            bot.sendMessage(chatId, '❌ Failed to retrieve alerts.');
        }
    });

    // callback query dari inline keyboard (open_room | ignore)
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
                bot.sendMessage(
                    chatId,
                    `✅ *${query.from.first_name}* manually opened room: *${room}*`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                bot.answerCallbackQuery(query.id, { text: 'Hardware disconnected.', show_alert: true });
            }
        } else if (data === 'ignore') {
            bot.answerCallbackQuery(query.id, { text: 'Alert ignored.' });
        }

        // hapus inline keyboard setelah action
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
    });
}

export default bot;
