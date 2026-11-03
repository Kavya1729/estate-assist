import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import * as models from '../models/index.js';
import { STAFF } from './data/staff.js';
import { DEMO_PASSWORD, seedDatabase } from './seedDatabase.js';

/** `npm run seed`: wipes the database in MONGODB_URI and loads the demo data. */
if (env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Run with --force if you are sure.');
  process.exit(1);
}

await connectDatabase(env.MONGODB_URI);
try {
  await Promise.all(
    Object.values(models)
      .filter((model) => typeof model.syncIndexes === 'function')
      .map((model) => model.syncIndexes()),
  );
  const summary = await seedDatabase({ password: env.SEED_PASSWORD ?? DEMO_PASSWORD });

  console.log('\nSeeded:');
  console.table(summary);
  console.log(`Staff logins (password from SEED_PASSWORD, default ${DEMO_PASSWORD}):`);
  console.table(STAFF.map(({ name, email, role }) => ({ name, email, role })));
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
