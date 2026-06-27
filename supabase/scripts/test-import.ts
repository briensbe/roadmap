import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { TriskellImportProcessor } from '../../src/services/import/TriskellImportProcessor';

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
    // Dynamically import the TypeScript/JavaScript environment file
    // We append a file:// protocol for Windows-compatibility of ESM dynamic imports
    const fileUrl = resolvedPath.startsWith('/') || resolvedPath.includes(':') 
      ? `file://${resolvedPath.replace(/\\/g, '/')}` 
      : resolvedPath;

    const mod = await import(fileUrl);
    const config = mod.environment || mod.default || mod;
    
    const url = config.supabaseUrl || config.supabaseUrl;
    const key = config.supabaseKey || config.supabaseAnonKey;
    
    if (!url || !key) {
      throw new Error(`Loaded TS config lacks 'supabaseUrl' or 'supabaseKey' / 'supabaseAnonKey' properties.`);
    }
    return { url, key };
  } else {
    // Treat as key-value file (e.g. .env)
    const envData = parseEnvFile(resolvedPath);
    const url = envData['VITE_SUPABASE_URL'] || envData['SUPABASE_URL'] || envData['supabaseUrl'];
    const key = envData['VITE_SUPABASE_ANON_KEY'] || envData['SUPABASE_ANON_KEY'] || envData['supabaseKey'] || envData['supabaseAnonKey'];

    if (!url || !key) {
      throw new Error(`Loaded env file lacks Supabase URL/Key. Expected keys: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY etc.`);
    }
    return { url, key };
  }
}

async function authenticateUser(supabase: any) {
  const email = 'test-import-agent@example.com';
  const password = 'TestPassword123!';

  console.log(`Authenticating as ${email}...`);
  // Try to sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (!signInError && signInData.session) {
    console.log("✅ Authenticated successfully!");
    return;
  }

  // If sign in fails, attempt sign up
  console.log("Sign in failed. Attempting auto sign up...");
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    throw new Error(`Authentication failed during sign up: ${signUpError.message}`);
  }

  if (signUpData.session) {
    console.log("✅ Signed up and authenticated successfully!");
  } else {
    console.log("User registered but session is pending. Attempting sign-in fallback...");
    const { error: finalSignInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (finalSignInError) {
      throw new Error(`Failed to sign in after registration: ${finalSignInError.message}`);
    }
    console.log("✅ Authenticated successfully after registration!");
  }
}

function printUsage() {
  console.log("\nUsage:");
  console.log("  npx tsx supabase/scripts/test-import.ts --file <excel_path> --env-file <config_path>\n");
  console.log("Required Arguments:");
  console.log("  -f, --file       Path to the Excel file to import");
  console.log("  -e, --env-file   Path to Angular environment TS file (e.g. src/environments/environment.ts) or .env file\n");
}

async function run() {
  console.log("=== 🚀 Starting Roadmap Excel Import Integration Test ===");

  const args = process.argv.slice(2);
  let fileArg = '';
  let envFileArg = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' || args[i] === '-f') {
      fileArg = args[i + 1];
      i++;
    } else if (args[i] === '--env-file' || args[i] === '-e') {
      envFileArg = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  if (!fileArg || !envFileArg) {
    console.error("❌ Error: Both --file and --env-file are required arguments.");
    printUsage();
    process.exit(1);
  }

  // Load database configuration
  console.log(`Loading environment configuration from: ${envFileArg}`);
  const { url, key } = await loadConfig(envFileArg);

  // Initialize Supabase Client
  const supabase = createClient(url, key, {
    auth: { persistSession: false }
  });

  // Authenticate
  await authenticateUser(supabase);

  // Locate the Excel file
  const filePath = path.resolve(fileArg);
  const filename = path.basename(filePath);
  console.log(`Excel file path: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found at: ${filePath}`);
  }

  // Run the Import Processor
  const processor = new TriskellImportProcessor(supabase);
  const result = await processor.processImport(filePath, filename);

  // Verification query: Fetch first 3 inserted records to preview category values
  const { data: previewRows, error: previewErr } = await supabase
    .from('roadmap_import_budget')
    .select('budget_type, budget_nomenclature, budget_object, activity_type, project_name')
    .eq('batch_id', result.batchId)
    .limit(3);

  console.log("\n=== 📊 Import Summary ===");
  console.log(`Batch ID:                 ${result.batchId}`);
  console.log(`Excel Export Date:        ${result.excelExportDate.toLocaleString('fr-FR')}`);
  console.log(`Total Projects in Excel:  ${result.totalRawRows}`);
  console.log(`Staging Rows Inserted:    ${result.totalStagingRowsInserted}`);

  if (!previewErr && previewRows && previewRows.length > 0) {
    console.log("\n=== 🔍 Category Context Preview (First 3 Staging Rows) ===");
    previewRows.forEach((row: any, i: number) => {
      console.log(`Row #${i + 1}:`);
      console.log(`  - Project:      ${row.project_name}`);
      console.log(`  - Budget Type:  ${row.budget_type}`);
      console.log(`  - Nomenclature: ${row.budget_nomenclature}`);
      console.log(`  - Object:       ${row.budget_object}`);
      console.log(`  - Activity:     ${row.activity_type}`);
    });
  } else if (previewErr) {
    console.warn(`⚠️ Warning: could not retrieve staging preview rows: ${previewErr.message}`);
  }

  console.log("\n=== 🔄 Reconciliation Statistics ===");
  console.log(`Total Processed:          ${result.reconciliation.totalProcessed}`);
  console.log(`Successfully Matched:    ${result.reconciliation.matched}`);
  console.log(`Multi-Matched Projects:   ${result.reconciliation.multiMatched}`);
  console.log(`Ambiguous Projects:       ${result.reconciliation.ambiguous}`);
  console.log(`Unmapped / New Projects:  ${result.reconciliation.unmapped}`);
  console.log("=================================================");
}

run().catch((error) => {
  console.error("❌ Integration test failed with error:", error);
  process.exit(1);
});
