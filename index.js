import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './config/swagger.js'
import { NODE_ENV, PORT } from './config/env.js'
import apiRoutes from './src/routes/index.js'
import { errorHandler } from './src/middleware/errorHandler.js'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import http from 'http'
import { Server } from 'socket.io'
import { setIO } from './src/utils/socketServer.js'

const app = express()

const corsOptions = {
    origin:
        NODE_ENV === 'production'
            ? [
                  'https://smart-room-access-backend-196827089960.asia-southeast2.run.app',
                  'https://your-dashboard-domain.com',
              ]
            : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

// Swagger API Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Main API Route
app.use('/api/v1', apiRoutes)

app.get('/', (req, res) => {
    res.send('Smart Room Access Server is running!')
})

// Use global error handler
app.use(errorHandler)

const port = PORT || 8080

// Create HTTP server and attach Socket.IO
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: corsOptions.origin,
        credentials: true,
    },
})

setIO(io)

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id)
    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id)
    })
})

server.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port} in ${NODE_ENV} mode`)
})
