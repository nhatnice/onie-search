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

  const args = process.argv.slice(2);
  const shouldDrop = args.includes('--drop') || args.includes('--reset');

  if (shouldDrop) {
    console.log('🗑️ Đang xóa các schema cũ (crawler, drizzle) để chạy lại từ đầu...');
    await client.query('DROP SCHEMA IF EXISTS crawler CASCADE;');
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE;');
    console.log('✅ Đã dọn dẹp schema xong!');
  }

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
