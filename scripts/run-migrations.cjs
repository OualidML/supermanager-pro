const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const PROJECT_REF = 'aidycemoxnfvhhvszggo';
const MIGRATION_FILE = path.join(__dirname, '..', 'supabase', 'migrations', '20260709000000_init_schema.sql');

// 1. Ensure 'pg' package is installed
try {
  require.resolve('pg');
} catch (e) {
  console.log("Installing 'pg' (node-postgres) dependency locally...");
  execSync('npm install pg', { stdio: 'inherit' });
  console.log("'pg' installed successfully.\n");
}

const { Client } = require('pg');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function run() {
  console.log("=== Supabase Database Migration Runner ===");
  console.log(`Target Supabase Project Ref: ${PROJECT_REF}`);
  console.log(`Migration File: ${MIGRATION_FILE}\n`);

  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`Error: Migration file not found at ${MIGRATION_FILE}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(MIGRATION_FILE, 'utf8');

  console.log("Choose connection method:");
  console.log("1. Enter Database Password (will auto-construct postgresql:// URL)");
  console.log("2. Paste full PostgreSQL Connection URI");
  
  const choice = await askQuestion("Select option (1 or 2): ");
  let connectionString = '';

  if (choice.trim() === '2') {
    const password = await askQuestion("Enter your Supabase Database Password: ");
    let uri = await askQuestion("Paste your PostgreSQL connection URI (with [YOUR-PASSWORD] inside): ");
    connectionString = uri.replace(/\[your-password\]/i, encodeURIComponent(password.trim()));
  } else {
    const password = await askQuestion("Enter your Supabase Database Password: ");
    const escapedPassword = encodeURIComponent(password.trim());
    connectionString = `postgresql://postgres:${escapedPassword}@db.${PROJECT_REF}.supabase.co:6543/postgres?sslmode=require`;
  }

  rl.close();

  console.log("\nConnecting to Supabase Database...");
  const client = new Client({
    connectionString: connectionString.trim(),
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    
    console.log("Executing SQL Migrations...");
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log("SQL Migration executed successfully!\n");

    // 2. Verification query
    console.log("Verifying table creation...");
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const createdTables = res.rows.map(r => r.table_name);
    const expectedTables = [
      'assistant_messages',
      'daily_summaries',
      'expenses',
      'forecasts',
      'products',
      'sales',
      'stock_inputs',
      'store_profiles'
    ];

    console.log("\nVerification Summary:");
    let allExist = true;
    for (const table of expectedTables) {
      const exists = createdTables.includes(table);
      if (exists) {
        console.log(`[OK] Table "${table}" created successfully.`);
      } else {
        console.log(`[FAILED] Table "${table}" is missing.`);
        allExist = false;
      }
    }

    if (allExist) {
      console.log("\nSUCCESS: All 8 target tables are present and verified in the database schema.");
    } else {
      console.log("\nWARNING: Some tables could not be verified. Please check logs for errors.");
    }

  } catch (error) {
    console.error("\nMigration Execution Error:");
    console.error(error.message);
    try {
      await client.query('ROLLBACK');
    } catch (e) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
