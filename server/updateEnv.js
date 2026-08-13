import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, '../serviceAccount.json');
const envPath = path.join(__dirname, '.env');

try {
  const jsonContent = fs.readFileSync(serviceAccountPath, 'utf8');
  // parse and stringify to minify
  const minified = JSON.stringify(JSON.parse(jsonContent));
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Replace or add FIREBASE_SERVICE_ACCOUNT_JSON
  const envVar = `FIREBASE_SERVICE_ACCOUNT_JSON='${minified.replace(/'/g, "\\'")}'\n`;
  
  if (envContent.includes('FIREBASE_SERVICE_ACCOUNT_JSON=')) {
    envContent = envContent.replace(/^#?\s*FIREBASE_SERVICE_ACCOUNT_JSON=.*$/m, envVar);
  } else {
    envContent += `\n${envVar}`;
  }
  
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('Successfully added FIREBASE_SERVICE_ACCOUNT_JSON to server/.env');
} catch (error) {
  console.error('Failed to update env:', error);
}
