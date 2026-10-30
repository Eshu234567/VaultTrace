require('dotenv').config({ path: '../.env' });
require('dotenv').config();

const cron = require('node-cron');
const app = require('./app');
const { connectDB, getDbMode } = require('./config/db');
const { seedDatabase } = require('./utils/seedData');
const { runRetentionEligibilityScan } = require('./services/retentionService');
const { runFullReconciliation } = require('./services/matchingService');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    const seedResult = await seedDatabase({ forceReset: false });
    if (seedResult.seeded) {
      console.log('[VaultTrace Seed] Populated initial campus dataset:', seedResult.counts);
    }

    // Scheduled Daily Jobs (node-cron):
    // 1. Daily 02:00 AM Retention Eligibility Scan (never hard-deletes; moves expired Stored items to Disposal Review)
    cron.schedule('0 2 * * *', async () => {
      console.log('[VaultTrace Cron] Running daily retention eligibility scan...');
      await runRetentionEligibilityScan();
    });

    // 2. Nightly 03:00 AM Matching Reconciliation Job
    cron.schedule('0 3 * * *', async () => {
      console.log('[VaultTrace Cron] Running nightly lost-to-found matching reconciliation...');
      await runFullReconciliation();
    });

    app.listen(PORT, () => {
      console.log(`==================================================================`);
      console.log(`  VaultTrace API Server listening on http://localhost:${PORT}`);
      console.log(`  Database Engine: ${getDbMode()}`);
      console.log(`==================================================================`);
    });
  } catch (err) {
    console.error('[VaultTrace Startup Fatal]:', err);
    process.exit(1);
  }
}

startServer();
