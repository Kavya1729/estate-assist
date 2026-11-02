import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const { host, name } = mongoose.connection;
  console.log(`MongoDB connected (${host}/${name})`);
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

export function disconnectDatabase() {
  return mongoose.disconnect();
}
