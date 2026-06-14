// src/services/faceService.js
//
// -> handling API calls ke ML service dan operasi database untuk Face Recognition
//    -> memanggil /face/register untuk ekstrak embedding
//    -> memanggil /face/inference untuk ekstrak embedding dari 1 foto
//    -> menggunakan pgvector untuk pencarian kemiripan (cosine similarity)

import axios from 'axios';
import FormData from 'form-data';
import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../database/sql.js';
import { faceEmbeddings, users } from '../database/schema.js';
import { ML_SERVICE_URL } from '../../config/env.js';
import { uploadToGcs } from '../utils/gcsUpload.js';

const ML_BASE = ML_SERVICE_URL || 'http://localhost:8001';

// helper: panggil multipart API ke ML service
async function forwardMultipart(files, fields, path) {
    const form = new FormData();

    // tambah text fields
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) {
            form.append(key, String(value));
        }
    }

    // tambah file fields
    for (const file of files) {
        form.append(file.fieldname, file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype,
        });
    }

    const response = await axios.post(`${ML_BASE}${path}`, form, {
        headers: form.getHeaders(),
        timeout: 30000,
    });

    return response.data;
}

// ------------------------------------------------------------------------------------------

// Register Face: panggil ML API, simpan embedding ke database beserta GCS public URL
export async function registerFace(personName, userId, photoFiles) {
    // panggil ML service untuk mendapatkan 3 array embedding
    const mlResponse = await forwardMultipart(
        photoFiles,
        {},
        '/face/register'
    );

    const data = mlResponse.data;
    const embeddings = data.embeddings;

    // simpan ke database beserta URL GCS
    for (let i = 0; i < embeddings.length; i++) {
        let photoUrl = null;
        if (photoFiles[i] && photoFiles[i].buffer) {
            try {
                const identifier = `${personName.replace(/\s+/g, '_')}_reg_${i + 1}`;
                photoUrl = await uploadToGcs(photoFiles[i].buffer, identifier);
            } catch (err) {
                console.error(`[GCS] Gagal mengunggah foto registrasi ke-${i + 1}:`, err.message);
            }
        }

        await db.insert(faceEmbeddings).values({
            person_name: personName,
            user_id: userId || null,
            embedding: embeddings[i],
            photo_index: i + 1,
            photo_url: photoUrl,
        });
    }

    return {
        person_name: personName,
        embeddings_saved: embeddings.length,
        similarity_scores: data.similarity_scores,
    };
}

// Inference Face: panggil ML API untuk 1 embedding, cari kemiripan di DB pakai pgvector
export async function inferFace(photoFile) {
    // panggil ML service
    const mlResponse = await forwardMultipart(
        [photoFile],
        {},
        '/face/inference'
    );

    const mlData = mlResponse.data;
    const queryEmbedding = mlData.embedding;

    // format embedding array ke format yang diterima pgvector string
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    // cari similarity menggunakan operator cosine distance (<=>)
    // 1 - (embedding <=> query) = cosine similarity
    const MATCH_THRESHOLD = 0.40;
    
    const results = await db.execute(sql`
        SELECT 
            person_name, 
            user_id, 
            1 - (embedding <=> ${vectorStr}::vector) AS similarity 
        FROM face_embeddings 
        ORDER BY embedding <=> ${vectorStr}::vector 
        LIMIT 1
    `);

    const bestMatch = results.rows[0];

    if (bestMatch && bestMatch.similarity >= MATCH_THRESHOLD) {
        return {
            matched: true,
            person_name: bestMatch.person_name,
            user_id: bestMatch.user_id,
            similarity: parseFloat(bestMatch.similarity.toFixed(4)),
            gender: mlData.gender,
            age: mlData.age,
            bbox: mlData.bbox,
            score: mlData.score,
        };
    } else {
        return {
            matched: false,
            person_name: "Unknown",
            user_id: null,
            similarity: bestMatch ? parseFloat(bestMatch.similarity.toFixed(4)) : 0,
            gender: mlData.gender,
            age: mlData.age,
            bbox: mlData.bbox,
            score: mlData.score,
        };
    }
}
