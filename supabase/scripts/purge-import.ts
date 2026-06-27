import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';

function parseEnvFile(filePath: string): { [key: string]: string } {
  const content = fs.readFileSync(filePath, 'utf8');
  const env: { [key: string]: string } = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  }
  return env;
}

async function loadConfig(envFilePath: string): Promise<{ url: string; key: string }> {
  const resolvedPath = path.resolve(envFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Environment config file not found at: ${resolvedPath}`);
  }

  const ext = path.extname(resolvedPath).toLowerCase();

  if (ext === '.ts' || ext === '.js') {
    const fileUrl = resolvedPath.startsWith('/') || resolvedPath.includes(':') 
      ? `file://${resolvedPath.replace(/\\/g, '/')}` 
      : resolvedPath;

    const mod = await import(fileUrl);
    const config = mod.environment || mod.default || mod;
    
    const url = config.supabaseUrl;
    const key = config.supabaseKey || config.supabaseAnonKey;
    
    if (!url || !key) {
      throw new Error(`Loaded TS config lacks 'supabaseUrl' or 'supabaseKey' / 'supabaseAnonKey' properties.`);
    }
    return { url, key };
  } else {
    const envData = parseEnvFile(resolvedPath);
    const url = envData['VITE_SUPABASE_URL'] || envData['SUPABASE_URL'] || envData['supabaseUrl'];
    const key = envData['VITE_SUPABASE_ANON_KEY'] || envData['SUPABASE_ANON_KEY'] || envData['supabaseKey'] || envData['supabaseAnonKey'];

    if (!url || !key) {
      throw new Error(`Loaded env file lacks Supabase URL/Key.`);
    }
    return { url, key };
  }
}

async function authenticateUser(supabase: any) {
  const email = 'test-import-agent@example.com';
  const password = 'TestPassword123!';

  console.log(`Authenticating as ${email}...`);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (!signInError && signInData.session) {
    console.log("✅ Authenticated successfully!");
    return;
  }

  throw new Error(`Authentication failed: User must be signed up first. Run the import script once to auto-create the user.`);
}

function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      const val = answer.trim();
      resolve(val === "Y" || val.toLowerCase() === "yes");
    });
  });
}

function printUsage() {
  console.log("\nUsage:");
  console.log("  npx tsx supabase/scripts/purge-import.ts --env-file <config_path>\n");
  console.log("Required Arguments:");
  console.log("  -e, --env-file   Path to Angular environment TS file (e.g. src/environments/environment.ts) or .env file\n");
}

async function run() {
  console.log("=== 🧹 Starting Roadmap Import Staging Purge ===");

  const args = process.argv.slice(2);
  let envFileArg = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env-file' || args[i] === '-e') {
      envFileArg = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  if (!envFileArg) {
    console.error("❌ Error: --env-file is a required argument.");
    printUsage();
    process.exit(1);
  }

  // Load configuration
  console.log(`Loading environment configuration from: ${envFileArg}`);
  const { url, key } = await loadConfig(envFileArg);

  // Initialize Client
  const supabase = createClient(url, key, {
    auth: { persistSession: false }
  });

  // Authenticate
  await authenticateUser(supabase);

  // 1. Get counts before deletion for visual verification
  const { count: batchCountBefore, error: countBatchErr } = await supabase
    .from('roadmap_import_batches')
    .select('*', { count: 'exact', head: true });

  const { count: stagingCountBefore, error: countStagingErr } = await supabase
    .from('roadmap_import_budget')
    .select('*', { count: 'exact', head: true });

  if (countBatchErr || countStagingErr) {
    throw new Error(`Failed to retrieve pre-purge counts: ${countBatchErr?.message || countStagingErr?.message}`);
  }

  // Display Warning
  console.log("\n⚠️  WARNING: You are about to purge staging data!");
  console.log(`📍 TARGET DATABASE URL : ${url}`);
  console.log(`📦 BATCHES FOUND      : ${batchCountBefore}`);
  console.log(`📊 STAGING RECORDS    : ${stagingCountBefore}`);

  if (batchCountBefore === 0) {
    console.log("\n✨ Database staging tables are already empty. Nothing to purge.");
    return;
  }

  // Request Confirmation
  const confirmed = await askConfirmation(
    "\n❓ Are you sure you want to permanently delete all staging records on this database? (Y(yes)/N): ",
  );
  if (!confirmed) {
    console.log("❌ Purge aborted by user.");
    process.exit(0);
  }

  // 2. Perform purge
  console.log("\nPurging all batches (cascading to budget import)...");
  
  const { error: deleteError } = await supabase
    .from('roadmap_import_batches')
    .delete()
    .neq('status', 'non_existent_status_to_match_all_rows');

  if (deleteError) {
    throw new Error(`Purge failed: ${deleteError.message}`);
  }

  // 3. Confirm deletion counts
  const { count: batchCountAfter } = await supabase
    .from('roadmap_import_batches')
    .select('*', { count: 'exact', head: true });

  const { count: stagingCountAfter } = await supabase
    .from('roadmap_import_budget')
    .select('*', { count: 'exact', head: true });

  console.log(`\nRemaining after purge:`);
  console.log(`- Batches: ${batchCountAfter}`);
  console.log(`- Staging budget records: ${stagingCountAfter}`);
  console.log("\n✅ Database import tables successfully purged!");
}

run().catch((error) => {
  console.error("❌ Purge script failed with error:", error);
  process.exit(1);
});
