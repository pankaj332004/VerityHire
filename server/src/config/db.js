const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers to prevent querySrv ECONNREFUSED issues on Windows / local ISP DNS
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Ignore if not supported in environment
}

/**
 * Normalizes MongoDB URI to handle unencoded special characters (e.g. '@' in passwords)
 * Example: mongodb+srv://user:p@ss@cluster.mongodb.net/db -> mongodb+srv://user:p%40ss@cluster.mongodb.net/db
 */
function normalizeMongoUri(uri) {
  if (!uri) return '';
  const trimmed = uri.trim().replace(/^["']|["']$/g, '');
  
  const prefixMatch = trimmed.match(/^(mongodb(\+srv)?:\/\/)/);
  if (!prefixMatch) return trimmed;
  
  const prefix = prefixMatch[0];
  const rest = trimmed.slice(prefix.length);
  
  // Look for credentials followed by host
  const lastAt = rest.lastIndexOf('@');
  if (lastAt === -1) return trimmed;
  
  const userInfo = rest.slice(0, lastAt);
  const hostAndDb = rest.slice(lastAt + 1);
  
  const firstColon = userInfo.indexOf(':');
  if (firstColon === -1) return trimmed;
  
  const username = userInfo.slice(0, firstColon);
  const password = userInfo.slice(firstColon + 1);
  
  // If password contains raw '@', encode it
  const encodedPassword = encodeURIComponent(decodeURIComponent(password));
  return `${prefix}${username}:${encodedPassword}@${hostAndDb}`;
}

const connectDB = async () => {
  try {
    const rawUri = process.env.MONGO_URI;
    if (!rawUri) {
      console.error('❌ MONGO_URI is not defined in environment variables.');
      process.exit(1);
    }

    const uri = normalizeMongoUri(rawUri);

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error('💡 Tip: Verify your IP whitelist in MongoDB Atlas Network Access and database credentials.');
    process.exit(1);
  }
};

module.exports = connectDB;
