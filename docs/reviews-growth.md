# Reviews & reputation — local implementation review

## Scope and safety

- Integrated into the existing authenticated Reviews tab, ES/EN. No separate prototype and no new runtime service, tracker or contact connection.
- No production encrypted file was opened/decrypted during implementation. No keys or real reviewer/customer fixtures were used. Tests construct explicitly synthetic encrypted envelopes in memory or temporary directories.
- No push, PR, deployment, production updater invocation, Google/Yelp API call, customer contact or change to Hermes settings/connections.
- Existing WebCrypto login, password derivation, AES-GCM encryption and `{s,i,c}` envelopes remain unchanged. The new history adapter uses the existing runtime platform password, never logs it, and stops the updater before network requests if previous ciphertext cannot be decrypted or history has an unsupported schema. Password rotation therefore requires a private, deliberate migration of the previous encrypted payload, not silent history deletion.
- Existing app fonts/icons still use their existing external hosts. The QR module itself makes **no network requests** and never stores its state in localStorage/sessionStorage. The pre-existing login sessionStorage behavior is unchanged.

## Delivered behavior

- Preparation → QR/team → Measurement → Automation pending roadmap. All seven proposed role tasks start **Not started**; user entries are **Recorded in session**, not externally verified completions. Automation always remains pending consent and approval.
- Google/Yelp rating/count are read from `D.reseñas`, with missing/invalid metrics represented by null / **Sin dato**. A real count of zero stays zero. No invented growth, click or conversion figures.
- `review_history: {version: 1, days: [{date, google: {rating,count}, yelp: {rating,count}}]}` is inside both existing encrypted payloads, not a public plaintext file. The updater decrypts the previous platform envelope at runtime to preserve history, then replaces that Los Angeles civil day's observation with the latest run. No new data-source requests. Missing API observations remain null, never carried forward as fresh zeroes.
- Exact endpoint net count differences at 7/30 days only; no interpolation, no requirement for continuous daily coverage and no claim of attributable new reviews. Comparisons are against the latest source snapshot date, not the visitor's clock. UI suppresses deltas when history does not match the payload date. Baseline/history table shows actual source observations (last 31 rows in UI; history retained in encrypted payload/export).
- History starts on the first integrated updater run; it does not reconstruct historical reviews. Implementation has not run that updater against production.
- QR configuration is authenticated, local, and validated. Supported HTTPS review-only formats: `search.google.com/local/writereview?placeid=…`, `g.page/r/…/review`, and the documented `www.google.com/maps/place//data=!4m3!3m2!1s0x…:0x…!12e1` form. Profile URLs, other hosts, credentials, extra query parameters and non-HTTPS schemes are rejected. This is format validation, **not business-identity verification**; state explicitly stays **Pending verification**.
- Without a usable link, no QR is generated. No real review URL or place ID has been invented or preloaded. Manual entry requires an acknowledgment before preparing the draft. Changing input invalidates the prior QR immediately.
- Real clipboard copy; standalone QR SVG download; printable EN draft-card SVG download; neutral EN preview and team script. Downloaded QR was decoded back to the exact synthetic URL both from the matrix and from the rendered printable card.
- Session task/link state survives tab/language rerenders, but is intentionally memory-only: lost on reload/logout, not synchronized between browsers. Export a summary before leaving if needed; no cleartext private browser persistence was added.
- Authenticated JSON summary download contains metrics, sanitized history and proposed-role task status; no keys, contacts or destination URL. It is an intentional **unencrypted local download**, with an explicit privacy warning.
- QR clicks/scans: **not instrumented**. Card placement: **not server-confirmed**. No QR-to-individual-review attribution.
- No gating, happy-customer filtering, star/content demands, incentives, raffles, family/staff reviews, on-premises pressure or employee request/review quotas. Yelp: do not solicit reviews. Arianna metrics read access does not authorize sending. Consent, authorized contact source, channel and explicit approval remain outstanding; no bulk historic campaigns.

## Google review-URL hook — deliberately not activated

`google()` now retains the already-requested Places ID. It can also preserve `p.googleMapsLinks?.writeAReviewUri` as `D.reseñas.google.write_review_uri` if that field becomes available.

**The existing Text Search/Details FieldMasks were not changed**, and there is no additional request or new API spend. Therefore the URI will normally remain null with the current response. Activation requires owner approval after checking the applicable billing SKU and source/business identity; add the official `places.googleMapsLinks` field only after that review. Never construct a destination from a business name. Until then, use an official manually obtained link after login and verify it before any real placement.

Primary documentation consulted:
- https://developers.google.com/maps/documentation/places/web-service/maps-links
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- Policy provided/verified by coordinator: https://support.google.com/contributionpolicy/answer/7400114?hl=en

QR vendor: Project Nayuki, official compiled JavaScript downloaded from https://www.nayuki.io/res/qr-code-generator-library/qrcodegen.js. MIT license retained verbatim in `assets/vendor/qrcodegen.js`. Frozen local SHA-256: `2511bc17f40a3c41d4a0578995db956b38997334d3d20113a5d4dc5c49c69480`. No runtime CDN/API dependency for QR generation.

## Reproduce tests (local only)

```sh
npm ci --ignore-scripts
npm run test:unit
npx playwright install chromium
npm test
```

Browser tests route all page requests: the encrypted payload is synthetic; local source assets are read; existing external font/icon requests are blocked. They exercise the actual HTML login/decryption, tab integration, missing/zero metrics, default tasks, QR validation/generation, clipboard, both SVG downloads, decoding of a rendered card, JSON export, ES/EN, mobile overflow and logout/relogin clearing. They do not connect to production or visit the entered destination.

`updater-fixture.test.mjs` runs the actual updater and source decryptor twice in an isolated directory with synthetic encrypted source/prior payloads and an all-network replacement. It verifies daily dedupe/history preservation, zero vs missing, matching platform/agent histories, unchanged envelope fields and refusal to overwrite on a bad key. No production paths or credentials are used.

The current container lacked Chromium shared libraries/fonts. To avoid global installs, Ubuntu packages were downloaded/unpacked under a scratch directory, not installed. The full suite was run using:

```sh
FONTCONFIG_FILE=/root/.hermes/cache/scratch/bdg-browser-libs/fonts.conf \
LD_LIBRARY_PATH=/root/.hermes/cache/scratch/bdg-browser-libs/root/usr/lib/x86_64-linux-gnu \
npm test
```

Screenshots use synthetic data and synthetic test-only QR destinations, never production metrics. Files: `$TMPDIR/bdg-growth-mobile.png`, `$TMPDIR/bdg-growth-desktop.png` (override directory with `BDG_TEST_ARTIFACT_DIR`). Browser renders use fallback local fonts because external requests are deliberately blocked; they do not validate remote font availability.

## TDD evidence and remaining gates

Observed RED → GREEN slices: metric model absent → implemented; daily/DST/history API absent → implemented; QR URL/generator API absent → implemented and decoded; encrypted adapter absent → implemented/integrated; authenticated module DOM absent → UI integrated; documented Google Maps review-URL format rejected → validator extended. Additional regression tests then exercised actual updater encryption and printable card decoding.

Before real operation: review local diff; verify the actual business destination; approve plan/copy and any card placement; approve any Google billing/FieldMask change; decide durable encrypted task persistence if required; review platform source-data retention requirements. No sends/automation/deployment are enabled by this work. Existing production data quality and existing remote integrations remain unverified by design.
