// Copy backend to api/backend for Vercel deployment
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const backendDir = join(rootDir, 'backend');
const apiBackendDir = join(__dirname, 'backend');

try {
  if (!existsSync(backendDir)) {
    console.log('⚠️  Backend directory not found, skipping copy');
    process.exit(0);
  }

  // Remove existing api/backend if exists
  if (existsSync(apiBackendDir)) {
    console.log('🗑️  Removing existing api/backend...');
    rmSync(apiBackendDir, { recursive: true, force: true });
  }

  console.log('📦 Copying backend to api/backend...');
  execSync(`cp -r "${backendDir}" "${apiBackendDir}"`, { stdio: 'inherit' });
  
  // Remove node_modules from copied backend (we'll use root node_modules)
  const backendNodeModules = join(apiBackendDir, 'node_modules');
  if (existsSync(backendNodeModules)) {
    console.log('🗑️  Removing node_modules from copied backend...');
    rmSync(backendNodeModules, { recursive: true, force: true });
  }
  
  console.log('✅ Backend copied successfully to api/backend');
} catch (error) {
  console.error('❌ Error copying backend:', error.message);
  // Don't fail the build, just warn
  console.warn('⚠️  Continuing build without backend copy (might fail at runtime)');
}

