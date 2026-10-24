require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const { initBlockchain } = require('./services/blockchainService');

const PORT = process.env.PORT || 5000;
const User = require('./models/User');
const seedData = require('./scripts/seed');

async function startServer() {
  try {
    console.log('--- Initializing Blood Supply Chain API ---');
    await connectDB();
    const userCount = await User.countDocuments();

if (userCount === 0) {
  console.log('[Demo] Creating demonstration accounts...');
  await seedData({ manageConnection: false });
}
    initBlockchain();

    const server = app.listen(PORT, () => {
      console.log(`[API Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`[API Server] Base URL: http://localhost:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received. Shutting down gracefully.');
      server.close(() => {
        console.log('HTTP server closed.');
      });
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
