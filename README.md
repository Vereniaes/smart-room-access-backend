# smart-room-access-backend

> REST API server untuk sistem smart door access
> - validasi RFID dari ESP32 / ESP8266
> - manajemen user dan jadwal akses
> - logging akses + notifikasi Telegram
> - face recognition (via Python ML service)

**Stack:** Node.js + Express v5 · PostgreSQL (Neon) · Drizzle ORM · JWT Auth · GCP Cloud Storage

---

## Daftar Isi

- [Struktur Folder](#struktur-folder)
- [Skema Database](#skema-database)
- [Input dari ESP32](#input-dari-esp32)
- [API Endpoints](#api-endpoints)
- [Auth Flow](#auth-flow)
- [Setup & Menjalankan](#setup--menjalankan)
- [Environment Variables](#environment-variables)

---

## Struktur Folder

```
smart-room-access-backend/
├── index.js                     # entry point Express
├── config/
│   ├── env.js                   # load dotenv + export semua env vars
│   └── swagger.js               # konfigurasi Swagger/OpenAPI
├── src/
│   ├── routes/
│   │   ├── index.js             # mount semua route ke /api/v1
│   │   ├── accessRoutes.js      # POST /access  <- dari ESP32/ESP8266
│   │   ├── authRoutes.js        # POST /auth/login, GET /auth/refresh-token
│   │   ├── userRoutes.js        # CRUD /users (dashboard admin)
│   │   ├── logRoutes.js         # GET /logs (dashboard admin)
│   │   └── faceRoutes.js        # POST /face/register, /face/inference (proxy ke ML service)
│   ├── controllers/
│   │   ├── accessController.js  # terima multipart dari ESP32, parse uid + photo
│   │   ├── authController.js    # login, refresh token, logout
│   │   ├── userController.js    # CRUD user
│   │   └── logController.js     # get semua access log
│   ├── services/
│   │   ├── accessService.js     # validasi RFID: cek user, jadwal, masa berlaku
│   │   ├── authService.js       # JWT sign/verify, bcrypt password
│   │   ├── userService.js       # query DB untuk user
│   │   ├── logService.js        # query DB untuk log
│   │   └── notificationService.js # kirim notif ke Telegram
│   ├── middleware/
│   │   ├── authMiddleware.js    # verifyApiKey (header X-API-KEY)
│   │   ├── jwtMiddleware.js     # verifyJwt (Bearer token)
│   │   └── errorHandler.js      # global error handler
│   ├── database/
│   │   ├── schema.js            # definisi tabel Drizzle ORM
│   │   ├── sql.js               # koneksi ke Neon PostgreSQL
│   │   └── seed.js              # seed data awal
│   └── utils/
│       ├── response.js          # sendResponse, sendError helper
│       └── gcsUpload.js         # upload foto ke GCP Cloud Storage

└── migrations/                  # file SQL migration Drizzle
```

---

## Skema Database

### Tabel `users`

Menyimpan semua pengguna yang terdaftar dalam sistem.

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | serial (PK) | auto increment |
| `name` | varchar(255) | nama lengkap |
| `username` | varchar(100) unique | untuk login dashboard (nullable — guest tidak punya) |
| `password` | text | bcrypt hash password dashboard (nullable) |
| `refresh_token` | text | bcrypt hash refresh token aktif (nullable) |
| `rfid_uid` | varchar(255) unique | bcrypt hash dari RFID UID fisik kartu |
| `role` | enum | `admin` / `staff` / `student` / `guest` |
| `schedule_start` | varchar(10) | jam mulai akses format `HH:MM` |
| `schedule_end` | varchar(10) | jam selesai akses format `HH:MM` |
| `valid_until` | varchar(50) | tanggal kadaluarsa kartu (nullable) |
| `created_at` | timestamp | auto |
| `updated_at` | timestamp | auto |

> `rfid_uid` disimpan sebagai **bcrypt hash**, bukan plaintext — perbandingan pakai `bcrypt.compare()`.

---

### Tabel `access_logs`

Mencatat setiap percobaan akses (allowed maupun denied).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | serial (PK) | auto increment |
| `user_id` | integer (FK → users) | `null` jika UID tidak dikenal |
| `uid` | varchar(50) | RFID UID raw dari ESP32 |
| `access_time` | timestamp | waktu akses (auto) |
| `status` | varchar(20) | `allowed` atau `denied` |
| `room` | varchar(100) | nama ruangan dari ESP32 |
| `message` | varchar(255) | alasan akses (granted / jadwal / kadaluarsa / tidak terdaftar) |
| `photo_url` | text | URL publik foto dari GCP Cloud Storage (nullable) |

---

### Tabel `face_embeddings`

Menyimpan 512-dim face embedding untuk face recognition (InsightFace pipeline).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | serial (PK) | auto increment |
| `person_name` | varchar(255) | nama orang yang didaftarkan |
| `user_id` | integer (FK → users) | opsional — link ke tabel users |
| `embedding` | text | JSON array 512 float32 (L2 normalized) |
| `photo_index` | integer | urutan foto: `1`, `2`, atau `3` |
| `created_at` | timestamp | auto |

> Satu orang = 3 rows (1 per foto registrasi). Saat inference, semua embedding di-load dan dicari best cosine similarity.

---

### ERD

```
users
  │
  ├──< access_logs (user_id → users.id, ON DELETE SET NULL)
  │
  └──< face_embeddings (user_id → users.id, ON DELETE SET NULL)
```

---

## Input dari ESP32

ESP32 / ESP8266 mengirim request ke endpoint `POST /api/v1/access`.

### Autentikasi

ESP32 wajib menyertakan API Key di header setiap request:

```
X-API-KEY: <API_KEY dari .env>
```

### Format Request

**Content-Type:** `multipart/form-data`

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `uid` | string | ✅ | RFID UID dari kartu — contoh: `"7B E6 40 02"` |
| `room` | string | ✅ | Nama ruangan — contoh: `"lab-iot"` |
| `photo` | file (JPEG) | ⚠️ | Foto dari ESP32-CAM — **wajib jika ingin face verification aktif** |

> Jika `photo` tidak disertakan, hanya RFID yang divalidasi (backward compatible dengan ESP32 tanpa kamera).

### Response dari Server ke ESP32

Server selalu return HTTP `200`. ESP32 cukup baca field `data.status`:

```json
// akses diizinkan (RFID + wajah terverifikasi)
{
  "success": true,
  "message": "Access request processed successfully",
  "data": {
    "status": "allowed",
    "message": "Akses berhasil - RFID dan wajah terverifikasi (John Doe)",
    "face": {
      "matched": true,
      "person_name": "John Doe",
      "similarity": 0.87,
      "gender": "male",
      "age": 25
    }
  }
}

// akses ditolak - wajah tidak dikenali
{
  "success": true,
  "data": {
    "status": "denied",
    "message": "Wajah tidak dikenali (similarity: 0.21 < 0.40)",
    "face": { "matched": false, "similarity": 0.21, ... }
  }
}

// akses ditolak - di luar jadwal
{
  "success": true,
  "data": {
    "status": "denied",
    "message": "Akses ditolak di luar jadwal operasional"
  }
}
```

### Alur Validasi Akses - Dual Factor (RFID + Face)

```
ESP32 kirim uid + room + photo
   │
   ▼
[1] RFID lookup - O(1) dengan HMAC-SHA256 + DB index
    - hashRfidUid(uid) → WHERE rfid_uid = hash → < 5ms
    - tidak ketemu → denied: "RFID tidak terdaftar"
   │
   ▼
[2] Cek masa berlaku kartu
    - valid_until != null && today > valid_until
    - → denied: "Kartu RFID telah kadaluarsa"
   │
   ▼
[3] Cek jadwal akses (timezone WIB UTC+7)
    - jam sekarang < schedule_start || > schedule_end
    - → denied: "Akses ditolak di luar jadwal operasional"
   │
   ▼
[4] Face verification (hanya jika photo ada)
    ├── GCS upload → async fire-and-forget (tidak blokir)
    └── ML inference → sync (perlu hasil untuk keputusan)
        - ML service down → denied: "Face verification gagal"
        - face.matched = false → denied: "Wajah tidak dikenali"
        - face.matched = true → lanjut
   │
   ▼
[5] Akses diizinkan → status: "allowed"
[6] Insert ke access_logs
[7] Kirim notifikasi Telegram
```

**Estimasi latency per tap (dengan photo, ML warm):**
- RFID lookup: < 5ms
- Face inference: ~300–600ms (CPU)
- Total: **~350–650ms**



---

## API Endpoints

Base URL: `http://localhost:5000/api/v1`

### Ringkasan

| Method | Endpoint | Auth | Siapa yang akses |
|--------|----------|------|-----------------|
| `POST` | `/access` | API Key | ESP32 / ESP8266 |
| `POST` | `/auth/login` | - | Dashboard admin |
| `GET` | `/auth/refresh-token` | Cookie | Dashboard admin |
| `POST` | `/auth/logout` | JWT | Dashboard admin |
| `GET` | `/users` | JWT | Dashboard admin |
| `POST` | `/users` | JWT | Dashboard admin |
| `GET` | `/users/:id` | JWT | Dashboard admin |
| `PUT` | `/users/:id` | JWT | Dashboard admin |
| `DELETE` | `/users/:id` | JWT | Dashboard admin |
| `GET` | `/logs` | JWT | Dashboard admin |
| `POST` | `/face/register` | - | Dashboard / Mobile |
| `POST` | `/face/inference` | - | ESP32-CAM / Mobile |

---

### `POST /api/v1/access`

Input dari ESP32 untuk validasi akses RFID.

**Header:** `X-API-KEY: <key>`  
**Content-Type:** `multipart/form-data`

```
uid    : string  (required) - RFID UID raw
room   : string  (required) - nama ruangan
photo  : file    (optional) - JPEG dari ESP32-CAM
```

---

### `POST /api/v1/auth/login`

Login dashboard admin/staff.

**Content-Type:** `application/json`

```json
{
  "username": "admin",
  "password": "password123"
}
```

Response: `accessToken` (expires 15 menit) + `refreshToken` di httpOnly cookie.

> Hanya role `admin` dan `staff` yang bisa login dashboard.

---

### `GET /api/v1/auth/refresh-token`

Dapatkan access token baru dari refresh token (cookie).  
Tidak perlu body — refresh token dibaca otomatis dari cookie.

---

### `POST /api/v1/auth/logout`

**Header:** `Authorization: Bearer <token>`  
Hapus refresh token dari DB dan clear cookie.

---

### `GET /api/v1/users`

**Header:** `Authorization: Bearer <token>`  
Return list semua user.

---

### `POST /api/v1/users`

**Header:** `Authorization: Bearer <token>`  
**Content-Type:** `application/json`

```json
{
  "name": "John Doe",
  "rfid_uid": "7B E6 40 02",
  "role": "student",
  "schedule_start": "08:00",
  "schedule_end": "17:00",
  "valid_until": "2026-12-31",
  "username": null,
  "password": null
}
```

> `rfid_uid` otomatis di-bcrypt sebelum disimpan.

---

### `GET /api/v1/logs`

**Header:** `Authorization: Bearer <token>`  
Return semua access log terurut terbaru.

---

### `POST /api/v1/face/register`

Daftarkan wajah dengan 3 foto (proxy ke ML service).  
**Content-Type:** `multipart/form-data`

```
person_name : string  (required)
user_id     : integer (optional)
photo_1     : file    (required)
photo_2     : file    (required)
photo_3     : file    (required)
```

---

### `POST /api/v1/face/inference`

Kenali wajah dari 1 foto (proxy ke ML service).  
**Content-Type:** `multipart/form-data`

```
photo : file (required)
```

---

## Auth Flow

```
                    ESP32                    Dashboard
                      │                          │
                      │ X-API-KEY header          │ POST /auth/login
                      ▼                          ▼
              verifyApiKey middleware      loginUser service
              (string compare)             (bcrypt password check
                      │                    + role check admin/staff)
                      │                          │
                      │                    accessToken (15m)
                      │                    refreshToken (7d) → httpOnly cookie
                      │                          │
                      │                    Bearer <accessToken>
                      │                    → verifyJwt middleware
                      │                          │
                 /access route              /users, /logs routes
```

---

## Setup & Menjalankan

### 1. Install dependencies

```bash
cd smart-room-access-backend
npm install
```

### 2. Setup environment

```bash
cp .env.example .env.development.local
# edit dan isi semua variable
```

### 3. Jalankan migration database

```bash
npx drizzle-kit generate   # generate SQL dari schema.js
npx drizzle-kit migrate    # apply ke DB
```

### 4. Seed data awal (opsional)

```bash
npm run db:seed
```

### 5. Jalankan server

```bash
# development (nodemon auto-reload)
npm run dev

# production
npm start
```

Server jalan di `http://localhost:5000`  
Swagger UI: `http://localhost:5000/api-docs`

---

## Environment Variables

| Variable | Keterangan | Contoh |
|----------|------------|--------|
| `NODE_ENV` | environment mode | `development` |
| `PORT` | port server | `5000` |
| `API_KEY` | API key untuk ESP32 | `168318b6-...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `GCP_BUCKET_NAME` | nama GCS bucket untuk foto | `capture-security` |
| `TELEGRAM_BOT_TOKEN` | token bot Telegram | `8772799402:AAF...` |
| `TELEGRAM_CHAT_ID` | chat ID untuk notif personal | `7678671053` |
| `TELEGRAM_GROUP_ID` | group ID untuk notif grup | `-5196412607` |
| `JWT_SECRET` | secret untuk sign access token | `vh1EAm8V...` |
| `REFRESH_TOKEN_SECRET` | secret untuk sign refresh token | `vh1EAm8V...` |
| `ML_SERVICE_URL` | URL Python ML service | `http://localhost:8001` |

---

## Catatan

- **Timezone**: server berjalan UTC, semua validasi jadwal dikonversi ke WIB (UTC+7) secara manual
- **RFID bcrypt**: karena bcrypt tidak bisa di-query langsung (`WHERE rfid = ?`), semua user di-load lalu dibandingkan satu per satu — pertimbangkan indexing jika user sangat banyak
- **Foto opsional**: ESP32 tanpa kamera tetap bisa kirim akses tanpa `photo` field
- **ML service**: jika Python ML service tidak jalan, endpoint `/face/*` return `503` tapi tidak crash backend utama
