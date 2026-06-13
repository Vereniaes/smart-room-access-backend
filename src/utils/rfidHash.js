// src/utils/rfidHash.js
//
// -> utility untuk hash RFID UID pakai HMAC-SHA256
//    -> deterministic: input yang sama selalu menghasilkan hash yang sama
//    -> aman: tidak bisa di-reverse tanpa secret key
//    -> tujuan: menggantikan bcrypt untuk RFID UID supaya bisa pakai DB index
// -> kenapa tidak bcrypt:
//    -> bcrypt non-deterministic (salt random) -> tidak bisa WHERE rfid_uid = ?
//    -> bcrypt dibuat untuk password (work factor tinggi) -> lambat O(n) per request
//    -> RFID UID bukan password user, cukup HMAC dengan server secret

import crypto from 'crypto';
import { HMAC_SECRET } from '../../config/env.js';

// helper ---------------------------------------------------------------------------------

// fungsi hash RFID UID dengan HMAC-SHA256
// input param : uid -> string raw RFID UID dari ESP32 (contoh: "7B E6 40 02")
// output : string hex 64 karakter (SHA-256 output)
// note   : HMAC_SECRET dari env - harus dijaga kerahasiaannya
export const hashRfidUid = (uid) => {
    if (!HMAC_SECRET) {
        throw new Error('HMAC_SECRET tidak ada di environment - wajib diisi untuk keamanan RFID');
    }
    return crypto
        .createHmac('sha256', HMAC_SECRET)
        .update(uid.trim())           // trim whitespace supaya "7B E6 40 02" == "7B E6 40 02 "
        .digest('hex');               // output: 64-char hex string
};

// end of helper --------------------------------------------------------------------------
