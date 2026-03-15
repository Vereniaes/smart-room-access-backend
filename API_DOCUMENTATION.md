# Smart Room Access API Documentation

Dokumentasi ini berisi panduan penggunaan dan testing endpoint API untuk sistem backend Smart Room Access. Sistem ini menggunakan dua lapis keamanan:
1.  **API Key**: Digunakan oleh perangkat IoT (ESP32) untuk akses cepat.
2.  **JWT (JSON Web Token)**: Digunakan oleh Dashboard (Frontend) untuk manajemen data.

---

## Base URL
```
http://localhost:5000
```

---

## 1. Authentication API (Dashboard Only)

Digunakan oleh Dashboard untuk mendapatkan token akses.

- **URL:** `/api/v1/auth/login`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
```json
{
  "username": "admin",
  "password": "123"
}
```

### Response Success
```json
{
  "success": true,
  "message": "Login successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 2. Access API (IoT Device / ESP32)

Endpoint validasi akses ruangan. Menggunakan **API Key** di Header.

- **URL:** `/api/v1/access`
- **Method:** `POST`
- **Header:** `X-API-KEY: <your_api_key>`
- **Content-Type:** `application/json`

### Request Body
```json
{
  "uid": "A1B2C3",
  "room": "lab-iot"
}
```

### Response Success
```json
{
  "status": "allowed",
  "message": "Akses berhasil diberikan"
}
```

### Response Failed (Example)
```json
{
  "status": "denied",
  "message": "Akses ditolak di luar jadwal operasional"
}
```

---

## 3. Protected APIs (Dashboard / Admin)

Endpoint berikut memerlukan **JWT Token** yang didapat dari Login API. Token dikirim melalui header `Authorization` dengan format `Bearer <token>`.

### A. Access Logs API
- **URL:** `/api/v1/logs`
- **Method:** `GET`
- **Header:** `Authorization: Bearer <token>`

### B. User Management API
- **URL:** `/api/v1/users`
- **Method:** `GET`, `POST`, `PUT`, `DELETE`
- **Header:** `Authorization: Bearer <token>`

---

## Cara Testing (Tutorial)

### Menggunakan HTTPie / Postman / Insomnia

#### 1. Login Admin
```bash
http POST :5000/api/v1/auth/login username=admin password=123
```
*Salin nilai token yang muncul.*

#### 2. Mengambil Log Akses (Pakai JWT)
```bash
http GET :5000/api/v1/logs "Authorization:Bearer <token_anda>"
```

#### 3. Simulasi ESP32 (Pakai API Key)
```bash
http POST :5000/api/v1/access uid=A1B2C3 room=lab-iot X-API-KEY:<API_KEY>
```

### Menggunakan PowerShell (Invoke-RestMethod)

#### 1. Login
```powershell
$auth = Invoke-RestMethod -Uri http://localhost:5000/api/v1/auth/login -Method Post -Body '{"username":"admin", "password":"123"}' -ContentType 'application/json'
$token = $auth.data.token
```

#### 2. Test User API (CRUD)
**(Create) - Tambah User Baru:**
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/v1/users -Method Post -Headers @{Authorization="Bearer $token"} -Body '{"name": "Budi", "rfid_uid": "AABBCC", "role": "student", "schedule_start": "08:00", "schedule_end": "16:00", "valid_until": "2026-12-31"}' -ContentType 'application/json'
```

**(Read) - Ambil Semua User:**
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/v1/users -Method Get -Headers @{Authorization="Bearer $token"}
```

**(Read by ID) - Ambil User ID 1:**
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/v1/users/1 -Method Get -Headers @{Authorization="Bearer $token"}
```

**(Update) - Ubah Data User ID 1:**
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/v1/users/1 -Method Put -Headers @{Authorization="Bearer $token"} -Body '{"name": "Budi Santoso", "role": "admin"}' -ContentType 'application/json'
```

**(Delete) - Hapus User ID 1:**
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/v1/users/1 -Method Delete -Headers @{Authorization="Bearer $token"}
```

#### 3. Test Access API (Simulasi Kartu Tap)
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/v1/access -Method Post -Headers @{"X-API-KEY"="<API_KEY_ANDA>"} -Body '{"uid":"AABBCC","room":"Lab Jaringan"}' -ContentType 'application/json'
```

#### 4. Cek Hasil Logging Access
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/v1/logs -Method Get -Headers @{Authorization="Bearer $token"}
```

---

## Cara Menjalankan Server
1. `npm install`
2. `npm run dev`
