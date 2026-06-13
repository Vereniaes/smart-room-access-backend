import fs from 'fs';
import { inferFace, registerFace } from './src/services/faceService.js';

async function testInference() {
    console.log("=== Testing Face Service (Backend -> Cloud Run ML Service) ===");
    try {
        const photoBuffer = fs.readFileSync('face1.jpg');
        const photoFile = {
            buffer: photoBuffer,
            fieldname: 'photo',
            originalname: 'face1.jpg',
            mimetype: 'image/jpeg'
        };

        console.log("\n[1] Testing Inference Endpoint...");
        const inferenceResult = await inferFace(photoFile);
        console.log("Inference Result:", JSON.stringify(inferenceResult, null, 2));

        console.log("\n[2] Testing Registration Endpoint (using same photo 3x)...");
        const photoFiles = [
            { ...photoFile, fieldname: 'photo_1' },
            { ...photoFile, fieldname: 'photo_2' },
            { ...photoFile, fieldname: 'photo_3' }
        ];
        
        const regResult = await registerFace("Messi Test", null, photoFiles);
        console.log("Registration Result:", JSON.stringify(regResult, null, 2));

        console.log("\n[3] Testing Inference Again (should match now)...");
        const matchResult = await inferFace(photoFile);
        console.log("Second Inference Result:", JSON.stringify(matchResult, null, 2));

    } catch(err) {
        if(err.response) {
            console.error("API Error:", err.response.data);
        } else {
            console.error("Error:", err.message);
        }
    }
    process.exit(0);
}

testInference();
