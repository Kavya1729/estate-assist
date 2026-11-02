import { MongoMemoryReplSet } from 'mongodb-memory-server';

/** One in-memory replica set for the whole run; replica sets support the booking transactions. */
export default async function setup({ provide }) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  provide('mongoUri', replSet.getUri());

  return async () => {
    await replSet.stop();
  };
}
