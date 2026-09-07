# ComplyVision PR #5 — selective integration

Update (2026-09-07): the user subsequently requested phone OTP, auth/database, and PDF export. The follow-up section below supersedes the earlier feature exclusions only for the newly validated, gated implementations.

Selection baseline: main `31d6ab0c8536cf2f67a404a184e39c2814f1da81`.
Latest PR reviewed: `7cceda00b98c4e2ff2c1636c24b9c662275aac4f`.
Previously reviewed corrections: `d1771bf5875fa5aa6a6dcbc37a8aeaf922f7b378`, preserved on `codex/complyvision-pr5-integration`.
Safe subset assembled from main on `codex/complyvision-pr5-safe`; the original PR history is not merged wholesale.

## Classification

| Change | Classification | Selected behavior |
| --- | --- | --- |
| ComplyVision branding, social metadata/image, theme | SAFE AFTER SIMPLE FIX | Keep reviewed branding; ensure explicit dark buttons remain readable. |
| Dashboard, history, findings, analytics, report navigation | SAFE AFTER SIMPLE FIX | Keep current-session reports in memory, clearly label that reload clears history; JSON/Markdown export uses the existing renderer. No database calls. |
| Reviewed declaration/extraction corrections | SAFE | Preserve reliable primary values; reject quantity-as-price and manufacturer-heading-as-product substitutions. |
| Reviewed OCR evidence normalization | SAFE AFTER SIMPLE FIX | Preserve primary text; require exact normalized agreement; do not inflate confidence; do not overwrite reliable primary declarations with ensemble candidates. |
| Canonical report and deterministic rule safeguards | SAFE | Keep main's rule engine, conservative physical-measurement REVIEW, full-rule status aggregation, and canonical metadata. |
| New latency logging | SAFE AFTER SIMPLE FIX | Server-side elapsed time and byte count only; omit uploaded filenames and keep API response schema unchanged. |
| New mobile OCR models, batching/resizing/device defaults | UNVERIFIED — SKIPPED | Retain previously exercised OCR setup and current Python dependencies. |
| New OCR verification threshold change to 0.50 | UNVERIFIED — SKIPPED | Retain reviewed 0.82 verification trigger. |
| Declaration-only headline PASS override and new physical-rule thresholds | UNSAFE — SKIPPED | Cannot hide FAIL/REVIEW outcomes. |
| Phone OTP / anonymous sessions / auth and profile UI | UNVERIFIED — SKIPPED | No authentication routes, clients, menu or registration features included. Phone provider was disabled during live review. |
| Supabase database persistence, schema and RLS-dependent features | UNVERIFIED — SKIPPED | No database features or migrations included. Reviewed role/cookie safety fixes remain on the prior integration branch for future authenticated validation. |
| New PDF export | UNVERIFIED — SKIPPED | Keep existing JSON and Markdown export; no jsPDF dependency. |
| Duplicate extraction/report mapping and dependency upgrades | SKIPPED | No redundant modules or dependency changes. |

## Validation

- Backend `pytest`: 110 passed, 0 failed, plus 33 passed subtests; one existing Starlette/httpx deprecation warning.
- Frontend existing tests plus targeted session-history test: 17 passed in total (9 unchanged tests and final targeted rerun of 8 workspace tests).
- Frontend lint: passed with no errors or warnings.
- Frontend production build: passed, including TypeScript; only home, not-found and social-image routes are generated.
- `/health`: HTTP 200 without OCR startup.
- `/analyze`, real `samples/best.jpg`: HTTP 200, canonical version 1.0; OCR succeeded, 14 consensus entries and 5 evidence images. Summary: 8 PASS, 0 FAIL, 1 REVIEW, 1 N/A; overall REVIEW.
- Browser verification: dashboard and upload controls render without authentication; session-only retention is explicitly shown.
- No unresolved Git conflicts; deterministic rules, dependency manifests and lockfile unchanged from main.
- Removed stale generated development route types that referenced excluded auth pages; no type-check suppression was introduced.
- Original untracked root `node_modules/` is excluded from commits. Internal API/environment identifiers remain unchanged.

PR #5 retains excluded work for a later review. This selection does not validate or apply any live Supabase configuration, migration or permission change.


## Follow-up: auth/database and PDF export (2026-09-07)

Baseline: validated main `16136cceecf7810a63c47865a930a95b8e74a8c5`. No additional PR OCR, threshold, extraction, or rule-engine changes are selected.

