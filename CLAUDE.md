# Working on this repo with Claude Code

This repo holds an n8n workflow. The logic is plain JavaScript in `src/`; `npm run build` copies it into the n8n Code nodes in `workflows/`.

## Rules

- **Edit `src/`, never the Code nodes in `workflows/*.json`.** The build overwrites them. If someone changed code inside the n8n UI, copy that change back into the matching `src/` file first.
- **Every change ends with `npm run check`** (build + tests). Commit `src/`, `test/` and the regenerated `workflows/` together.
- **Add or update a test in `test/unit.test.js` for every logic change.** For a bug, write the failing test first.
- **Never put API keys or tokens in any file.** They belong in n8n Credentials. `test/workflow.test.js` fails if a key pattern appears in a workflow.
- Each `src/` file ends with the line `// ---- exports (removed by build) ----` followed by `module.exports`. Keep that marker; the build depends on it.
- Code nodes run inside n8n's sandbox: no `require` of local files or npm packages, and no `process.env`. Use plain JavaScript and globals only.
- Node wiring and layout are defined in `build/build-workflows.js` (`edges` and `LAYOUT`). A new node needs an entry in both.

## Common changes

| Change | Where |
|---|---|
| Rates, GST, minimum charge, service list | `src/config.js` → `catalog`, `pricing` |
| Switch mock/live AI or CRM | `src/config.js` → `aiMode`, `crmMode` |
| Notification channel (Slack, Discord, Google Chat) | `src/config.js` → `notify` |
| Approval expiry | `src/config.js` → `approval.expiresAfterHours` |
| What the AI is told | `src/build-ai-prompt.js` |
| What counts as bad AI output | `src/validate-ai-output.js` |
| Message wording | `src/notify.js` |
| Pipedrive deal and note content | `src/crm.js` |

Adding a service code: add it to `catalog` in `src/config.js` (label, unit, rate, maxQty). The prompt and validator pick it up automatically.

## Deploying a change

1. `npm run check`
2. In n8n, import `workflows/inspection-quote-main.json` over the existing workflow (or delete and re-import), re-select credentials if prompted, check Settings → Error Workflow, then publish.
3. Send `node scripts/send-sample.js` and confirm the approval request arrives.

## Safety invariants (do not remove without a reason written in the commit)

- The AI never sets prices.
- AI output is validated before use; failures go to manual review.
- Nothing reaches Pipedrive without an approved decision with a matching token.
- Pipedrive search runs before any create. Create Deal and Add Note have no automatic retry.
- Every branch ends in a webhook response or a notification.
