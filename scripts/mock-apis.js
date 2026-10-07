#!/usr/bin/env node
/**
 * Local stand-ins for the Anthropic and Pipedrive APIs, for testing the
 * "live" HTTP paths (auth headers, retries, dedup search) without real
 * accounts or cost.
 *
 *   node scripts/mock-apis.js          # listens on :4010
 *
 * Then in src/config.js set aiMode/crmMode to 'live' and:
 *   ai.url       = 'http://host.docker.internal:4010/v1/messages'
 *   crm.baseUrl  = 'http://host.docker.internal:4010/api/v1'
 * (use localhost instead of host.docker.internal if n8n is not in Docker)
 *
 * GET /_state shows the deals and notes it has received.
 * POST /_fail?next=2 makes the next 2 requests return HTTP 500 (to test retries).
 */
const http = require('http');
const { mockAi } = require('../src/mock-ai');

const PORT = Number(process.env.PORT || 4010);
const state = { deals: [], notes: [], calls: [], failNext: 0 };

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const body = raw ? JSON.parse(raw) : {};
      state.calls.push({ method: req.method, path: url.pathname, at: new Date().toISOString() });

      if (url.pathname === '/_state') return send(res, 200, state);
      if (url.pathname === '/_fail') {
        state.failNext = Number(url.searchParams.get('next') || 1);
        return send(res, 200, { failNext: state.failNext });
      }
      if (state.failNext > 0) {
        state.failNext--;
        return send(res, 500, { error: 'simulated outage' });
      }

      if (url.pathname === '/v1/messages' && req.method === 'POST') {
        if (!req.headers['x-api-key']) return send(res, 401, { type: 'error', error: { message: 'missing x-api-key' } });
        if (req.headers['anthropic-version'] !== '2023-06-01') return send(res, 400, { error: 'bad anthropic-version' });
        const content = body.messages[0].content;
        const notes = content.split('<inspection_notes>\n')[1].split('\n</inspection_notes>')[0];
        return send(res, 200, mockAi({ description: notes, property: { address: 'stub' } }));
      }

      if (url.pathname.startsWith('/api/v1/')) {
        if (!url.searchParams.get('api_token')) return send(res, 401, { success: false, error: 'unauthorized' });
        if (url.pathname === '/api/v1/deals/search') {
          const term = url.searchParams.get('term') || '';
          const items = state.deals.filter((d) => d.title.includes(term)).map((d) => ({ item: { id: d.id, title: d.title } }));
          return send(res, 200, { success: true, data: { items } });
        }
        if (url.pathname === '/api/v1/deals' && req.method === 'POST') {
          const deal = { id: 1000 + state.deals.length + 1, ...body };
          state.deals.push(deal);
          return send(res, 201, { success: true, data: deal });
        }
        if (url.pathname === '/api/v1/notes' && req.method === 'POST') {
          if (!body.deal_id) return send(res, 400, { success: false, error: 'deal_id required' });
          const note = { id: 5000 + state.notes.length + 1, ...body };
          state.notes.push(note);
          return send(res, 201, { success: true, data: note });
        }
      }
      send(res, 404, { error: 'not found' });
    });
  })
  .listen(PORT, () => console.log(`mock APIs on http://localhost:${PORT}`));
