import swaggerJsdoc from "swagger-jsdoc";
import { PORT, NODE_ENV } from "./env.js";

const servers =
  NODE_ENV === "production"
    ? [{ url: "/", description: "Production server" }]
    : [{ url: `http://localhost:${PORT || 8080}`, description: "Development server" }];

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Smart Room Access API",
      version: "1.0.0",
      description:
        "API server for Smart Room Access system — manages users, RFID-based room access validation, and access logging. Uses two security layers: API Key for IoT devices (ESP32) and JWT for the admin dashboard.",
    },
    servers,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from POST /api/v1/auth/login",
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-KEY",
          description: "API Key for IoT device (ESP32) authentication",
        },
      },
      schemas: {
        // --- Request Schemas ---
        LoginRequest: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", example: "admin" },
            password: { type: "string", example: "admin123" },
          },
        },
        AccessRequest: {
          type: "object",
          required: ["uid", "room"],
          properties: {
            uid: {
              type: "string",
              example: "A1B2C3",
              description: "RFID card UID",
            },
            room: {
              type: "string",
              example: "lab-iot",
              description: "Target room identifier",
            },
          },
        },
        CreateUserRequest: {
          type: "object",
          required: [
            "name",
            "rfid_uid",
            "role",
            "schedule_start",
            "schedule_end",
          ],
          properties: {
            name: { type: "string", example: "Budi" },
            rfid_uid: { type: "string", example: "AABBCC" },
            username: { type: "string", example: "budi_admin", description: "Optional for dashboard access" },
            password: { type: "string", example: "securepass123", description: "Optional for dashboard access" },
            role: { 
              type: "string", 
              enum: ["admin", "staff", "student", "guest"],
              example: "student" 
            },
            schedule_start: {
              type: "string",
              example: "08:00",
              description: "HH:MM format",
            },
            schedule_end: {
              type: "string",
              example: "16:00",
              description: "HH:MM format",
            },
            valid_until: {
              type: "string",
              example: "2026-12-31",
              description: "Expiration date (optional)",
            },
          },
        },

        // --- Response Schemas ---
        User: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "Budi" },
            username: { type: "string", example: "budi_admin", nullable: true },
            rfid_uid: { type: "string", example: "AABBCC" },
            role: { 
              type: "string", 
              enum: ["admin", "staff", "student", "guest"],
              example: "student" 
            },
            schedule_start: { type: "string", example: "08:00" },
            schedule_end: { type: "string", example: "16:00" },
            valid_until: { type: "string", example: "2026-12-31" },
            created_at: {
              type: "string",
              format: "date-time",
              example: "2026-03-15T10:00:00.000Z",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              example: "2026-03-15T10:00:00.000Z",
            },
          },
        },
        AccessLog: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            user_id: { type: "integer", example: 1, nullable: true },
            uid: { type: "string", example: "A1B2C3" },
            access_time: {
              type: "string",
              format: "date-time",
              example: "2026-03-15T10:00:00.000Z",
            },
            status: {
              type: "string",
              enum: ["allowed", "denied"],
              example: "allowed",
            },
            room: { type: "string", example: "lab-iot" },
            message: { type: "string", example: "Akses berhasil diberikan" },
          },
        },
        AccessResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["allowed", "denied"],
              example: "allowed",
            },
            message: {
              type: "string",
              example: "Akses berhasil diberikan",
            },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: {},
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
