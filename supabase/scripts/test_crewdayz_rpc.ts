import * as fs from 'fs';
import * as path from 'path';
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

async function loadConfig(envFilePath: string): Promise<{ url: string; key: string; resolvedPath: string }> {
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
    return { url, key, resolvedPath };
  } else {
    const envData = parseEnvFile(resolvedPath);
    const url = envData['VITE_SUPABASE_URL'] || envData['SUPABASE_URL'] || envData['supabaseUrl'];
    const key = envData['VITE_SUPABASE_ANON_KEY'] || envData['SUPABASE_ANON_KEY'] || envData['supabaseKey'] || envData['supabaseAnonKey'];

    if (!url || !key) {
      throw new Error(`Loaded env file lacks Supabase URL/Key. Expected keys: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY etc.`);
    }
    return { url, key, resolvedPath };
  }
}

function printUsage() {
  console.log('\nUsage:');
  console.log('  npx tsx supabase/scripts/test_crewdayz_rpc.ts -e <config_path> [-s <start_date>] [-d <end_date>]\n');
  console.log('Options:');
  console.log('  -e, --env-file     Path to Angular environment TS file (e.g. src/environments/environment.ts) or .env file');
  console.log('  -s, --start-date   Start date for RPC (format YYYY-MM-DD, default: 2026-07-01)');
  console.log('  -d, --end-date     End date for RPC (format YYYY-MM-DD, default: 2026-07-31)');
  console.log('  -h, --help         Show this help message\n');
}

async function main() {
  const args = process.argv.slice(2);
  let envFileArg = '';
  let startDate = '2026-07-01';
  let endDate = '2026-07-31';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env-file' || args[i] === '-e') {
      envFileArg = args[i + 1];
      i++;
    } else if (args[i] === '--start-date' || args[i] === '-s') {
      startDate = args[i + 1];
      i++;
    } else if (args[i] === '--end-date' || args[i] === '-d') {
      endDate = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage();
      process.exit(0);
    } else if (!envFileArg && !args[i].startsWith('-')) {
      envFileArg = args[i];
    }
  }

  if (!envFileArg) {
    console.error('❌ Erreur : L\'option --env-file / -e est requise.');
    printUsage();
    process.exit(1);
  }

  const { url, key, resolvedPath } = await loadConfig(envFileArg);

  console.log(`📍 Fichier d'environnement chargé : ${resolvedPath}`);
  console.log(`🌐 URL Supabase cible : ${url}\n`);

  const supabase = createClient(url, key);

  console.log('Testing RPC cd_get_teams_discovery...');
  const { data: discoveryData, error: discoveryError } = await supabase.rpc('cd_get_teams_discovery');
  if (discoveryError) {
    console.error('Discovery Error:', discoveryError);
  } else {
    console.log('Discovery Result:', JSON.stringify(discoveryData, null, 2));
  }

  console.log('\n------------------------------------------------------------');
  console.log(`📅 Période testée pour RPC cd_get_availabilities :`);
  console.log(`   - p_start_date = "${startDate}"`);
  console.log(`   - p_end_date   = "${endDate}"`);
  console.log('------------------------------------------------------------');

  const { data: availData, error: availError } = await supabase.rpc('cd_get_availabilities', {
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (availError) {
    console.error('Availabilities Error:', availError);
  } else {
    console.log('Availabilities Result:', JSON.stringify(availData, null, 2));
  }

  console.log('\nTesting table roadmap_mapping_roles_profiles...');
  const { data: mappingData, error: mappingError } = await supabase.from('roadmap_mapping_roles_profiles').select('*');
  if (mappingError) {
    console.error('Mapping Table Error:', mappingError);
  } else {
    console.log('Mapping Table Result:', mappingData);
  }
}

main();
