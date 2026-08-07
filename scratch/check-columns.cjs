const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

async function checkColumns() {
  console.log("=== Checking Employee Mode Columns ===");

  const checks = [
    { table: 'store_profiles', column: 'employee_pin' },
    { table: 'store_profiles', column: 'employee_mode_enabled' },
    { table: 'store_profiles', column: 'last_employee_access' },
    { table: 'products', column: 'show_to_employee' },
    { table: 'sales', column: 'recorded_by' }
  ];

  let allOk = true;

  for (const check of checks) {
    const url = `${supabaseUrl}/rest/v1/${check.table}?select=${check.column}&limit=1`;
    const response = await fetch(url, {
      headers: { 'apikey': supabaseAnonKey }
    });

    const text = await response.text();
    let body = {};
    try { body = JSON.parse(text); } catch (e) {}

    const notExists = (response.status === 400 && body.message && body.message.includes("does not exist"));

    if (notExists) {
      console.log(`[MISSING] Table "${check.table}" -> Column "${check.column}" does NOT exist.`);
      allOk = false;
    } else {
      console.log(`[OK] Table "${check.table}" -> Column "${check.column}" verified successfully.`);
    }
  }

  if (allOk) {
    console.log("\nSUCCESS: All columns are present and active in your database!");
  } else {
    console.log("\nWARNING: Some columns are missing. Please execute the SQL migration script in your Supabase SQL Editor.");
  }
}

checkColumns();
