# Architecture

This document explains how EnergyIT is built and why. It is written from the code in this repository (`src/lib`, `supabase/migrations` and the tests).

## Map

Everything the app contains, by area.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, Arial, sans-serif','fontSize':'16px','lineColor':'#94a3b8','cScale0':'#4f46e5','cScaleLabel0':'#ffffff','cScale1':'#0891b2','cScaleLabel1':'#ffffff','cScale2':'#059669','cScaleLabel2':'#ffffff','cScale3':'#d97706','cScaleLabel3':'#ffffff','cScale4':'#db2777','cScaleLabel4':'#ffffff','cScale5':'#7c3aed','cScaleLabel5':'#ffffff','cScale6':'#2563eb','cScaleLabel6':'#ffffff','cScale7':'#0d9488','cScaleLabel7':'#ffffff','cScale8':'#ea580c','cScaleLabel8':'#ffffff','cScale9':'#9333ea','cScaleLabel9':'#ffffff','cScale10':'#16a34a','cScaleLabel10':'#ffffff','cScale11':'#e11d48','cScaleLabel11':'#ffffff'}}}%%
mindmap
  root((EnergyIT))
    Dashboard
      Clients and active contracts
      Consumption points
      Pending and paid commissions
      Total savings delivered
      GO alerts
      Renewals in 30 and 90 days
    Clients
      Clients
      Groups
      Consumption points
      Contract periods
      Renewal
    Invoices
      Upload
      Local PDF reading
      OCR fallback
      Confidence per field
      Warnings
      Human confirms
    Simulations
      Segment BTN BTE or MT
      Schedule and periods
      Consumption and contracted power
      GO per line
      Results table
      Recommendation
      Almost as good within 2 percent
      Commission estimate
      Funnel Draft Sent Converted Lost
    Contracts
      Contract lines
      Real savings
      Renewals
    Commissions
      Pending
      Paid
      Rules
    Proposals
      Client PDF
      Internal approval PDF
    Import
      CSV and Excel
      Row validation
    Alerts
      Days after sending
      Specific date
      Days before renewal
    Admin catalogue
      Pricing grid
      Products
      TAR
      Contracted power
      Commission rules
      Market indices
      Accounts
      Audit
    Security
      Private data per account
      Shared catalogue
      Role escalation blocked
      Audit triggers
    Realtime
      Catalogue changes pushed
    Gas
      Placeholder page
    Quality
      156 passing tests
    Platform
      React TypeScript Vite
      TanStack Query
      Tailwind and Recharts
      Portuguese and English
      Supabase
    Next steps
      Pricing on the server
      More invoice layouts
      Gas support
```

## Flow from start to end

The main path through the app, with its branches. Blue is a step, yellow a decision, green a good end state, orange a state that needs attention, red a blocked or flagged case.

```mermaid
%%{init: {'theme':'base','flowchart':{'curve':'basis','nodeSpacing':35,'rankSpacing':45,'padding':12},'themeVariables':{'fontFamily':'Inter, Segoe UI, Arial, sans-serif','fontSize':'15px','lineColor':'#64748b','edgeLabelBackground':'#ffffff','clusterBkg':'#f8fafc','clusterBorder':'#94a3b8','titleColor':'#334155'}}}%%
flowchart TD
  A("Login or register") --> B("Dashboard with KPIs")
  B --> C{Where does the client data come from}
  C -->|Manual| D("Create client and consumption point")
  C -->|Bulk| IMP("Import CSV or Excel with row validation")
  D --> INV("Upload the invoice")
  IMP --> INV
  INV --> T{PDF has enough text}
  T -->|Yes| X("Extract fields from the text")
  T -->|No or image| OCR("OCR in Portuguese up to 6 pages")
  OCR --> X
  X --> W("Fields with confidence level and warnings")
  W --> H("Consultant reviews and confirms each field")
  H --> F("Simulation form with segment, schedule, periods and power")
  F --> P("Pricing engine for each product")
  P --> G{GO above its price limit}
  G -->|Yes| NR("Never recommended")
  G -->|No| S("Saving against the current cost")
  S --> RES("Results sorted by saving, commission as tie breaker")
  RES --> REC("Recommendation and almost as good within 2 percent")
  REC --> COM("Commission estimate")
  COM --> DOC("Client PDF proposal and internal approval PDF")
  DOC --> FUN{Funnel state}
  FUN -->|Draft| F
  FUN -->|Sent| AL("Follow up alert days after sending or on a date")
  FUN -->|Lost| END1("Closed")
  FUN -->|Converted| CT("Contract with lines and periods")
  CT --> CM("Commission pending then paid")
  CT --> RS("Real savings recorded")
  CT --> RN("Renewal alert days before renewal")
  RN --> REN("Contract period renewed")

  subgraph Admin[Admin catalogue]
    ADM("Products, price variants, formulas, TAR, power, indices, commission rules") --> RT("Realtime push to open sessions")
    ADM --> AUD("Admin audit log")
  end
  RT -.-> P
