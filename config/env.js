import { config } from "dotenv"

config({ path: `.env.${process.env.NODE_ENV || "development"}.local` })

export const { NODE_ENV, PORT, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_GROUP_ID, API_KEY, JWT_SECRET, REFRESH_TOKEN_SECRET, DATABASE_URL, GCP_BUCKET_NAME } = process.env