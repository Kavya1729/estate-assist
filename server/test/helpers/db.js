import { randomUUID } from 'node:crypto';

import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

import * as models from '../../src/models/index.js';

/** Gives each test file its own database on the shared replica set and cleans it between tests. */
export function useTestDatabase() {
  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `test-${randomUUID()}` });
    await Promise.all(
      Object.values(models)
        .filter((model) => typeof model.syncIndexes === 'function')
        .map((model) => model.syncIndexes()),
    );
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}