classDef start fill:#4f46e5,stroke:#312e81,color:#ffffff,stroke-width:2px
classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f,stroke-width:2px
classDef act fill:#e0e7ff,stroke:#6366f1,color:#1e1b4b,stroke-width:1.5px
classDef good fill:#d1fae5,stroke:#059669,color:#064e3b,stroke-width:2px
classDef bad fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px
classDef amb fill:#ffedd5,stroke:#ea580c,color:#7c2d12,stroke-width:2px
class A start
class C,FUN,G,T dec
class END1,NR bad
class REN good
class ADM,AL,AUD,B,CM,COM,CT,D,DOC,F,H,IMP,INV,OCR,P,REC,RES,RN,RS,RT,S,W,X act
style Admin fill:#f8fafc,stroke:#94a3b8,stroke-dasharray:5 4,color:#334155
```

## 1. What the system does

A web ERP for an energy consultancy. A consultant uploads a client's electricity invoice, the app reads it, compares the client's current cost against a catalogue of supplier products, calculates estimated savings, generates a PDF proposal and computes the consultant's commission. It replaces an Excel pricing model with an auditable, database-backed workflow.

## 2. Big picture

```
 Browser (React SPA)
   |-- reads the invoice locally ........ pdf.js, Tesseract.js (OCR), no external API
   |-- pricing engine (mathjs) .......... runs in the browser on catalogue data
   |-- PDF proposals (jsPDF)
   |  supabase-js (user JWT)
   v
 Supabase
   |-- Auth ................ users, profiles, roles
   |-- Postgres ............ tables, RLS, audit triggers, views
   '-- Realtime ............ catalogue changes pushed to open sessions
```

Invoice data never leaves the browser for reading. The catalogue and calculation rules live in the database, the calculation itself runs in the client.

## 3. Invoice reading (`src/lib/invoiceReader.ts`, `invoiceExtraction.ts`)

1. **Read the file.** A PDF is read as native text first. If it has fewer than 100 characters, or more than 10% non-printable characters, it is treated as scanned: each page is rasterised and read with OCR in Portuguese (at most 6 pages). Images go straight to OCR. The libraries load only when needed.
2. **Extract fields.** Pure functions turn the page text into structured fields (CPE, dates, segment, schedule, periods, active energy, TAR, contracted power). Each field carries a confidence level (HIGH, MEDIUM, LOW) and the page where it was found. VAT, discounts, taxes and totals are deliberately ignored, so they are never mistaken for energy.
3. **Warn.** The extractor returns warnings for risky cases (several CPEs, estimated consumption, supplier change, low scan quality, unknown vocabulary).
4. **Human confirms.** Nothing fills the form on its own. The consultant reviews and confirms each field before it enters any calculation.

This design accepts that OCR and heuristics are imperfect, and puts a person at the point where an error would become money.

## 4. Pricing engine (`src/lib/pricingEngine.ts`, `formulaGrid.ts`)

- Supplier products, price variants, formulas, regulated tariffs (TAR) and market indices are **data in the database**, not code. Admins change them without a new release.
- Formulas are stored as expressions and evaluated safely with **mathjs** inside a scope built from the catalogue (market indices and the computed GO value of each product).
- For each product the engine computes energy cost per period, with and without TAR, and the saving against the current cost. Results are sorted by saving, with commission priority as a tie-breaker.
- **Recommendation:** products whose GO is above its price limit are never recommended, even if cheapest. Alternatives within a small margin (2%) of the best are shown as "almost as good".
- Commission is calculated from the commission rules and the client's annual consumption.

## 5. Data model (main tables)

- **People and business data:** `profiles`, `clients`, `grupos`, `pontos_consumo` (consumption points), `periodos_contrato`, `contracts`, `invoices`, `simulations`, `commissions`, `real_savings`, `alerts`, `documents`.
- **Catalogue (global):** `suppliers`, `products`, `product_energy_prices`, `product_price_variants`, `pricing_formulas`, `commission_rules`, `market_indices`, `tar_*` tables, `potencia_contratada_*`.
- **Audit:** `audit_log` (business data), `admin_audit_log` (catalogue and accounts).
- **Views for the dashboard:** revenue by month, commissions by status and supplier, funnel counts, upcoming renewals, total savings.

A simulation has a funnel state (draft, sent, converted, lost) and each consumption point has one active simulation.

## 6. Security model (two layers)

- **Business data is private per account.** Tables use RLS with `owner_id = auth.uid()` for all operations, with no admin bypass.
- **The catalogue is shared.** Every authenticated user can read it, and only admins can insert, update or delete (`public.is_admin()`).
- **Role escalation is blocked.** A trigger (`prevent_role_self_escalation`) stops users changing their own role.
- **Audit triggers** record changes to business tables and to the catalogue, with row-level history.
- The `search_path` of database functions is fixed, and a migration hardens it explicitly.
- **Session policy** in the client: "keep me signed in" lasts 30 days, otherwise the session ends when the browser closes. Storage access is wrapped in try/catch so the app works with storage blocked.

## 7. Realtime

The catalogue tables are published to Supabase Realtime, so an admin's price change reaches every open session immediately. The read-all RLS still decides who receives the broadcast.

## 8. Proposals and import

- `gerarPropostaPdf` builds the client-facing PDF proposal, and `gerarDocumentoAprovacaoInterna` builds an internal version with commissions (jsPDF).
- Clients and contracts can be imported from CSV or Excel. The parser and validators check each row before anything is saved.

## 9. Frontend

React, TypeScript and Vite, with TanStack Query for server state, react-router, Tailwind CSS 4, Recharts for the dashboard, and an i18n layer for Portuguese and English. Data access sits in hooks (`useClients`, `useSimulations`, `useCommissions`, and others).

## 10. Testing

156 passing tests with Vitest (4 more are skipped) cover the pricing engine, invoice extraction, invoice-to-form mapping, validators, PDF generation, simulation forms and contract lines. The engine and the extraction are pure functions, which is what makes them easy to test with fixtures.

## 11. How it was built

Developed with agentic AI coding (Claude Code), with sub-agents and agent skills in `.claude/` and `.agents/`. The domain rules came from the Excel model the system replaces, and the tests protect them.

## 12. Known limitations and next steps

- The pricing calculation runs in the client. Moving it to the server would make results reproducible server-side.
- Invoice extraction is heuristic and tuned to the invoice layouts it was developed against. New layouts may need new rules, which is why a human confirms each field.
- Gas is not implemented yet (there is a placeholder page).
