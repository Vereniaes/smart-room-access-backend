import { text } from "drizzle-orm/gel-core";
import { integer, pgTable, serial, pgEnum, timestamp, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum('user_role', ['admin', 'staff', 'student', 'guest'])

// Tabel Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),

  // dashboard credential
  username: varchar("username", { length: 100 }).unique(),
  password: text("password"),
  refresh_token: text("refresh_token"),

  rfid_uid: varchar("rfid_uid", { length: 255 }).notNull().unique(),
  role: roleEnum("role").default("guest").notNull(),
  schedule_start: varchar("schedule_start", { length: 10 }).notNull(), // format HH:MM
  schedule_end: varchar("schedule_end", { length: 10 }).notNull(),     // format HH:MM
  valid_until: varchar("valid_until", { length: 50 }), // Tanggal / waktu kadaluarsa
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Tabel Access Logs
export const accessLogs = pgTable("access_logs", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id), // Foreign Key ke tabel users
  uid: varchar("uid", { length: 50 }).notNull(),
  access_time: timestamp("access_time").defaultNow().notNull(),
  status: varchar("status", { length: 20 }).notNull(), // "allowed" atau "denied"
  room: varchar("room", { length: 100 }).notNull(),
  message: varchar("message", { length: 255 }),
});