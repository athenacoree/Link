const mongoose = require('mongoose');

/**
 * Los mensajes de chat viven en MongoDB Atlas (no en Postgres/Render),
 * tal como se pidió: la mensajería real está separada de la base de
 * datos "efímera/estructural" de Render.
 *
 * conversationId = los dos IDs de usuario (de Postgres) ordenados y
 * unidos por "_", ej: "11111111-...._22222222-....". Así siempre se
 * puede reconstruir sin tener que guardar una tabla de conversaciones
 * en Mongo.
 */
const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  senderId:   { type: String, required: true, index: true },
  receiverId: { type: String, required: true, index: true },
  text:       { type: String, default: '' },
  imageData:  { type: String, default: null }, // base64 opcional
  delivered:  { type: Boolean, default: false },
  read:       { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now, index: true },
});

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
