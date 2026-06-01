import cloudinary from "cloudinary"
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } from "../../config/env.js";

cloudinary.v2.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
})
/**
 * @param {Buffer} buffer buffer from ESP32
 * @param {string} uid RFID card UID
 * @returns {Promise<string>} public url of the uploaded image
 */

export const uploadToCloudinary = (buffer, uid) => {
    return new Promise((resolve, reject) => {
        const cleanUid = uid ? uid.replace(/ /g, '') : 'unknown'
        const publicId = `access_${Date.now()}_${cleanUid}`

        const uploadStream = cloudinary.v2.uploader.upload_stream(
            {
                folder: "smart_room_access",
                public_id: publicId,
                format: "jpg",
                transformation: [{ quality: "auto:good"}]
            },
            (error, result) => {
                if (error) {
                    return reject(error)
                }
                console.log(`Upload berhasil: ${result.secure_url}`);
                resolve(result.secure_url)
            }
        )
        uploadStream.end(buffer)
    })
}