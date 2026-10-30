const mongoose = require('mongoose');

let cachedConnection = global.__vaulttrace_mongo_conn || null;
let cachedMemoryServer = global.__vaulttrace_mongo_memory || null;
let activeDbMode = global.__vaulttrace_db_mode || 'disconnected';

async function syncAllIndexes() {
  const models = Object.values(mongoose.models);
  for (const model of models) {
    try {
      await model.createIndexes();
    } catch (err) {
      console.warn(`[DB] Index creation warning for ${model.modelName}:`, err.message);
    }
  }
}

async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return { connection: cachedConnection, mode: activeDbMode };
  }

  const configuredUri = process.env.MONGODB_URI;

  // 1. Try configured MONGODB_URI first (Atlas or local MongoDB Community Server)
  if (configuredUri) {
    try {
      const conn = await mongoose.connect(configuredUri, {
        serverSelectionTimeoutMS: 3500,
      });
      cachedConnection = conn;
      activeDbMode = configuredUri.includes('mongodb+srv') ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB Server';
      global.__vaulttrace_mongo_conn = cachedConnection;
      global.__vaulttrace_db_mode = activeDbMode;
      console.log(`[VaultTrace DB] Connected to ${activeDbMode}`);
      return { connection: conn, mode: activeDbMode };
    } catch (err) {
      console.warn(`[VaultTrace DB] Primary URI (${configuredUri}) unreachable (${err.message}). Switching to Embedded MongoDB Engine...`);
    }
  }

  // 2. Fallback to Local MongoDB on 127.0.0.1:27017 if no env var set
  if (!configuredUri) {
    try {
      const localUri = 'mongodb://127.0.0.1:27017/vaulttrace_db';
      const conn = await mongoose.connect(localUri, {
        serverSelectionTimeoutMS: 2000,
      });
      cachedConnection = conn;
      activeDbMode = 'Local MongoDB (127.0.0.1:27017)';
      global.__vaulttrace_mongo_conn = cachedConnection;
      global.__vaulttrace_db_mode = activeDbMode;
      console.log(`[VaultTrace DB] Connected to ${activeDbMode}`);
      return { connection: conn, mode: activeDbMode };
    } catch (_) {
      // Proceed to embedded MongoDB server
    }
  }

  // 3. Zero-config Embedded MongoDB Engine (mongodb-memory-server)
  const { MongoMemoryServer } = require('mongodb-memory-server');
  if (!cachedMemoryServer) {
    cachedMemoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'vaulttrace_db',
      },
    });
    global.__vaulttrace_mongo_memory = cachedMemoryServer;
  }

  const memoryUri = cachedMemoryServer.getUri();
  const conn = await mongoose.connect(memoryUri, {
    dbName: 'vaulttrace_db',
  });

  cachedConnection = conn;
  activeDbMode = 'Embedded MongoDB Engine (In-Memory mongod)';
  global.__vaulttrace_mongo_conn = cachedConnection;
  global.__vaulttrace_db_mode = activeDbMode;
  console.log(`[VaultTrace DB] Connected to ${activeDbMode} at ${memoryUri}`);

  return { connection: conn, mode: activeDbMode };
}

function getDbMode() {
  return activeDbMode;
}

module.exports = {
  connectDB,
  syncAllIndexes,
  getDbMode,
};
