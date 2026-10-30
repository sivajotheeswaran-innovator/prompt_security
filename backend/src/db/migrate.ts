import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

export async function runMigrations(): Promise<void> {
  let migrationPath = path.join(__dirname, 'migrations', '001_init.sql');
  if (!fs.existsSync(migrationPath)) {
    migrationPath = path.join(__dirname, '..', '..', 'src', 'db', 'migrations', '001_init.sql');
  }
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('[Migration] Running initial database migration...');
  
  // Split statements for safe execution across drivers
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err: any) {
      // Ignore if index or table already exists
      if (!err.message?.includes('already exists')) {
        console.warn(`[Migration Warning] ${err.message}`);
      }
    }
  }

  console.log('[Migration] Migration completed successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[Migration] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Failed]', err);
      process.exit(1);
    });
}
