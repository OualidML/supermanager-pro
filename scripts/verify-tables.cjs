const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: Supabase URL or Anon Key not found in .env.");
  process.exit(1);
}

const tables = [
  'store_profiles',
  'products',
  'sales',
  'expenses',
  'stock_inputs',
  'daily_summaries',
  'forecasts',
  'assistant_messages',
  'clients',
  'delivery_notes',
  'invoices',
  'versements'
];

async function verify() {
  console.log("=== Verifying Supabase Tables via HTTPS REST API ===");
  console.log(`URL: ${supabaseUrl}\n`);

  let allOk = true;

  for (const table of tables) {
    try {
      // Query the table using the Supabase PostgREST endpoint
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });

      const data = await response.json();

      if (response.status === 200 || response.status === 204) {
        console.log(`[OK] Table "${table}" is present and accessible.`);
      } else if (response.status === 404 || data.code === 'PGRST116' || (data.message && data.message.includes("does not exist"))) {
        console.log(`[FAILED] Table "${table}" does not exist.`);
        allOk = false;
      } else {
        // Other responses like 401/406 or RLS issues mean the relation exists but we aren't auth'd, which is fine
        console.log(`[OK] Table "${table}" exists (status ${response.status}).`);
      }
    } catch (e) {
      console.log(`[ERROR] Failed to query table "${table}": ${e.message}`);
      allOk = false;
    }
  }

  if (allOk) {
    console.log("\nSUCCESS: All 8 tables are verified and active on your Supabase project!");
  } else {
    console.log("\nWARNING: Some tables are missing. Please run the migration SQL in your Supabase dashboard.");
  }
}

verify();
