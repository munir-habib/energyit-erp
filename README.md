# EnergyIT

Web ERP for an energy consultancy. It reads a client's electricity invoice, compares it against a catalogue of supplier products, calculates estimated and real savings, generates PDF proposals and computes commissions. It replaces an Excel pricing model with an auditable, database-backed workflow.

> Documentação em português: [README.pt.md](README.pt.md) · Version history: [CHANGELOG.md](CHANGELOG.md)

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Row Level Security) · TanStack Query · Zustand · mathjs · jsPDF · pdf.js · Tesseract.js · Vitest

## Highlights

- **Invoice reading, 100% in the browser:** PDFs are read with pdf.js; scanned PDFs and images fall back to OCR with Tesseract.js (Portuguese). No invoice data is sent to any external API.
- **Pricing engine:** supplier products and their formulas are data, not code, evaluated safely with mathjs. Admins can change prices, products and suppliers quickly without a new release.
- **Simulations and recommendation** per client and consumption point, with history and an active simulation per point.
- **Clients, consumption points, groups, contracts and commissions**, with import from spreadsheets.
- **PDF proposals** for the client and an internal version with commissions.
- **Two-layer permission model:** business data is isolated per account with Row Level Security; the product catalogue and calculation rules are global, readable by every user and writable only by admins.
- **Admin area:** accounts, audit log, commission rules, market indices, pricing grid, products and regulated tariffs (TAR).
- **Security hardening and auth:** password recovery, session policy, migrations for security fixes.

## Engineering

| Area | Detail |
|---|---|
| Database | 27 versioned SQL migrations (schema, RLS, hardening, pricing grid, alerts, documents, groups) |
| Tests | 156 automated tests with Vitest (pricing engine, invoice extraction, validators, PDF, forms) |
| AI workflow | Built with agentic development (Claude Code), with sub-agents and agent skills in `.claude/` and `.agents/` |

## Project layout

```
src/pages        dashboard, invoices, clients, simulations, contracts, commissions, groups, import, admin
src/lib          pricingEngine, invoice reading and extraction, PDF generation, validators
supabase/        versioned SQL migrations and demo seed
docs/            design notes
```

## Project map

🟦 app (frontend) · 🟩 database and backend · 🟧 tests and scripts · 🟪 AI workflow · ⬜ config and assets

| | Folder | What is in it |
|---|---|---|
| 🟦 | `src/pages/` | Dashboard, invoices, clients, simulations, contracts, commissions, groups, import, admin |
| 🟦 | `src/components/`, `src/hooks/`, `src/context/` | UI components, hooks and app state |
| 🟦 | `src/lib/` | Pricing engine (mathjs), invoice reading and OCR, PDF generation, validators |
| 🟩 | `supabase/migrations/` | 27 versioned SQL migrations: schema, RLS, hardening, pricing grid, alerts |
| 🟩 | `supabase/demo_seed.sql` | Demo data for an account you create yourself |
| 🟧 | `src/test/` and `*.test.ts` | 156 Vitest tests |
| 🟪 | `.claude/` and `.agents/` | Sub-agents and agent skills used during development |
| ⬜ | `docs/`, `public/`, root files | Design notes, assets, Vite and TypeScript configuration |

<!-- Demo: add your screenshots to docs/screenshots/ and uncomment.
## Demo
![Home](docs/screenshots/home.png)
[Watch the video](https://youtu.be/...)
-->

## Run locally

```bash
npm install
cp .env.example .env   # add your Supabase URL and anon key
npm run dev
npm test
```

Setup details and admin promotion are in [README.pt.md](README.pt.md).

## License

Copyright (c) 2026 Munir Habib. All rights reserved. The source code is public for portfolio review only; see [LICENSE](LICENSE).
