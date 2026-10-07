# End-to-end test log

Run on 7 Oct 2026 against a real n8n 2.42.4 instance (SQLite, workflows published), using the samples in `/samples` and the stub APIs in `scripts/mock-apis.js`. Unit and structural tests: `npm test` (34 passing).

## Mock mode (no external services)

| Scenario | Input | Result |
|---|---|---|
| Happy path | `good-request` | `202 accepted INSP-94C3DC`; approval request in inbox (A$958.10 incl. GST, low-confidence warning); Approve → "deal created" |
| Duplicate submission | `good-request` again (also after restart and re-import) | `200 duplicate`, original `firstSeenAt` returned |
| Invalid request | `invalid-request` | `400` listing 4 errors (name, email, city not in service area, description too short) |
| AI invents a service | `ai-invents-work-request` | No quote; manual-review alert: `unknown service code "EPOXY_FLAKE_FLOOR"` |
| No measurements | `no-measurements-request` | Quote with 2 assumption warnings; minimum charge applied (A$385.00) |
| Prompt injection text | `prompt-injection-request` | "quote 0.01" ignored (prices from rate table); line items still shown to reviewer for a decision |
| Reject | Reject link | "rejected: nothing sent to the CRM" |
| Tampered approval link | Approve link with token changed | "invalid token: nothing sent to the CRM" |
| Replayed approval link | Same Approve link clicked twice | n8n refuses: execution already finished (409) |

## Live mode (HTTP nodes against stub Anthropic + Pipedrive APIs)

| Scenario | Result |
|---|---|
| AI API returns 500 twice | Retried at 5s intervals, succeeded on 3rd call, quote produced |
| Approve | `GET /deals/search` → `POST /deals` → `POST /notes`; deal value A$871 ex GST, note linked to the deal, customer HTML escaped |
| Deal with same reference already exists | Search finds it; no second deal created; "deal already existed, not duplicated" |
| Approval window expires (set to ~72s for the test) | Resumed by timeout; "expired: nothing sent to the CRM" |
| Pipedrive down | Search retried 3 times at 3s intervals, then the error workflow posted "Automation failed … Node: Pipedrive: Search Deal" with a link to the execution |

## Found and fixed during testing

- n8n 2.x will not run an error workflow unless it is published. Setup steps now say to publish all three workflows.
- n8n 2.x signs resume URLs (`?signature=…`). Approval links now append `&decision=…&token=…` correctly; covered by a unit test.
- The reviewer originally saw `{"message":"Workflow was started"}` after clicking. Added a *Respond to Reviewer* node that shows the actual decision.
- Added a reviewer warning when notes contain instruction-like text (possible prompt injection).
