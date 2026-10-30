const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getDbMode, connectDB } = require('./config/db');
const { seedDatabase } = require('./utils/seedData');

const authRoutes = require('./routes/authRoutes');
const lostReportRoutes = require('./routes/lostReportRoutes');
const foundItemRoutes = require('./routes/foundItemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dbmsLabRoutes = require('./routes/dbmsLabRoutes');

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Ensure database is connected and auto-seeded on first request (critical for Vercel serverless & zero-config local runs)
let isInitialized = false;
app.use(async (req, res, next) => {
  try {
    await connectDB();
    if (!isInitialized) {
      await seedDatabase({ forceReset: false });
      isInitialized = true;
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'VaultTrace API — Intelligent Lost & Found Object Tracking System',
    dbMode: getDbMode(),
    timestamp: new Date().toISOString(),
  });
});

// Mount REST Routes per Section 9 API Plan
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', authRoutes); // Exposes GET /api/users/me
app.use('/api/lost-reports', lostReportRoutes);
app.use('/api/found-items', foundItemRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dbms-lab', dbmsLabRoutes);

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('[VaultTrace API Error]:', err.message);
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: `Validation Error: ${Object.values(err.errors)
        .map((e) => e.message)
        .join(', ')}`,
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: `Duplicate Key Constraint Violation: ${JSON.stringify(err.keyValue)} already exists.`,
    });
  }
  return res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

module.exports = app;
