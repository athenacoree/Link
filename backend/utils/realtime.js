/**
 * Puente simple entre las rutas REST y Socket.io.
 * server.js llama a setIO(io) una vez al arrancar; desde cualquier
 * ruta podemos luego avisar en tiempo real a un usuario conectado
 * (notificaciones, mensajes, estado de amistad, llamadas, etc.)
 * sin tener que pasar "io" manualmente por todos lados.
 */
let ioRef = null;
const onlineUsers = new Map(); // userId -> Set(socketId)

function setIO(io) {
  ioRef = io;
}

function registerSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function unregisterSocket(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (!set.size) onlineUsers.delete(userId);
}

function isOnline(userId) {
  return onlineUsers.has(userId);
}

function emitToUser(userId, event, payload) {
  if (!ioRef) return;
  const set = onlineUsers.get(userId);
  if (!set) return;
  for (const socketId of set) {
    ioRef.to(socketId).emit(event, payload);
  }
}

module.exports = { setIO, registerSocket, unregisterSocket, isOnline, emitToUser };
