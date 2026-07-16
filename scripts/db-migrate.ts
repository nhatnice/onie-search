import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
dotenv.config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  const db = drizzle(client);

  console.log('🔄 Đang chạy migration...');

  try {
    // Trỏ tới thư mục chứa file .sql vừa generate lúc nãy
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migration thành công rực rỡ!');
  } catch (error) {
    console.error('❌ Lỗi chi tiết đây anh ơi:', error);
  } finally {
    await client.end();
  }
}

main();
