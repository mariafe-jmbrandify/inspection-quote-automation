#!/usr/bin/env node
/**
 * Sends a sample request to the workflow's webhook.
 *
 *   node scripts/send-sample.js                      # samples/good-request.json
 *   node scripts/send-sample.js invalid-request      # any file in /samples
 *   N8N_URL=http://localhost:5678 node scripts/send-sample.js
 *
 * Add --test to hit the test URL (/webhook-test/...) while "Listen for test event" is on.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const useTest = args.includes('--test');
const name = (args.find((a) => !a.startsWith('--')) || 'good-request').replace(/\.json$/, '');
const base = process.env.N8N_URL || 'http://localhost:5678';
const url = `${base}/${useTest ? 'webhook-test' : 'webhook'}/inspection-request`;
const body = fs.readFileSync(path.join(__dirname, '..', 'samples', name + '.json'), 'utf8');

fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
  .then(async (res) => {
    console.log(`POST ${url}\n${res.status} ${res.statusText}\n${await res.text()}`);
    if (res.status === 202) console.log(`\nApproval request sent. Open ${base}/webhook/inbox to approve or reject.`);
  })
  .catch((e) => {
    console.error(`Could not reach ${url}: ${e.message}\nIs n8n running and the workflow active?`);
    process.exit(1);
  });