- **SAFE:** PDF export from report details and archive. Embedded licensed font, exact canonical outcomes, rule/evidence text, aspect-preserving images, and line-level pagination. The real sample produced 12 pages; rendered pages, long-content page breaks, all rule IDs, rupee text, and disclaimer were checked.
- **SAFE AFTER FIX, GATED:** real email/phone OTP; provider availability gating; verified-user authorization; refreshed-cookie redirects; local sign-out; same-origin and account-switch checks. No demo OTP or anonymous-login fallback.
- **SAFE AFTER FIX, GATED:** authenticated personal report persistence with immutable reports, ownership RLS, restricted profile column grants, denied anonymous access, NOT_APPLICABLE support, canonical-status consistency checks, paginated history, and visible retryable save failures. The initial migration also avoids the old broad grants.
- **UNVERIFIED, NOT ACTIVATED:** real SMS delivery, hosted migrations/RLS, and hosted persistence. User confirmed the Phone/SMS provider is not configured. Both deployment switches default to false; no live SQL or provider configuration was changed. Setup and activation checks are documented in `docs/AUTH_DATABASE_SETUP.md`.

Validation: backend pytest **110 passed + 33 subtests** (one pre-existing TestClient deprecation warning); frontend **28 tests passed**, lint passed, production build passed. PostgreSQL tests execute the migrations with two users and anonymous access; follow-up SQL/PDF checks passed after the final fixes. Real `/health` and `/analyze` returned HTTP 200; OCR succeeded with five evidence images and canonical REVIEW (8 PASS, 0 FAIL, 1 REVIEW, 1 N/A). The real report is accepted by storage validation. No conflicts or backend changes.

Browser-level login verification was blocked by automatic approval review due to the account usage limit. Provider gating, OTP verification, routing cookies, authorization, and save/retry/reload have automated coverage; no live delivery success is claimed.

## PR #3 and remaining PR #5 integration (2026-09-07)

Fetched current remote main and both PR heads before review. PR #5 remains `7cceda00b98c4e2ff2c1636c24b9c662275aac4f`; PR #3 is closed at `ad84ae75ed19be83ab53a4e3b9cba98d2edbb333`. Integration starts from local main `4d169182308e90e7992992334471cf6dd1bbff7c` and preserves its tested auth, database, PDF, extraction, and rule safeguards.

| Area | Resolution |
| --- | --- |
| PR #5 inspector account and professional profile | Integrated the PR's profile editor with protected account routing, verified identity checks, read-only role, full-name display, and row-returning saves. Removed partial auth-metadata writes and false success on missing/denied rows. |
| Phone changes | Integrated real phone-change OTP with provider gating, resend cooldown, account checks, normalized phone comparison, and confirmed response checks. No demo OTP or anonymous fallback. |
| Source preview and original filename | Integrated bounded JPEG previews and original filename persistence through the authenticated API. Reloaded reports expose the preview; active preview survives the server replacing the saved report object. Added database preview-size/type constraint in migration 006. |
| PKCE callback | Integrated allowlisted destinations and non-cacheable redirects; numeric OTP remains supported. |
| PR #3 measurement wiring | Integrated measurement propagation into reporting and the diagnostic pipeline. Copy evaluation fields to avoid mutation. Rule 7 returns explicit measurement context, handles invalid/non-finite heights, and preserves count-based non-applicability. |
| PR #3 confidence-only PASS/FAIL and unverified thresholds | Corrected to REVIEW: confidence alone is not independent physical-measurement validation. The unverified legal threshold table is not used. |
| Existing PR #5 dashboard/auth/database/PDF functions | Retained the corrected implementations already on local main; the original duplicate browser-side persistence and PDF implementations do not replace them. |
| PR #5 OCR/mobile defaults, verification-threshold relaxation, headline PASS override, duplicate extractors | Still excluded. Replacing validated extraction or hiding physical-rule REVIEW/FAIL would regress the working pipeline. No dependency churn or blocking startup warm-up is introduced. |

Validation: backend **117 passed + 33 subtests**; frontend **33 tests passed**, including profile/phone-change and preview validation; targeted preview retention rerun, lint and production build passed. Real sample `/health` and `/analyze`: HTTP 200, OCR success, five evidence images, overall REVIEW with 8 PASS / 0 FAIL / 1 REVIEW / 1 N/A. No conflict markers. Live phone/SMS, hosted migrations and hosted RLS remain unconfigured/unverified and deployment flags remain disabled. Apply migration 006 along with any unapplied prior migrations before enabling database features.

This remains a code integration into local main; the earlier push was rejected by automatic approval review pending explicit authorization to publish to the GitHub destination. No remote publishing or live Supabase changes are represented as completed.
