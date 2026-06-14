import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_GROUP_ID } from '../../config/env.js';

let bot = null;

if (TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
} else {
    console.warn("TELEGRAM_BOT_TOKEN is not defined in environment variables. Telegram notifications will be disabled.");
}

export const sendNotification = async (user, room, status, accessTypeMessage = "") => {
    if (!bot || !TELEGRAM_GROUP_ID) {
        console.log("Mock Telegram Notification:", { user, room, status, accessTypeMessage });
        return;
    }

    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

    const message = `
Access Notification
User: ${user ? user.name : 'Unknown User'}
Room: ${room}
Status: ${status === "allowed" ? "Access Granted ✅" : `Access Denied ❌ (${accessTypeMessage})`}
Time: ${time}
    `.trim();

    try {
        await bot.sendMessage(TELEGRAM_GROUP_ID, message);
    } catch (error) {
        console.error("Failed to send telegram notification", error);
    }
};

// function untuk mengirim pesan uji coba (ping) koneksi Telegram bot
// input param : none
// output      : void (melempar error jika bot tidak aktif)
export const sendTestNotification = async () => {
    if (!bot || !TELEGRAM_GROUP_ID) {
        throw new Error("Telegram bot belum aktif atau TELEGRAM_GROUP_ID tidak dikonfigurasi.");
    }
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const message = `🔔 *Smart Room Access - Test Connection*\n\nKoneksi bot Telegram Anda ke server dashboard berhasil terjalin!\nWaktu Uji: ${time} WIB`;
    await bot.sendMessage(TELEGRAM_GROUP_ID, message, { parse_mode: 'Markdown' });
};
