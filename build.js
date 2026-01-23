const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Simple env parser
const env = {};
if (fs.existsSync('.env')) {
    const content = fs.readFileSync('.env', 'utf8');
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0) {
            env[key.trim()] = rest.join('=').trim();
        }
    });
}

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
    console.warn("WARNING: GOOGLE_CLIENT_ID not found in .env or process.env");
}

console.log(`Building with GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID ? 'Set' : 'Not Set'}`);

esbuild.build({
    entryPoints: ['index.tsx'],
    bundle: true,
    outfile: 'dist/bundle.js',
    loader: { '.tsx': 'tsx' },
    minify: true,
    define: {
        'process.env.GOOGLE_CLIENT_ID': JSON.stringify(GOOGLE_CLIENT_ID || '')
    }
}).then(() => {
    console.log('Build successful');
}).catch(() => process.exit(1));
