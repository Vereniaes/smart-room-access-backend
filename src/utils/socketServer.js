let io = null

export const setIO = (instance) => {
    io = instance
}

export const emitAccessEvent = (payload) => {
    try {
        if (io) {
            io.emit('access_event', payload)
        }
    } catch (err) {
        console.error('Failed to emit access event', err)
    }
}

export const getIO = () => io
