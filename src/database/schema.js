import { integer, pgTable, serial, pgEnum, timestamp, varchar, text, uniqueIndex } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum('user_role', ['admin', 'staff', 'student', 'guest'])

// Tabel Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),

  // dashboard credential
  username: varchar("username", { length: 100 }).unique(),
  password: text("password"),
  refresh_token: text("refresh_token"),

  rfid_uid: varchar("rfid_uid", { length: 64 }).notNull().unique(),  // HMAC-SHA256 hex (64 chars)
  role: roleEnum("role").default("guest").notNull(),
  schedule_start: varchar("schedule_start", { length: 10 }).notNull(), // format HH:MM
  schedule_end: varchar("schedule_end", { length: 10 }).notNull(),     // format HH:MM
  valid_until: varchar("valid_until", { length: 50 }), // Tanggal / waktu kadaluarsa
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  rfidUidIdx: uniqueIndex("users_rfid_uid_idx").on(table.rfid_uid), // index untuk O(1) lookup
}));

// Tabel Access Logs
export const accessLogs = pgTable("access_logs", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id, { onDelete: 'set null' }), // Foreign Key ke tabel users
  uid: varchar("uid", { length: 50 }).notNull(),
  access_time: timestamp("access_time").defaultNow().notNull(),
  status: varchar("status", { length: 20 }).notNull(), // "allowed" atau "denied"
  room: varchar("room", { length: 100 }).notNull(),
  message: varchar("message", { length: 255 }),
  photo_url: text("photo_url"),  // GCS public URL foto saat tap
});

// Tabel Face Embeddings
// - menyimpan 512-dim embedding dari InsightFace pipeline (w600k_r50.onnx)
// - satu orang bisa punya sampai 3 embedding (1 per foto registrasi)
// - embedding disimpan sebagai JSON string array 512 float32
export const faceEmbeddings = pgTable("face_embeddings", {
  id: serial("id").primaryKey(),
  person_name: varchar("person_name", { length: 255 }).notNull(),          // nama orang yang didaftarkan
  user_id: integer("user_id").references(() => users.id, { onDelete: 'set null' }), // optional link ke users
  embedding: text("embedding").notNull(),                                   // JSON array 512-dim float32
  photo_index: integer("photo_index").notNull(),                            // urutan foto: 1, 2, atau 3
  created_at: timestamp("created_at").defaultNow().notNull(),
});