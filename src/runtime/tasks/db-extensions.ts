import { useDatabase } from 'nitro/database';
import { defineTask } from 'nitro/task';

export default defineTask({
  meta: { name: 'db:create-extensions', description: 'Enable ParadeDB pg_search extension' },
  async run() {
    const dbConfig = useDatabase();
    // db0's exec accepts a raw SQL string
    await dbConfig.exec('CREATE EXTENSION IF NOT EXISTS pg_search');
    return { result: 'ParadeDB pg_search extension ready' };
  },
});
