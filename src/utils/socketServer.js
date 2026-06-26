// src/utils/socketServer.js
//
// -> singleton wrapper untuk Socket.IO instance
//    -> setIO  : dipanggil sekali waktu server start
//    -> getIO  : dipakai service lain buat emit event
//    -> emitAccessEvent : emit event access_event ke semua client

let io = null;

// set instance Socket.IO dari index.js
// input param : instance - Server dari socket.io
export const setIO = (instance) => {
    io = instance;
};

// emit event akses ke semua client yang connect
// input param : payload - object { user_id, user_name, uid, status, room, ... }
export const emitAccessEvent = (payload) => {
    try {
        if (io) {
            io.emit('access_event', payload);
        }
    } catch (err) {
        console.error('Failed to emit access event', err);
    }
};

// getter IO instance
// output : io instance atau null
export const getIO = () => io;
