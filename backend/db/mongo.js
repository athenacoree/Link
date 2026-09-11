const mongoose = require('mongoose');

async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn('[mongo] ATENCION: no hay MONGODB_URI configurada. Los mensajes de chat no funcionarán hasta que crees un cluster en MongoDB Atlas y pongas la URI en las variables de entorno.');
    return null;
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('[mongo] Conectado a MongoDB Atlas correctamente.');
  return mongoose.connection;
}

module.exports = { connectMongo };
