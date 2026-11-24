# Etsy Seller Profit & Fee Calculator

A free, single-feature web app — **positioning (decided 2026-11-24): this calculator is a free lead-generation asset, not a paid tool; it stays free, and any future monetisation is only via separate Pro automation features** that shows an Etsy seller exactly what they keep from a sale: total revenue, every Etsy fee broken out line by line, total costs, net profit, profit margin %, and the break-even price. Framework-free — plain HTML/CSS/JS, no build step, no CDN, no network calls.

## Files
- `index.html` — the app page
- `style.css` — styling (mobile-responsive)
- `app.js` — calculation (pure `calculateProfit` / `breakEvenPrice` functions) + browser UI + waitlist (localStorage only)
- `test.mjs` — Node tests with hand-computed examples (`node test.mjs`)
- `waitlist-worker.js` — Cloudflare Worker + KV waitlist endpoint (the calculator is the front end; this is the optional server side that makes the waitlist real — see "Waitlist note" below and the deploy comments in the file)
- `waitlist-worker-test.mjs` — local E2E harness for the Worker (in-memory KV mock; `node waitlist-worker-test.mjs`). Results recorded in `waitlist-worker-test.md`

## Fee assumptions (presets: US seller default, Japan seller — USD)

Use the **Seller country (fee preset)** selector at the top of the app. Etsy Payments processing rates depend on the country of the seller's bank account, so a Japan-based shop pays materially more per sale than a US shop.

| Fee | US preset | Japan preset | Charged on |
|---|---|---|---|
| Listing fee | $0.20 flat per item | $0.20 flat per item | Per listing; renews every 4 months, and per sale for quantity 1 (amortised as $0.20/sale here) |
| Transaction fee | 6.5% | 6.5% | Price + shipping charged − discount |
| Payment processing | 3% + $0.25 | **6.0% + $0.30** | Total order amount (after discount, incl. shipping charged) |
| Regulatory operating fee | **0%** | **0%** | Same base as transaction fee |
| Offsite Ads (optional, toggle) | 15% default, editable — use 12% for shops over $10,000 in 12-month sales | Same | Total order value, only when enabled |

The regulatory operating fee stays an editable field ("Regulatory fee % (varies by country)") for sellers in the countries where it does apply; both presets default it to 0%.

Discount % is applied to the item price only. Sales tax, gift wrap, personalisation, currency conversion (2.5%), VAT on fees, and multi-quantity listing fees are **not** modelled.

### Fees verified as of 2026-11-24
> **Fees verified as of 2026-11-24.** Most rates in this app were corroborated by secondary sources citing Etsy's Fees & Payments Policy / Help Center (see below). The **regulatory operating fee point was confirmed on Etsy's official Help Center**: which countries it applies to — and that neither the US nor Japan is on that list. The same caveat is shown in the app UI. Re-check Etsy's Fees & Payments Policy before relying on any rate commercially.

- **Regulatory fee: 0% for both US and Japan sellers — confirmed on Etsy's official Help.** Etsy's official Help page "What is a Regulatory Operating Fee?" lists only Canada 0.50%, France 1.14%, Hungary 1.97%, Italy 0.80%, India 0.05%, Spain 0.88%, Türkiye 1.67%, United Kingdom 0.48%, Vietnam 1.24% — the United States and Japan are not listed, so sellers in either country pay no regulatory operating fee. Source (fetched 2026-11-24): https://help.etsy.com/hc/en-us/articles/1500011073202-What-is-a-Regulatory-Operating-Fee?segment=selling
- **Japan payment processing: 6.0% + $0.30 (added 2026-11-24 as the Japan preset).** This rate, and US processing at 3% + $0.25, were corroborated on 2026-11-24 by secondary sources and competitor calculators citing Etsy's payment-processing table (the Day 1–2 measurement recorded Etsy's Help payment-processing table as listing "Japan — 6.0% + 0.30 USD" and "United States — 3% + 0.25 USD"); the processing table itself was not re-fetched directly in the preset pass, so treat the processing rates as corroborated, not directly re-verified, per the caveat above.
- Transaction fee 6.5%, US payment processing 3% + $0.25, listing fee $0.20, and Offsite Ads 15% / 12% were corroborated on 2026-11-24 by multiple secondary sources citing Etsy's Fees & Payments Policy / Help Center (e.g. Alura's Etsy calculator, checked against Etsy Help 2026-11-12; Printful's Etsy fees guide). The official regulatory-fee page above was read directly; the other official Etsy policy pages were not fetched directly in this pass, so treat those rates as corroborated, not directly verified, and re-check Etsy's Fees & Payments Policy before relying on them commercially. No rate was invented: where direct verification was unavailable, this is stated here rather than hidden.

## Run locally
- Easiest: open `index.html` in a browser (double-click it), or
- Serve it: `python3 -m http.server 8000` in this folder, then open http://localhost:8000

## Deploy on Cloudflare Pages
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets (drag-and-drop this whole folder), **or** connect the git repo containing this folder.
2. Build command: **none / leave blank**. Output directory: **this folder** (`etsy-profit-calculator`). It is static files only.
3. Deploy — you get a `*.pages.dev` URL.

**Cloudflare Workers alternative (brief):** create a Worker that serves these files as static assets (Wrangler `assets` directory pointing at this folder), or paste `index.html`/`style.css`/`app.js` into a Workers static-assets project. Pages is simpler for this app; use Workers only if you later add server logic (e.g. a real waitlist endpoint).

## Later: wrap as a Chrome extension
- Add a Manifest V3 `manifest.json` with an `action` popup (or `side_panel`) whose page is a copy of `index.html`.
- Reuse `app.js` calculation functions unchanged — they are pure and DOM-independent except for the UI block guarded by `typeof document`.
- What changes: remove/replace the localStorage waitlist (use `chrome.storage.local`, or a real backend endpoint — extension pages have stricter CSP, no inline scripts), bundle all files in the extension zip (no external requests — already true), add icons, and submit to the Chrome Web Store ($5 one-time developer fee, review required).

## Monetisation path (brief)
Free calculator (this MVP, for waitlist/traffic validation; US and Japan fee presets already included) → **Pro at $9–19/mo**: saved listings & cost profiles, bulk / CSV calculation, target-margin reverse pricing, multi-currency and a full per-country fee preset library, fee-change alerts, and Chrome extension sync.

## Waitlist note
The waitlist is front-end demo only by default: emails are validated in the browser and stored **only in localStorage** in that browser. Nothing is transmitted. **Real backend now prepared (2026-11-24):** `waitlist-worker.js` is a Cloudflare Worker + KV endpoint (free tier) that stores signups server-side. Deploy it per the comments in that file, set `window.WAITLIST_ENDPOINT` in `index.html`, and the form posts there instead — the success message then drops the "(Demo…)" note. Do NOT drive community-post traffic to the calculator as a real waitlist until the Worker is deployed; the 30-signup success criterion cannot be measured from localStorage.
