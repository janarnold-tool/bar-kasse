#!/bin/sh
# Baut eine Testkopie mit Emulator-Konfiguration und startet den End-to-End-Test.
set -e
cd "$(dirname "$0")/.."
node build.mjs
rm -rf test/site && cp -r public test/site && cp firestore.rules test/
echo "window.BAR_KASSE_FIREBASE = { apiKey: 'demo', projectId: 'demo-bar', appId: 'demo', emulatorHost: '127.0.0.1:8080' };" > test/site/config.js
npx firebase emulators:exec --config test/firebase.test.json --only firestore,hosting --project demo-bar "node test/e2e.mjs"
