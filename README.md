# Smart Room Access - Backend API

Proyek ini adalah sistem backend RESTful API untuk ekosistem "Smart Room Access". Sistem ini dirancang untuk memvalidasi akses secara _real-time_ berbasis RFID (misal menggunakan mikrokontroler ESP32) serta menyediakan dasbor admin untuk manajemen pengguna dan pemantauan riwayat akses ruangan.

Sistem ini didesain sebagai **Tugas Akhir** (atau purwarupa tingkat akhir) yang sangat mementingkan aspek keamanan berlapis, performa modern (_Serverless Postgres_), serta arsitektur kode berskala produksi (_Repository/Service Pattern_).

---

## 🔥 Fitur Utama

1. **Autentikasi Ganda (Dual-Security Layer)**
   *   **API Key (`X-API-KEY`)**: Dioptimalkan untuk perangkat IoT perangkat keras agar latensi sekecil mungkin dan mempermudah pemrograman pada _board_ seperti ESP32.
   *   **JSON Web Token (JWT)**: Lapisan keamanan kokoh berbasis _session-less_ yang dikhususkan bagi administrator via Dashboard/Web.
2. **Validasi Akses CerdaS**
   *   Verifikasi pendaftaran kartu RFID (UID).
   *   Pengecekan masa aktif kartu (Valid Until).
   *   Pengecekan batas waktu harian presisi format _HH:MM_ (Schedule).
3. **Database Serverless Modern**
   *   Memanfaatkan **Neon Postgres Serverless** untuk memastikan _Zero-Downtime_ di ekosistem _cloud_.
   *   Sistem ORM dikendalikan penuh oleh **Drizzle ORM**, menggantikan Prisma yang lebih rawan _overhead_.
4. **Notifikasi *Real-Time***
   *   Dukungan peringatan log instan langsung ke _group/channel_ menggunakan **Telegram Node Bot API**.

---

## 🛠️ Stack Teknologi Canggih

*   **Pondasi Utama**: Node.js & Express.js
*   **Database Master**: Neon (Serverless PostgreSQL)
*   **Database ORM/Query Builder**: Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
*   **Protokol Keamanan**: JWT (`jsonwebtoken`), BCrypt (`bcryptjs`)
*   **Utilitas Pendukung**: `dotenv`, `cors`, `nodemon`

---

## 📖 Dokumentasi Lengkap

Tata cara pemakaian _endpoint_ untuk mikrokontroler IoT maupun UI Dashboard telah dirangkum dalam file dokumentasi terpisah.  
Silakan pelajari secara komprehensif pada:  
👉 **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

---

## 🚀 Panduan Instalasi (Development)

Jika Anda ingin menjalankan atau mengembangkan kode (kolaborasi) secara lokal:

1. **Clone repositori**
   ```bash
   git clone <URL_REPOSITORI_ANDA>
   cd SmartRoomAccess
   ```

2. **Instal seluruh paket manajer Node (NPM)**
   ```bash
   npm install
   ```

3. **Atur Variabel Lingkungan Lokal**
   Buat file bernama `.env.development.local` di *root* folder.
   
   *(Catatan: Mintalah kunci akses kepada pemilik repo, atau isi sesuai akun Cloud Anda sendiri)* 
   ```env
   NODE_ENV="development"
   PORT="5000"

   API_KEY="<api_key_bebas_untuk_hardware_anda>"

   # DATABASE NEON (Drizzle)
   DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"

   # TELEGRAM (Optional, dapat diabaikan)
   TELEGRAM_BOT_TOKEN="<token>"
   TELEGRAM_CHAT_ID="<chat_id>"
   TELEGRAM_GROUP_ID="<group_id>"

   # JWT
   JWT_SECRET="<random_string_aman_dan_panjang>"
   ```

4. **Kirim/Sinkronkan Skema ke Drizzle Database Anda**
   ```bash
   npx drizzle-kit push
   ```

5. **Buat Akun Admin Pertama (Seeding)**
   ```bash
   npm run db:seed
   ```

6. **Nyalakan Mesin Server!**
   ```bash
   npm run dev
   ```

---
