require('dotenv').config({ path: '../.env' });
require('dotenv').config();

const { connectDB } = require('../config/db');
const { seedDatabase } = require('./seedData');

(async () => {
  try {
    await connectDB();
    const res = await seedDatabase({ forceReset: true });
    console.log('[SeedRunner] Completed successfully:', res);
    process.exit(0);
  } catch (err) {
    console.error('[SeedRunner] Failed:', err);
    process.exit(1);
  }
})();
