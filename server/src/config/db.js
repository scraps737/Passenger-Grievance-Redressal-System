import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri = env.mongodbUri) {
  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err.message);
  });
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
