/**
 * Central settings for the Inspection → AI Quote → Approval → Pipedrive workflow.
 *
 * This is the ONLY file most changes should need. The build script copies it
 * into the "Config" Code node, and every other node reads settings from there.
 *
 * Secrets (API keys) never go here. They live in n8n Credentials.
 */
function getConfig() {
  return {
    // "mock" runs the whole flow with no API keys (good for demos and tests).
    // "live" calls the Anthropic API and Pipedrive for real.
    aiMode: 'mock',
    crmMode: 'mock',

    ai: {
      url: 'https://api.anthropic.com/v1/messages',
      model: 'claude-sonnet-5-5',
      maxTokens: 1500,
      // Below this the quote is still produced, but the approver is warned.
      minConfidence: 0.6,
    },

    crm: {
      // Use https://<your-company>.pipedrive.com/api/v1 or https://api.pipedrive.com/v1
      baseUrl: 'https://api.pipedrive.com/v1',
      currency: 'AUD',
    },

    notify: {
      // Where approval requests and alerts are POSTed.
      // Default is the bundled "Mock Inbox" workflow, so it works out of the box.
      url: 'http://localhost:5678/webhook/mock-inbox',
      // "generic" (Mock Inbox), "slack", "discord" or "googlechat"
      channel: 'generic',
    },

    serviceAreas: ['Melbourne', 'Sydney', 'Brisbane'],

    // Same request seen again within this window is ignored.
    dedupWindowHours: 72,

    approval: {
      // Quotes not approved within this window expire and alert the team.
      expiresAfterHours: 48,
    },

    pricing: {
      gstRate: 0.1,
      minimumCharge: 350, // ex GST, applied when the job total is below it
      // Quotes above this total (inc GST) get a "senior sign-off" warning.
      highValueThreshold: 10000,
    },

    // Placeholder rates (ex GST). Replace with real rates before going live.
    // The AI is only allowed to pick codes from this list; it never sets prices.
    catalog: {
      CONC_CRACK_REPAIR: { label: 'Concrete crack repair', unit: 'lm', rate: 45, maxQty: 500 },
      CONC_PATCH: { label: 'Concrete spall / patch repair', unit: 'm2', rate: 180, maxQty: 200 },
      TRIP_HAZARD_GRIND: { label: 'Trip hazard grinding', unit: 'each', rate: 95, maxQty: 100 },
      PAVER_RELAY: { label: 'Paver lift and relay', unit: 'm2', rate: 120, maxQty: 300 },
      TILE_REPLACE: { label: 'Tile replacement', unit: 'each', rate: 65, maxQty: 400 },
      JOINT_RESEAL: { label: 'Expansion joint reseal', unit: 'lm', rate: 22, maxQty: 1000 },
      PRESSURE_CLEAN: { label: 'Pressure clean', unit: 'm2', rate: 6, maxQty: 5000 },
      LINE_MARKING: { label: 'Line marking', unit: 'lm', rate: 8, maxQty: 2000 },
      SITE_INSPECTION: { label: 'Site inspection and report', unit: 'each', rate: 250, maxQty: 5 },
    },
  };
}

// ---- exports (removed by build) ----
module.exports = { getConfig };
