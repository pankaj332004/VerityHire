const path = require('path');
const dotenv = require('dotenv');

// Load environment variables early before connecting to DB
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to MongoDB Database
  await connectDB();

  // Start HTTP Listener
  const server = app.listen(PORT, () => {
    console.log(`🚀 VerityHire Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
  });

  // Handle Unhandled Promise Rejections gracefully
  process.on('unhandledRejection', (err) => {
    console.error(`💥 Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();
