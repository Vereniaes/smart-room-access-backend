import "dotenv/config"
import { users } from "./schema.js"
import bcrypt from "bcryptjs"
import { db } from "./sql.js"

const seed = async () => {
    console.log("Starting seed...")

    const hashedPassword = await bcrypt.hash("admin123", 10)
    const hashedRfid = await bcrypt.hash("ADMIN-CARD-001", 10)

    await db.insert(users).values({
        name: "Super Admin",
        username: "admin",
        password: hashedPassword,
        rfid_uid: hashedRfid,
        role: "admin",
        schedule_start: "00:00",
        schedule_end: "23:59",
    })

    console.log("Seeding finished - Admin account created!")
    process.exit(0)
}

seed().catch((err) => {
    console.error("Seeding failed :", err )
    process.exit(1)
})