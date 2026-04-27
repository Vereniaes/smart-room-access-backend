import { Storage } from '@google-cloud/storage';
import { GCP_BUCKET_NAME } from '../../config/env.js';

const storage = new Storage();  // Uses Application Default Credentials (Cloud Run auto-auth)
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
        public: true,   // Bucket is already public, make object public too
    });

    const publicUrl = `https://storage.googleapis.com/${GCP_BUCKET_NAME}/${filename}`;
    console.log(`[GCS] Uploaded: ${publicUrl}`);
    return publicUrl;
};
