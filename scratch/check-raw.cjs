const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

async function checkRaw() {
  const url = `${supabaseUrl}/rest/v1/store_profiles?select=employee_pin&limit=1`;
  const response = await fetch(url, {
    headers: { 'apikey': supabaseAnonKey }
  });
  console.log("Status:", response.status);
  console.log("Body:", await response.text());
}

checkRaw();
