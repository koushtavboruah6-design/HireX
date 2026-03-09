const mongoose = require('mongoose');

// Disable Mongoose buffering globally — fail fast instead of hanging
mongoose.set('bufferCommands', false);

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_proctoring';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      bufferCommands: false,
    });
    isConnected = true;
    console.log('[DB] MongoDB connected:', uri.replace(/\/\/.*@/, '//***@'));
  } catch (err) {
    isConnected = false;
    console.warn('[DB] MongoDB unavailable — running in memory-only mode.');
    console.warn('[DB] Start MongoDB or set MONGODB_URI to enable persistence.');
  }
}

function getIsConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, getIsConnected };
