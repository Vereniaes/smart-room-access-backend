// src/utils/gcsUpload.js
//
// -> handling upload dan hapus foto di Google Cloud Storage
//      -> upload foto tap atau foto registrasi
//      -> hapus foto lama saat daftar ulang

import { Storage } from '@google-cloud/storage';
import { GCP_BUCKET_NAME, GCP_CREDENTIALS } from '../../config/env.js';

const storageOptions = {};
if (GCP_CREDENTIALS) {
    if (GCP_CREDENTIALS.trim().startsWith('{')) {
        try {
            storageOptions.credentials = JSON.parse(GCP_CREDENTIALS);
        } catch (err) {
            console.error('[GCS] Failed to parse GCP_CREDENTIALS JSON string:', err.message);
        }
    } else {
        storageOptions.keyFilename = GCP_CREDENTIALS;
    }
}

const storage = new Storage(storageOptions);
const bucket = storage.bucket(GCP_BUCKET_NAME);

/**
 * Upload a photo buffer to GCP Cloud Storage
 * @param {Buffer} buffer - JPEG image buffer
 * @param {string} uid - RFID card UID (used in filename)
 * @returns {string} Public URL of the uploaded file
 */
export const uploadToGcs = async (buffer, uid) => {
    // Filename: photos/YYYYMMDD-HHmmss-UID.jpg
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/T/, '-')
        .replace(/:/g, '')
        .replace(/\..+/, '');
    const cleanUid = uid.replace(/ /g, '');
    const filename = `photos/${timestamp}-${cleanUid}.jpg`;

    const file = bucket.file(filename);

    await file.save(buffer, {
        metadata: { contentType: 'image/jpeg' },
        // public: true tidak diperlukan — bucket sudah uniform public access
    });

    const publicUrl = `https://storage.googleapis.com/${GCP_BUCKET_NAME}/${filename}`;
    console.log(`[GCS] Uploaded: ${publicUrl}`);
    return publicUrl;
};

// delete old photo
export const deleteFromGcs = async (photoUrl) => {
    if (!photoUrl) return;
    try {
        const prefix = `https://storage.googleapis.com/${GCP_BUCKET_NAME}/`;
        if (photoUrl.startsWith(prefix)) {
            const filename = photoUrl.slice(prefix.length);
            await bucket.file(filename).delete({ ignoreNotFound: true });
            console.log(`[GCS] Deleted: ${filename}`);
        }
    } catch (err) {
        console.error('[GCS] Delete error:', err.message);
    }
};

