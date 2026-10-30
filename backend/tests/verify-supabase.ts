import { pool } from '../src/config/db';

async function checkSupabase() {
  console.log('--- Verifying Live Supabase Database Connection ---');
  
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('\n✅ Tables in public schema:');
  tables.rows.forEach((r) => console.log(`   • ${r.table_name}`));

  const users = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  const policies = await pool.query('SELECT COUNT(*)::int AS count FROM policies');
  const scans = await pool.query('SELECT COUNT(*)::int AS count FROM scans');
  const findings = await pool.query('SELECT COUNT(*)::int AS count FROM findings');

  console.log('\n📊 Live Supabase Row Counts:');
  console.log(`   • users:    ${users.rows[0].count}`);
  console.log(`   • policies: ${policies.rows[0].count}`);
  console.log(`   • scans:    ${scans.rows[0].count}`);
  console.log(`   • findings: ${findings.rows[0].count}`);

  await pool.end();
  console.log('\n🎉 Supabase PostgreSQL connection and tables verified successfully!');
}

checkSupabase().catch((err) => {
  console.error('Supabase check error:', err);
  process.exit(1);
});
