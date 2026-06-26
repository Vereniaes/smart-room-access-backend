# Dokumentasi Teknis Backend - Smart Room Access System

**Nama Proyek:** Smart Room Access System - Backend Service  
**Versi:** 1.0.0  
**Runtime:** Node.js v20 + Express v5  
**Basis Data:** PostgreSQL (Neon Serverless) via Drizzle ORM  
**Tanggal Dokumen:** Juni 2026

---

## Daftar Isi

- [1. Pendahuluan](#1-pendahuluan)
- [2. Arsitektur Sistem](#2-arsitektur-sistem)
- [3. Struktur Direktori](#3-struktur-direktori)
- [4. Skema Basis Data](#4-skema-basis-data)
- [5. Diagram Alir Proses](#5-diagram-alir-proses)
- [6. Diagram Komponen Sistem](#6-diagram-komponen-sistem)
- [7. Mekanisme Keamanan](#7-mekanisme-keamanan)
- [8. Referensi API Endpoint](#8-referensi-api-endpoint)
- [9. Konfigurasi Lingkungan](#9-konfigurasi-lingkungan)
- [10. Panduan Instalasi dan Pengoperasian](#10-panduan-instalasi-dan-pengoperasian)
- [11. Deployment Berbasis Kontainer](#11-deployment-berbasis-kontainer)
- [12. Catatan Teknis dan Pertimbangan](#12-catatan-teknis-dan-pertimbangan)

---

## 1. Pendahuluan

Backend service ini merupakan komponen inti dari sistem Smart Room Access yang bertanggung jawab atas seluruh logika bisnis, validasi akses, manajemen pengguna, serta orkestrasi komunikasi antara perangkat IoT (ESP32/ESP8266), layanan pengenalan wajah berbasis machine learning, dan antarmuka dasbor administrasi.

Sistem ini dirancang dengan pendekatan modular menggunakan pola arsitektur layered (Controller - Service - Repository), sehingga setiap lapisan memiliki tanggung jawab yang terisolasi dan dapat diuji secara mandiri.

### 1.1 Ruang Lingkup Sistem

Sistem mengelola empat fungsi utama:

- **Validasi akses ganda (dual-factor)** - verifikasi kartu RFID dan pencocokan wajah secara simultan sebelum akses diberikan
- **Manajemen entitas** - pengelolaan data pengguna (users), kartu RFID (cards), dan log akses (access_logs) melalui antarmuka dasbor
- **Pengenalan wajah** - integrasi dengan Python ML service berbasis InsightFace untuk pendaftaran dan inferensi wajah menggunakan pgvector cosine similarity
- **Notifikasi real-time** - pengiriman notifikasi setiap kejadian akses ke kanal Telegram grup maupun personal

### 1.2 Batasan Sistem

- Server berjalan pada zona waktu Asia/Jakarta (WIB); pelaporan bot Telegram disesuaikan dengan zona waktu lokal
- Layanan pengenalan wajah bersifat opsional - jika photo tidak disertakan dalam request, sistem tetap berfungsi dengan validasi RFID saja
- Hanya pengguna dengan role `admin` atau `staff` yang diizinkan mengakses dasbor administrasi

---

## 2. Arsitektur Sistem

### 2.1 Gambaran Umum Arsitektur

```mermaid
graph TB
    subgraph "Perangkat IoT"
        ESP[ESP32 / ESP8266]
        CAM[ESP32-CAM]
    end

    subgraph "Backend Service (Node.js + Express v5)"
        GW[API Gateway :5000]
        AUTH[Auth Middleware]
        JWT_MW[JWT Middleware]

        subgraph "Controllers"
            AC[Access Controller]
            UC[User Controller]
            CC[Card Controller]
            LC[Log Controller]
            FC[Face Controller]
            SC[System Controller]
        end

        subgraph "Services"
            AS[Access Service]
            US[User Service]
            CS[Card Service]
            LS[Log Service]
            FS[Face Service]
            NS[Notification Service]
            SS[System Service]
        end

        subgraph "Database Layer"
            DRZ[Drizzle ORM]
        end

        subgraph "Utils"
            GCS_U[GCS Upload]
            HASH[RFID Hash HMAC-SHA256]
            RESP[Response Helper]
        end
    end

    subgraph "Layanan Eksternal"
        PG[(PostgreSQL / Neon)]
        ML[Python ML Service FastAPI :8001]
        TG[Telegram Bot API]
        GCS_S[GCP Cloud Storage]
    end

    subgraph "Klien Dasbor"
        DASH[Next.js Dashboard]
    end

    ESP -->|POST /api/v1/access multipart/form-data + X-API-KEY| GW
    CAM -->|photo JPEG| GW
    DASH -->|REST API + Bearer JWT| GW

    GW --> AUTH
    GW --> JWT_MW
    AUTH --> AC
    JWT_MW --> UC
    JWT_MW --> CC
    JWT_MW --> LC
    JWT_MW --> SC

    AC --> AS
    UC --> US
    CC --> CS
    LC --> LS
    FC --> FS

    AS --> CS
    AS --> US
    AS --> FS
    AS --> NS
    AS --> GCS_U

    FS --> ML
    NS --> TG
    GCS_U --> GCS_S

    DRZ --> PG
    AS --> DRZ
    US --> DRZ
    CS --> DRZ
    LS --> DRZ
    FS --> DRZ
```

### 2.2 Pola Arsitektur

Backend ini mengimplementasikan pola **Layered Architecture** dengan tiga lapisan utama:

| Lapisan | File | Tanggung Jawab |
|---------|------|----------------|
| Controller | `src/controllers/*.js` | Menerima HTTP request, parsing input, memanggil service, mengirim response |
| Service | `src/services/*.js` | Menerapkan logika bisnis, orkestrasi antar modul, penanganan aturan domain |
| Database | `src/database/schema.js` | Definisi skema tabel dan koneksi Drizzle ORM |

Middleware berfungsi sebagai lapisan proteksi yang berjalan sebelum controller dieksekusi.

---

## 3. Struktur Direktori

```
smart-room-access-backend/
|
|-- index.js                          # Entry point Express - setup middleware global & routing
|-- package.json
|-- Dockerfile                        # Multi-stage build: deps + runtime (Node 20 Alpine)
|-- docker-compose.yml                # Orkestrasi backend + ML service
|-- drizzle.config.js                 # Konfigurasi Drizzle Kit untuk migrasi
|-- .env.example                      # Template variabel lingkungan
|
|-- config/
|   |-- env.js                        # Load dotenv, export seluruh env var sebagai konstanta
|   `-- swagger.js                    # Konfigurasi Swagger/OpenAPI spec
|
|-- src/
|   |-- routes/
|   |   |-- index.js                  # Mount semua route ke /api/v1 beserta middleware
|   |   |-- accessRoutes.js           # POST /access - dari ESP32/ESP8266
|   |   |-- authRoutes.js             # POST /auth/login, GET /auth/refresh-token, POST /auth/logout
|   |   |-- userRoutes.js             # CRUD /users
|   |   |-- cardRoutes.js             # CRUD /cards
|   |   |-- logRoutes.js              # GET /logs
|   |   |-- faceRoutes.js             # POST /face/register, POST /face/inference
|   |   `-- systemRoutes.js           # GET /system/health
|   |
|   |-- controllers/
|   |   |-- accessController.js       # Terima multipart dari ESP32, parse uid + photo
|   |   |-- authController.js         # Login, refresh token, logout
|   |   |-- userController.js         # CRUD user
|   |   |-- cardController.js         # CRUD kartu RFID
|   |   |-- logController.js          # Ambil semua access log
|   |   |-- faceController.js         # Proxy ke ML service (register & inference)
|   |   `-- systemController.js       # Cek health DB, ML service, metrik server
|   |
|   |-- services/
|   |   |-- accessService.js          # Validasi RFID, cek jadwal, orkestrasi face check
|   |   |-- authService.js            # JWT sign/verify, bcrypt password, refresh token
|   |   |-- userService.js            # Query DB untuk entitas user
|   |   |-- cardService.js            # Query DB untuk entitas kartu RFID
|   |   |-- logService.js             # Query DB untuk access log
|   |   |-- faceService.js            # Panggil ML API + pgvector cosine similarity
|   |   |-- botService.js             # Telegram bot (polling + 2-way commands + notifikasi akses)
|   |   `-- systemService.js          # Health check DB, ML, metrik sistem, device list
|   |
|   |-- middleware/
|   |   |-- authMiddleware.js         # verifyApiKey: validasi header X-API-KEY (untuk ESP32)
|   |   |-- jwtMiddleware.js          # verifyJwt: validasi Bearer token (untuk dasbor)
|   |   `-- errorHandler.js           # Global error handler - tangkap semua uncaught error
|   |
|   |-- database/
|   |   |-- schema.js                 # Definisi tabel Drizzle ORM (users, cards, access_logs, face_embeddings)
|   |   |-- sql.js                    # Koneksi Neon PostgreSQL via @neondatabase/serverless
|   |   `-- seed.js                   # Seed data awal (admin user + sample data)
|   |
|   `-- utils/
|       |-- response.js               # Helper sendResponse() dan sendError() untuk format JSON seragam
|       |-- gcsUpload.js              # Upload buffer foto ke GCP Cloud Storage, return public URL
|       |-- socketServer.js           # Singleton Socket.IO wrapper - setIO, getIO, emitAccessEvent
|       `-- rfidHash.js               # HMAC-SHA256 untuk hashing RFID UID sebelum disimpan ke DB
|
`-- migrations/                       # File SQL migrasi yang di-generate Drizzle Kit
```

---

## 4. Skema Basis Data

### 4.1 Entity Relationship Diagram

```mermaid
erDiagram
    USERS {
        serial id PK
        varchar name
        varchar username UK
        text password
        text refresh_token
        varchar rfid_uid UK
        enum role
        varchar schedule_start
        varchar schedule_end
        varchar valid_until
        timestamp created_at
        timestamp updated_at
    }

    CARDS {
        serial id PK
        varchar rfid_uid UK
        varchar card_no
        varchar valid_until
        timestamp created_at
    }

    ACCESS_LOGS {
        serial id PK
        integer user_id FK
        varchar uid
        timestamp access_time
        varchar status
        varchar room
        varchar message
        text photo_url
    }

    FACE_EMBEDDINGS {
        serial id PK
        varchar person_name
        integer user_id FK
        vector embedding
        integer photo_index
        text photo_url
        timestamp created_at
    }

    USERS ||--o{ ACCESS_LOGS : "user_id (ON DELETE SET NULL)"
    USERS ||--o{ FACE_EMBEDDINGS : "user_id (ON DELETE SET NULL)"
    CARDS }o--o| USERS : "rfid_uid (shared key)"
```

### 4.2 Deskripsi Tabel

#### Tabel `users`

Menyimpan seluruh pengguna yang terdaftar dalam sistem, mencakup pengguna aktif (admin, staff, student) maupun tamu sementara (guest).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | serial PK | Identifikasi unik, auto increment |
| `name` | varchar(255) | Nama lengkap pengguna |
| `username` | varchar(100) unique | Kredensial login dasbor, nullable untuk non-admin |
| `password` | text | Hash bcrypt password dasbor, nullable |
| `refresh_token` | text | Hash bcrypt refresh token sesi aktif, nullable |
| `rfid_uid` | varchar(64) unique | Hash HMAC-SHA256 dari UID fisik kartu RFID |
| `role` | enum | Salah satu dari: `admin`, `staff`, `student`, `guest` |
| `schedule_start` | varchar(10) | Jam mulai akses, format `HH:MM` |
| `schedule_end` | varchar(10) | Jam selesai akses, format `HH:MM` |
| `valid_until` | varchar(50) | Tanggal kadaluarsa akun, nullable |
| `created_at` | timestamp | Waktu pembuatan, auto |
| `updated_at` | timestamp | Waktu pembaruan terakhir, auto |

#### Tabel `cards`

Menyimpan identitas kartu RFID secara independen dari pengguna, memungkinkan satu kartu dapat dipindahtangankan antar pengguna.

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | serial PK | Identifikasi unik, auto increment |
| `rfid_uid` | varchar(64) unique | Hash HMAC-SHA256 dari UID fisik kartu |
| `card_no` | varchar(50) | UID plaintext untuk tampilan antarmuka |
| `valid_until` | varchar(50) | Tanggal kadaluarsa kartu, nullable. Nilai `1970-01-01` menandakan kartu diblokir |
| `created_at` | timestamp | Waktu pendaftaran kartu, auto |

#### Tabel `access_logs`

Mencatat setiap percobaan akses tanpa memandang hasilnya (allowed maupun denied).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | serial PK | Identifikasi unik, auto increment |
| `user_id` | integer FK | Referensi ke `users.id`, bernilai `null` jika UID tidak dikenal |
| `uid` | varchar(50) | RFID UID raw dari ESP32 untuk keperluan log |
| `access_time` | timestamp | Waktu kejadian akses, auto |
| `status` | varchar(20) | Hasil akses: `allowed` atau `denied` |
| `room` | varchar(100) | Nama ruangan yang dikirim oleh ESP32 |
| `message` | varchar(255) | Keterangan detail alasan akses diberikan atau ditolak |
| `photo_url` | text | URL publik foto dari GCP Cloud Storage, nullable |

#### Tabel `face_embeddings`

Menyimpan representasi vektor wajah (embedding) 512 dimensi yang dihasilkan oleh model InsightFace (`w600k_r50.onnx`).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | serial PK | Identifikasi unik, auto increment |
| `person_name` | varchar(255) | Nama orang yang didaftarkan |
| `user_id` | integer FK | Referensi opsional ke `users.id`, nullable |
| `embedding` | vector(512) | Array 512 float32 L2-normalized, disimpan via pgvector |
| `photo_index` | integer | Urutan foto registrasi: `1`, `2`, atau `3` |
| `photo_url` | text | URL publik foto registrasi di GCS, nullable |
| `created_at` | timestamp | Waktu pendaftaran embedding, auto |

> Satu orang didaftarkan dengan 3 foto berbeda, menghasilkan 3 baris embedding. Pada saat inferensi, sistem mencari baris dengan cosine similarity tertinggi terhadap embedding query menggunakan operator pgvector `<=>`.

---

## 5. Diagram Alir Proses

### 5.1 Alur Validasi Akses Dual-Factor (RFID + Wajah)

Ini adalah alur utama yang dipicu setiap kali ESP32 mengirimkan request tap kartu.

```mermaid
flowchart TD
    A([ESP32 mengirim request\nPOST /api/v1/access]) --> B{Validasi\nX-API-KEY}
    B -->|Invalid| Z1([HTTP 401\nUnauthorized])
    B -->|Valid| C1[Upload foto ke GCS jika ada]
    C1 --> C[Lookup kartu di tabel cards\nHashRfid UID dengan HMAC-SHA256]

    C --> D{Kartu\nterdaftar?}
    D -->|Tidak| E([denied:\nKartu RFID tidak terdaftar])

    D -->|Ya| F{Cek valid_until\nkartu}
    F -->|Kadaluarsa atau\ndiblokir| G([denied:\nKartu kadaluarsa atau diblokir])

    F -->|Masih berlaku| H{Cek user terkait\ngetDataUserByRfid}
    H -->|Tidak ada user| I([denied:\nKartu belum dikaitkan pengguna])

    H -->|User ditemukan| J{Cek valid_until\nuser}
    J -->|Kadaluarsa atau\ndiblokir| K([denied:\nMasa berlaku habis / diblokir])

    J -->|Masih berlaku| L{Cek jadwal\nschedule_start dan end WIB}
    L -->|Di luar jadwal| M([denied:\nDi luar jadwal operasional])

    L -->|Dalam jadwal| N{Photo tersedia\nDAN user memiliki\nface embedding?}

    N -->|Tidak keduanya| R([allowed:\nAkses diberikan tanpa\nverifikasi wajah])

    N -->|Ya| P[Panggil ML service\nPOST /face/inference\nsync]

    P --> Q{ML service\nberhasil?}
    Q -->|Gagal/timeout| S([denied:\nFace verification gagal])

    Q -->|Berhasil| T{similarity\n>= 0.40?}
    T -->|Tidak| U([denied:\nWajah tidak dikenali])

    T -->|Ya| V([allowed:\nRFID dan wajah terverifikasi])

    E --> W[Insert access_log]
    G --> W
    I --> W
    K --> W
    M --> W
    R --> W
    S --> W
    U --> W
    V --> W

    W --> X[Kirim notifikasi Telegram]
    X --> Y([Response ke ESP32\nHTTP 200 + status allowed/denied])
```

### 5.2 Alur Autentikasi Dasbor

```mermaid
sequenceDiagram
    actor Admin
    participant Dashboard as Next.js Dashboard
    participant Backend as Express Backend
    participant DB as PostgreSQL

    Admin->>Dashboard: Input username dan password
    Dashboard->>Backend: POST /api/v1/auth/login
    Backend->>DB: SELECT user WHERE username = ?
    DB-->>Backend: User data
    Backend->>Backend: bcrypt.compare(password, hash)
    Backend->>Backend: Cek role === admin atau staff
    Backend->>Backend: jwt.sign(userData, JWT_SECRET, 15m)
    Backend->>Backend: jwt.sign(userData, REFRESH_TOKEN_SECRET, 7d)
    Backend->>Backend: bcrypt.hash(refreshToken)
    Backend->>DB: UPDATE users SET refresh_token = hash
    DB-->>Backend: OK
    Backend-->>Dashboard: accessToken + Set-Cookie: refreshToken (httpOnly)
    Dashboard->>Dashboard: Simpan accessToken di memori

    Note over Dashboard,Backend: Sesi aktif (15 menit)

    Dashboard->>Backend: GET /api/v1/any - Authorization: Bearer accessToken
    Backend->>Backend: jwt.verify(accessToken, JWT_SECRET)
    Backend-->>Dashboard: Data response

    Note over Dashboard,Backend: Token expired, refresh otomatis

    Dashboard->>Backend: GET /api/v1/auth/refresh-token
    Note right of Backend: Cookie refreshToken dikirim otomatis
    Backend->>Backend: jwt.verify(cookieToken, REFRESH_TOKEN_SECRET)
    Backend->>DB: SELECT user WHERE id = decoded.id
    DB-->>Backend: User data + hashed refresh_token
    Backend->>Backend: bcrypt.compare(cookieToken, hash)
    Backend->>Backend: jwt.sign(userData, JWT_SECRET, 15m)
    Backend-->>Dashboard: accessToken baru

    Note over Dashboard,Backend: Logout

    Admin->>Dashboard: Klik logout
    Dashboard->>Backend: POST /api/v1/auth/logout - Bearer token
    Backend->>DB: UPDATE users SET refresh_token = null
    Backend-->>Dashboard: Clear-Cookie + 200 OK
```

### 5.3 Alur Pendaftaran Wajah (Face Registration)

```mermaid
flowchart LR
    A([Operator membuka\nform registrasi wajah]) --> B[Upload 3 foto wajah\nberbeda sudut]
    B --> C[POST /api/v1/face/register\nmultipart/form-data\nperson_name + user_id + photo_1..3]

    C --> D[Face Controller\nmenerima dan memvalidasi\n3 file JPEG]

    D --> E[Face Service\nforwardMultipart ke ML service]

    E --> F[Python ML Service\nExtract embedding InsightFace\nw600k_r50.onnx]

    F -->|3 array embedding 512-dim| G[Face Service\nmenerima embeddings]

    G --> H[Loop per foto:\nUpload foto ke GCS\nDapatkan public URL]

    H --> I[INSERT ke face_embeddings\nperson_name, user_id, embedding,\nphoto_index, photo_url]

    I --> J([Response:\n3 embedding berhasil disimpan\nberikut similarity_scores antar foto])
```

### 5.4 Alur Inferensi Wajah (Face Inference)

```mermaid
flowchart TD
    A([Photo buffer dari ESP32]) --> B[Access Service\nInfer Face dengan inferFace]
    B --> C[Face Service\nforwardMultipart ke ML service\nPOST /face/inference]

    C --> D[Python ML Service\nExtract 1 embedding dari foto query\n512-dim float32 L2-normalized]

    D -->|embedding + gender, age, bbox| E[Face Service\nmenerima query embedding]

    E --> F["pgvector query:\nSELECT person_name, user_id,\n1 - embedding <=> query::vector AS similarity\nFROM face_embeddings\nORDER BY similarity DESC\nLIMIT 1"]

    F --> G{similarity\n>= threshold 0.40?}

    G -->|Ya| H([matched: true\nperson_name, user_id,\nsimilarity, gender, age])

    G -->|Tidak| I([matched: false\nsimilarity rendah])
```

---

## 6. Diagram Komponen Sistem

### 6.1 Diagram Deployment

```mermaid
graph TB
    subgraph "Perangkat Lapangan"
        ESP32["ESP32 / ESP8266\n(RFID Reader + Relay)"]
        ESP32CAM["ESP32-CAM\n(Kamera OV2640)"]
    end

    subgraph "Google Cloud Platform"
        subgraph "Cloud Run (asia-southeast2)"
            BACKEND["Backend Node.js\nExpress v5\nPort 8080"]
            ML["ML Service Python\nFastAPI + InsightFace\nPort 8001"]
        end

        subgraph "Storage"
            GCS["Cloud Storage\nFoto akses + registrasi\nbucket: capture-security"]
        end

        subgraph "Database"
            NEON["Neon PostgreSQL\nServerless\n+ pgvector extension"]
        end
    end

    subgraph "Layanan Pihak Ketiga"
        TELEGRAM["Telegram Bot API\nNotifikasi real-time"]
    end

    subgraph "Klien Pengguna"
        BROWSER["Browser\nNext.js Dashboard\nPort 3000"]
    end

    ESP32 -->|"HTTPS POST /api/v1/access\nX-API-KEY + multipart"| BACKEND
    ESP32CAM -->|"Foto JPEG\n(via ESP32)"| BACKEND

    BROWSER -->|"HTTPS REST API\nBearer JWT"| BACKEND

    BACKEND -->|"HTTP POST /face/inference\nmultipart"| ML
    BACKEND -->|"Upload foto Buffer"| GCS
    BACKEND -->|"Drizzle ORM\nServerless WebSocket"| NEON
    BACKEND -->|"sendMessage API"| TELEGRAM

    ML -->|"embedding 512-dim\ngender, age, bbox"| BACKEND
```

### 6.2 Diagram Interaksi Modul Internal

```mermaid
graph LR
    subgraph "Routes Layer"
        R_ACC[accessRoutes]
        R_AUTH[authRoutes]
        R_USR[userRoutes]
        R_CRD[cardRoutes]
        R_LOG[logRoutes]
        R_FACE[faceRoutes]
        R_SYS[systemRoutes]
    end

    subgraph "Middleware"
        MW_API[authMiddleware\nverifyApiKey]
        MW_JWT[jwtMiddleware\nverifyJwt]
        MW_ERR[errorHandler]
    end

    subgraph "Controllers"
        C_ACC[accessController]
        C_AUTH[authController]
        C_USR[userController]
        C_CRD[cardController]
        C_LOG[logController]
        C_FACE[faceController]
        C_SYS[systemController]
    end

    subgraph "Services"
        S_ACC[accessService]
        S_AUTH[authService]
        S_USR[userService]
        S_CRD[cardService]
        S_LOG[logService]
        S_FACE[faceService]
        S_NOT[botService]
        S_SYS[systemService]
    end

    subgraph "Database"
        DB[Drizzle ORM]
        SCH[schema.js]
        SQL[sql.js]
    end

    subgraph "Utils"
        GCS[gcsUpload]
        HASH[rfidHash]
        RESP[response]
    end

    R_ACC --> MW_API --> C_ACC --> S_ACC
    R_AUTH --> C_AUTH --> S_AUTH
    R_USR --> MW_JWT --> C_USR --> S_USR
    R_CRD --> MW_JWT --> C_CRD --> S_CRD
    R_LOG --> MW_JWT --> C_LOG --> S_LOG
    R_FACE --> C_FACE --> S_FACE
    R_SYS --> MW_JWT --> C_SYS --> S_SYS

    S_ACC --> S_USR
    S_ACC --> S_CRD
    S_ACC --> S_FACE
    S_ACC --> S_NOT
    S_ACC --> GCS
    S_NOT --> SK[socketServer]
    S_SYS --> S_NOT

    S_CRD --> HASH
    S_USR --> HASH

    DB --> SCH
    DB --> SQL

    S_ACC --> DB
    S_AUTH --> DB
    S_USR --> DB
    S_CRD --> DB
    S_LOG --> DB
    S_FACE --> DB
    S_SYS --> DB

    C_ACC --> RESP
    C_AUTH --> RESP
    C_USR --> RESP
```

---

## 7. Mekanisme Keamanan

### 7.1 Keamanan RFID - HMAC-SHA256 Hashing

UID kartu RFID tidak pernah disimpan dalam bentuk plaintext di basis data. Setiap UID di-hash menggunakan algoritma HMAC-SHA256 dengan secret key yang dikonfigurasi melalui variabel lingkungan `HMAC_SECRET`.

```
RFID UID (plaintext) : "7B E6 40 02"
                              |
                   HMAC-SHA256(uid, HMAC_SECRET)
                              |
       Hash tersimpan di DB : "a3f8c12d94e1..." (64 hex chars)
```

Pendekatan ini memungkinkan lookup deterministik (`WHERE rfid_uid = HMAC(uid)`) sehingga kompleksitas lookup tetap O(1) dengan bantuan unique index, berbeda dengan pendekatan bcrypt yang memerlukan perbandingan satu per satu.

### 7.2 Keamanan Sesi - JWT dengan Refresh Token Rotation

```
accessToken  : JWT, expires 15 menit, disimpan di memori JavaScript klien
refreshToken : JWT, expires 7 hari, dikirim via httpOnly cookie (tidak dapat diakses JavaScript)

Penyimpanan di DB:
- refreshToken di-hash dengan bcrypt sebelum disimpan
- Setiap logout menghapus hash refreshToken dari DB
- Jika hash tidak cocok saat refresh, sesi dinyatakan invalid
```

### 7.3 Keamanan API Perangkat IoT - API Key

ESP32 menggunakan API Key statis yang dikonfigurasi melalui variabel lingkungan. Header wajib disertakan pada setiap request:

```
X-API-KEY: <nilai dari env API_KEY>
```

Middleware `authMiddleware.js` melakukan perbandingan string secara langsung terhadap nilai `API_KEY` dari environment.

### 7.4 Kontainerisasi - Non-Root User

Dockerfile menggunakan multi-stage build dan menjalankan proses server sebagai non-root user (`nodeuser`, UID 1001) untuk meminimalkan attack surface apabila terjadi eksploitasi container.

---

## 8. Referensi API Endpoint

**Base URL:** `http://localhost:5000/api/v1`  
**Dokumentasi Interaktif:** `http://localhost:5000/api-docs` (Swagger UI)

### 8.1 Ringkasan Endpoint

| Method | Endpoint | Autentikasi | Klien |
|--------|----------|-------------|-------|
| `POST` | `/access` | API Key (`X-API-KEY`) | ESP32 / ESP8266 |
| `POST` | `/auth/login` | - | Dasbor admin |
| `GET` | `/auth/refresh-token` | httpOnly Cookie | Dasbor admin |
| `POST` | `/auth/logout` | Bearer JWT | Dasbor admin |
| `GET` | `/users` | Bearer JWT | Dasbor admin |
| `POST` | `/users` | Bearer JWT | Dasbor admin |
| `GET` | `/users/:id` | Bearer JWT | Dasbor admin |
| `PUT` | `/users/:id` | Bearer JWT | Dasbor admin |
| `DELETE` | `/users/:id` | Bearer JWT | Dasbor admin |
| `GET` | `/cards` | Bearer JWT | Dasbor admin |
| `POST` | `/cards` | Bearer JWT | Dasbor admin |
| `PUT` | `/cards/:id` | Bearer JWT | Dasbor admin |
| `DELETE` | `/cards/:id` | Bearer JWT | Dasbor admin |
| `GET` | `/logs` | Bearer JWT | Dasbor admin |
| `GET` | `/system/health` | Bearer JWT | Dasbor admin |
| `POST` | `/face/register` | - | Dasbor / operator |
| `POST` | `/face/inference` | - | ESP32-CAM |

### 8.2 Detail Endpoint Kritis

#### `POST /api/v1/access`

Endpoint yang dipanggil oleh ESP32 setiap kali kartu di-tap. Menerima data dalam format `multipart/form-data`.

**Header wajib:**
```
X-API-KEY: <API_KEY>
Content-Type: multipart/form-data
```

**Body:**
| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `uid` | string | Ya | RFID UID raw dari kartu |
| `room` | string | Ya | Nama ruangan, contoh: `lab-iot` |
| `photo` | file JPEG | Tidak | Foto dari ESP32-CAM, wajib untuk face verification |

**Response (selalu HTTP 200):**
```json
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
```

#### `POST /api/v1/auth/login`

**Content-Type:** `application/json`

```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response sukses:**
```json
{
  "success": true,
  "data": {
    "accessToken": "<JWT 15m>",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "name": "Administrator"
    }
  }
}
```

> `refreshToken` dikirim melalui `Set-Cookie` dengan flag `httpOnly; Secure; SameSite=Strict`.

#### `POST /api/v1/face/register`

**Content-Type:** `multipart/form-data`

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `person_name` | string | Ya | Nama orang yang didaftarkan |
| `user_id` | integer | Tidak | ID pengguna di tabel users |
| `photo_1` | file JPEG | Ya | Foto wajah pertama |
| `photo_2` | file JPEG | Ya | Foto wajah kedua |
| `photo_3` | file JPEG | Ya | Foto wajah ketiga |

### 8.3 Format Response Standar

Seluruh response menggunakan format JSON yang seragam melalui helper `response.js`:

```json
{
  "success": true | false,
  "message": "Deskripsi singkat",
  "data": { ... }
}
```

Untuk error:
```json
{
  "success": false,
  "message": "Pesan error",
  "error": "Detail teknis (hanya di mode development)"
}
```

---

## 9. Konfigurasi Lingkungan

Sistem menggunakan dua file environment terpisah:
- `.env.development.local` - konfigurasi untuk mode development
- `.env.production.local` - konfigurasi untuk mode production

| Variabel | Keterangan | Contoh Nilai |
|----------|------------|--------------|
| `NODE_ENV` | Mode environment aktif | `development` |
| `PORT` | Port server Express | `5000` |
| `API_KEY` | API key untuk autentikasi ESP32 | `168318b6-...` |
| `DATABASE_URL` | PostgreSQL connection string (Neon) | `postgresql://user:pass@host/db` |
| `GCP_BUCKET_NAME` | Nama bucket GCS untuk penyimpanan foto | `capture-security` |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram dari BotFather | `8772799402:AAF...` |
| `TELEGRAM_CHAT_ID` | Chat ID notifikasi personal | `7678671053` |
| `TELEGRAM_GROUP_ID` | Group ID notifikasi grup | `-5196412607` |
| `JWT_SECRET` | Secret key untuk sign access token | String acak 32+ karakter |
| `REFRESH_TOKEN_SECRET` | Secret key untuk sign refresh token | String acak 32+ karakter berbeda dari JWT_SECRET |
| `ML_SERVICE_URL` | URL Python ML service | `http://localhost:8001` |
| `HMAC_SECRET` | Secret key HMAC-SHA256 untuk hashing RFID UID | String hex 32 byte |

**Cara generate `HMAC_SECRET`:**
```bash
node -e "require('crypto').randomBytes(32).toString('hex')"
```

---

## 10. Panduan Instalasi dan Pengoperasian

### 10.1 Prasyarat

- Node.js v20 atau lebih tinggi
- npm v10 atau lebih tinggi
- Akses ke instance PostgreSQL (Neon atau lokal dengan ekstensi pgvector)
- Python ML service aktif (untuk fitur face recognition)

### 10.2 Instalasi Dependencies

```bash
cd smart-room-access-backend
npm install
```

### 10.3 Konfigurasi Environment

```bash
cp .env.example .env.development.local
# Isi semua variabel yang diperlukan
```

### 10.4 Persiapan Basis Data

```bash
# Generate file SQL dari schema Drizzle
npx drizzle-kit generate

# Terapkan migrasi ke database
npx drizzle-kit migrate
```

### 10.5 Seed Data Awal (Opsional)

```bash
npm run db:seed
```

### 10.6 Menjalankan Server

```bash
# Mode development (nodemon auto-reload)
npm run dev

# Mode production
npm start
```

Server aktif di:
- API: `http://localhost:5000`
- Swagger UI: `http://localhost:5000/api-docs`

### 10.7 Skrip yang Tersedia

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Jalankan server development dengan nodemon |
| `npm start` | Jalankan server production |
| `npm run db:seed` | Isi data awal ke database |

---

## 11. Deployment Berbasis Kontainer

### 11.1 Spesifikasi Dockerfile

Dockerfile menggunakan pendekatan **multi-stage build** untuk meminimalkan ukuran image final:

- **Stage 1 (`deps`)**: Install production dependencies dengan `npm ci --omit=dev`
- **Stage 2 (`runner`)**: Runtime image berbasis `node:20-alpine`, hanya menyalin artifact yang diperlukan
- Server berjalan sebagai non-root user `nodeuser` (UID 1001)
- Health check bawaan menggunakan `wget` ke endpoint root

### 11.2 Docker Compose

File `docker-compose.yml` mengorkestrasi dua service secara bersamaan:

```mermaid
graph LR
    DC[docker compose up] --> BE[backend\nNode.js :5000]
    DC --> ML[ml-service\nPython FastAPI :8001]

    BE -->|ML_SERVICE_URL=http://ml-service:8001| ML
    ML -->|healthcheck /health| HC[service_healthy]
    HC -->|depends_on| BE
```

**Kondisi startup:**
- Service `ml-service` harus dalam status `healthy` sebelum `backend` dimulai
- Health check ML service mengakses `GET /health` dengan interval 30 detik dan start period 60 detik (untuk loading model ONNX)

**Menjalankan dengan Docker Compose:**
```bash
# Download model ONNX terlebih dahulu
../ml-service-iot-room/download_models.sh

# Salin dan isi environment
cp .env.example .env.production.local

# Bangun dan jalankan semua service
docker compose up --build
```

---

## 12. Catatan Teknis dan Pertimbangan

### 12.1 Penanganan Timezone

Seluruh timestamp di PostgreSQL disimpan dalam UTC. Validasi jadwal akses (`schedule_start`, `schedule_end`) dilakukan dengan mengkonversi waktu server ke WIB (UTC+7) secara eksplisit:

```javascript
const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
```

Pendekatan ini dipilih karena Cloud Run secara bawaan berjalan pada timezone UTC, sehingga konversi manual lebih dapat diandalkan dibandingkan bergantung pada konfigurasi sistem.

### 12.2 Strategi Lookup RFID

Tabel `cards` menggunakan HMAC-SHA256 (bukan bcrypt) untuk hashing RFID UID. Hal ini memungkinkan query deterministik `WHERE rfid_uid = HMAC(uid, secret)` yang berjalan dalam waktu O(1) dengan unique index, tanpa perlu memuat semua baris dan melakukan perbandingan satu per satu seperti yang terjadi pada bcrypt.

**Estimasi latency per tap kartu (kondisi ML service warm):**
| Tahap | Estimasi Waktu |
|-------|----------------|
| RFID lookup (HMAC + DB query) | < 5ms |
| Face inference (CPU) | 300 - 600ms |
| GCS upload (async, non-blocking) | tidak memblokir response |
| Total keseluruhan | 350 - 650ms |

### 12.3 Backward Compatibility Perangkat

Sistem dirancang untuk kompatibel mundur dengan ESP32 yang tidak memiliki kamera. Jika field `photo` tidak disertakan dalam request, validasi RFID tetap berjalan penuh dan akses dapat diberikan tanpa verifikasi wajah.

### 12.4 Ketahanan terhadap Kegagalan ML Service

Apabila Python ML service tidak dapat dihubungi (timeout, container down), perilaku sistem adalah sebagai berikut:
- Endpoint `/face/register` dan `/face/inference` mengembalikan HTTP `503`
- Endpoint `/access` menolak akses dengan pesan `Face verification gagal` jika foto disertakan
- Backend utama tidak crash dan tetap melayani request RFID-only

### 12.5 Skalabilitas Basis Data

Untuk dataset pengguna yang sangat besar, perlu dipertimbangkan:
- Tabel `face_embeddings` menggunakan pgvector HNSW atau IVFFlat index untuk mempercepat nearest-neighbor search
- Tabel `access_logs` perlu partisi berbasis waktu (partitioning by range) untuk menjaga performa query log historis

---

*Dokumen ini merupakan referensi teknis internal sistem Smart Room Access. Informasi konfigurasi sensitif (API key, secret, token) tidak boleh disertakan dalam dokumen versi publik.*
