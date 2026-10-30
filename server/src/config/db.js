const dns = require('dns');
const mongoose = require('mongoose');

// Use Google & Cloudflare DNS resolvers if local ISP/router blocks SRV DNS lookups for mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (_) {
  // Ignore if DNS servers cannot be overridden
}

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

  if (configuredUri && !configuredUri.includes('<db_password>')) {
    try {
      const conn = await mongoose.connect(configuredUri, {
        serverSelectionTimeoutMS: 8000,
        dbName: 'vaulttrace_db',
      });

      cachedConnection = conn;
      activeDbMode = configuredUri.includes('mongodb+srv')
        ? 'MongoDB Atlas (Cluster0)'
        : 'Local MongoDB Server';
      global.__vaulttrace_mongo_conn = cachedConnection;
      global.__vaulttrace_db_mode = activeDbMode;
      console.log(
        `[VaultTrace DB] Connected to ${activeDbMode} (Database: ${mongoose.connection.name})`
      );
      return { connection: conn, mode: activeDbMode };
    } catch (atlasErr) {
      console.warn(
        `[VaultTrace DB] Configured MONGODB_URI unreachable (${atlasErr.message}). Falling back to Embedded MongoDB Engine...`
      );
    }
  } else {
    console.warn(
      '[VaultTrace DB] No .env file / MONGODB_URI found on this machine. Starting Embedded MongoDB Engine...'
    );
  }

    const { MongoMemoryServer } = require('mongodb-memory-server');
    if (!cachedMemoryServer) {
      cachedMemoryServer = await MongoMemoryServer.create({
        instance: { dbName: 'vaulttrace_db' },
      });
      global.__vaulttrace_mongo_memory = cachedMemoryServer;
    }

    const memoryUri = cachedMemoryServer.getUri();
    const conn = await mongoose.connect(memoryUri, { dbName: 'vaulttrace_db' });
    cachedConnection = conn;
    activeDbMode = 'Embedded MongoDB Engine (Offline Fallback)';
    global.__vaulttrace_mongo_conn = cachedConnection;
    global.__vaulttrace_db_mode = activeDbMode;
    console.log(`[VaultTrace DB] Connected to ${activeDbMode}`);
    return { connection: conn, mode: activeDbMode };
  }
}

function getDbMode() {
  return activeDbMode;
}

module.exports = {
  connectDB,
  syncAllIndexes,
  getDbMode,
};
