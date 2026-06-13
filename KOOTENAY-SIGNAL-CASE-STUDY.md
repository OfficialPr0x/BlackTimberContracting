# Black Timber Contracting — Agency Case Study & Peer Review

**Built by [Kootenay Signal](https://www.kootenaysignal.com)** — brand, web, marketing systems, and applied AI for contractors and trades.

> A full teardown of what we designed and engineered for Black Timber Contracting: a rugged premium contractor brand turned into a conversion-first website, an AI tool suite, and a complete back-office operating system. Written agency-to-agency — the way we'd review a serious build.

---

## TL;DR — What we shipped

We didn't build a "contractor website." We built a **revenue system** with three layers:

1. **A consumer marketing site** engineered to convert cold homeowners into booked site visits — with five distinct AI tools doing the selling.
2. **An education funnel** (the Kootenay Homeowner Field Guide) that positions Black Timber as the regional authority and captures leads on every page.
3. **A full admin operating system** — quotes, estimates, invoices, e-signatures, an AI bookkeeper, a multi-channel CRM, and a B2B prospecting agent — that runs the business after the lead comes in.

All of it sits on a modern stack (Next.js 16, React 19, Tailwind 4, TypeScript 5, Supabase, Zod 4) with a hardened, production-grade AI layer routing across Claude, GPT-5, Gemini, Perplexity, and Flux.

**The thesis:** most contractors buy a brochure. We build the machine that books the job, prices it, signs it, and files the paperwork.

---

## Why this matters (the marketing argument)

Most contractors in the Kootenays — and frankly most trades across BC — compete on three things: a logo, a Facebook page, and "we'll get you a quote." That's a commodity. It's a race to the bottom on price.

Black Timber competes on **perceived organization and authority**. When a homeowner lands on this site, three thoughts fire in order:

1. *"These guys are organized."*
2. *"These guys actually understand local homes."*
3. *"I should get my project together before I spend money."*

That psychology is engineered, not accidental. Every section is built to move a nervous homeowner from *"I'm thinking about a deck"* to *"I just booked a site visit and downloaded their manual"* — without a salesperson touching them.

This document breaks down exactly how.

---

## 1. Brand & Design System

**Positioning:** Rugged premium Kootenay contractor. Think Patagonia field report meets luxury mountain lodge meets construction field manual. No startup fluff, no cheesy contractor clip art.

**Visual language (codified in a real design system, not vibes):**

| Token | Value | Role |
|---|---|---|
| Timber gold | `#c5a880` | Primary accent, CTAs, authority signals |
| Brand black | `#0b0a09` | Base canvas |
| Charcoal | `#141311` | Panels, cards |
| Weathered white | `#f5f4f0` | Body + headings |
| Geist Sans / Geist Mono | — | Modern sans for copy, mono for "field data" (prices, specs, phone) |

The mono typeface is a deliberate move: prices, snow-load values, and stats render in monospace so they read like **field instrumentation**, not marketing numbers. Small detail, big trust impact.

**Motion & atmosphere** — all hand-built in CSS/Tailwind + native browser APIs (no Framer Motion bloat):

- Cinematic Ken Burns hero crossfades
- Cursor-following gold spotlight (`MouseSpotlight`, disabled on touch + reduced-motion)
- Film grain, cinema vignettes, gold shimmer headlines
- Scroll-driven reveals using modern CSS `animation-timeline: view()`
- Glass panels with hover lift
- Accessibility-aware throughout (`prefers-reduced-motion` respected)

The result reads like a $25k custom build because the detail density is that of a $25k custom build.

---

## 2. The Consumer Site — A Conversion Machine

The homepage (`src/app/page.tsx`) is a single orchestrated funnel. Here's the flow we engineered, top to bottom, mapped to buyer psychology:

| Section | Component | Marketing job |
|---|---|---|
| **Cinematic hero** | `page.tsx` | "Real Work. Real Standards. Real Results." — trust chips (87+ reviews, BC Licensed, free quote in 60s), dual CTAs |
| **Reviews ticker (×2)** | `ReviewsTicker` | Social-proof velocity — scrolling Kootenay-city reviews |
| **Before/After wall** | `BeforeAfterWall` | The "Holy Sh*t Wall" — drag-to-reveal real transformations with budget + timeline |
| **Interactive Design Suite** | `DrawItOut`, `ProjectCheck` | "Black Timber OS" — AI tools that engage before contact |
| **No-BS pricing engine** | `CostCalculator` | Live pricing transparency — disarms the #1 homeowner fear |
| **Meet Jaryd** | `MeetJaryd` | Founder trust — "hire the builder, not a sales funnel" |
| **Job gallery** | `JobGallery` | Portfolio proof with lightbox |
| **Why projects go wrong** | `WhyProjectsGoWrong` | Objection handling — names the failure modes, then solves them |
| **Contractor Netflix** | `ContractorTV` (Coming Soon) | Content-marketing teaser / brand entertainment |
| **Live project map** | `LiveMap` | Local density signal |
| **Client command center** | `ProjectPortal` | Shows the post-sale experience (retention selling) |
| **Live KPI counters** | `AnimatedCounter` | 140+ builds, 87+ reviews, 12+ yrs — viewport-triggered count-up |
| **Final CTA + footer** | `page.tsx` | Service-area coverage, 3 contact paths, field guide link |
| **Exit-intent popup** | `ExitIntentPopup` | Abandonment recovery → field guide capture |

Every CTA routes to one of two actions: **open the AI Quote Wizard** or **call the number**. There's no dead end on the page.

---

## 3. The AI Tool Suite — Five Tools That Sell

This is where the build separates from anything else in the regional market. Five customer-facing AI tools, each tied to a buyer's real anxiety, all running on one hardened integration layer.

### 3.1 AI Quote Wizard — the conversion engine
A 5-step modal funnel (`QuoteWizard.tsx`): project specs → photo upload → **AI analysis** → instant priced quote → book a site visit.

- Uses a **vision model** to read uploaded site photos and produce a structured estimate: min/max range, materials/labor/permits breakdown, timeline, scope inclusions, **risk factors**, and East Kootenay regional notes.
- Honest UX: a live progress log ("Cross-referencing East Kootenay snow load…") that's real, not theater.
- Generates a **branded, downloadable PDF estimate** client-side.
- Auto-saves an anonymous lead at quote generation, then a full contact lead at booking — so even abandoners are captured.
- **Deterministic fallback:** if the AI fails, a pricing engine still returns a credible range. The tool never breaks in front of a customer.

### 3.2 Draw It Out — AI design mockups
Homeowner sketches a deck/fence/pergola on an HTML5 canvas (optionally over a photo of their yard) → a vision model interprets it → an image model returns a **photorealistic concept render**. Clearly disclaimed as a concept, not a permit drawing. This is dream-building that converts.

### 3.3 Project Check — Kootenay property intelligence
Enter an address → a **web-grounded model** (Perplexity Sonar) returns slope %, elevation, snow load (kPa), frost line, sun hours, wind category, permit authority, whether an engineer's stamp is likely needed, and suggested materials. It gates the full brief behind an email. This single tool makes Black Timber look like they've already surveyed your lot.

### 3.4 Cost Calculator — live pricing + AI sanity-check
Real-time deck pricing with sliders (no email gate — pure transparency), plus an optional "have AI sanity-check this price" that narrates the estimate and can adjust the range with a regional reasoning note.

### 3.5 Concierge Chat — the always-on field assistant
A streaming AI chat (`ConciergeChat`) mounted site-wide. Answers permit/budget/material questions in clean markdown, then points users to the right tool or the phone. Never hard-quotes — always a range plus a site visit.

**Why this is a marketing weapon:** each tool resolves a specific objection (*"how much?", "what will it look like?", "is my lot even buildable?", "can I trust the price?", "I have a quick question"*) **before** a human is involved. The homeowner self-qualifies and arrives warm.

---

## 4. The Field Guide — Authority-as-a-Lead-Magnet

Most contractors hand out a coupon or a generic checklist. We built **"The Kootenay Homeowner Project Readiness & Resilience Manual"** — an 18-chapter field guide covering permits, snow loads, FireSmart/wildfire, flood & drainage, landslide risk, radon, rebates, contractor red flags, budgeting, and emergency prep. It reads like something from a municipality or an engineering firm — which is exactly the point.

**The funnel (`/field-guide`)** — rebuilt to a premium standard:

- Cinematic hero with a "locked field manual" signup card (name + email → instant access).
- Authority strip (18 chapters · 5 towns · RDEK/RDCK · red flags).
- 18-chapter preview grid, visual proof cards, trust split, FAQ, aggressive final CTA.
- Scroll-driven reveals, topographic identity, weathered-white-on-charcoal treatment.

**The reader (`/guide`)** — a password-protected, beautifully typeset manual with:

- A sticky left **table-of-contents sidebar** with scroll-spy active highlighting.
- **Real project spotlights** woven through the content (challenge → solution → timeline → result) with before/after photography.
- Recurring "book a walkthrough" CTAs every few sections.
- An aggressive final "Next Step" page mapping the journey: **Guide → AI Assistant → Free Walkthrough → Quote → Job.**

**The lead progression** is the genius part. The guide doesn't just educate — it routes. By the last page, the reader has been walked from *passive reader* to *booked walkthrough* with the contractor positioned as the trusted guide the entire way.

**SEO-engineered:** dedicated metadata, Open Graph/Twitter cards on the branded cover, canonical URLs, 13 keyword targets, and full **JSON-LD structured data** (Organization, WebPage, DigitalDocument, and an FAQPage eligible for Google rich results).

This is the asset you put a QR code on — trucks, hoodies, yard signs, estimate forms. It makes a small crew look larger and more established than companies that have been around for decades.

---

## 5. The Admin Operating System — Where Most Agencies Stop, We Kept Going

Anyone can build a marketing site. We built the **back office that runs after the lead lands** — a complete internal ops suite behind HMAC-secured authentication.

### 5.1 Quote / Estimate / Invoice Builder
A two-pane document builder producing three document types (Quote `Q-…`, Estimate `E-…`, Invoice `I-…`) with **BC-correct tax logic** baked in:

- `real_property_install` → GST 5% only
- `supply_only` → GST + PST 7%
- `mixed_split` → split-contract handling
- `exempt` → PST exempt

Plus a **⌘K AI command palette** that parses pasted text *and screenshots* (vision) into a structured draft, an **AI line-item suggester**, server-side total recomputation as source of truth, and **instant branded PDF download** (client-side via html2canvas + jsPDF — no server rendering, works on serverless).

### 5.2 E-Signature System
A full tokenized e-sign flow: generate an envelope from a saved quote or vault file → send a secure `/sign/[token]` link → client views and signs on a signature pad → status tracks draft → sent → viewed → signed, with Resend email notifications to both parties at each stage. No DocuSign subscription required.

### 5.3 AI Bookkeeper & Document Vault
A file-tree "IDE" with an AI chat pane. Drop in a receipt photo and the AI **reads it (vision), files it, renames it, and writes a markdown bookkeeping record** into the right folder (Receipts, Tax & GST, Bank & Deposits, Subcontractors…). It can also archive quotes, sync live documents into the vault, and even trigger an e-sign — all via validated, server-executed structured actions. Includes a spreadsheet viewer for Excel/CSV.

### 5.4 Multi-Channel CRM
A lead-delivery pipeline (`deliverLead()`) that **fans out every lead to four sinks simultaneously** — local file (always), Resend email, Slack webhook, and Supabase — with failures isolated so a lead is never lost. The admin CRM has four workspaces: Popup Subscribers, Site Leads (quote-wizard pipeline with status workflow), AI Prospect Finder, and a saved Pipeline.

### 5.5 AI B2B Prospecting Agent
An outbound growth tool: it searches for general contractors and developers in the region (SerpAPI + web-grounded model), scores their fit, and saves them to a pipeline with a status workflow (new → researching → contacted → qualified → partner). This is lead *generation*, not just lead *capture* — most contractor sites have nothing like it.

### 5.6 Ops Concierge with Voice
An internal AI assistant for day-to-day ops and follow-up drafting, with **voice input** via OpenAI Whisper transcription.

---

## 6. The AI Engineering — Production-Grade, Not a ChatGPT Wrapper

This is the part that earns the "we know AI" claim. The integration layer (`src/lib/openrouter/`) is built like infrastructure:

- **9-task model routing** — each AI job (quote, intel, sketch, mockup, explain, parse, chat, prospect, fallback) routes to a purpose-chosen model and is **env-overridable** without a code change. We route across Claude Sonnet 4.5, GPT-5, Gemini 2.5 Pro/Flash, Perplexity Sonar, and Flux — best tool for each job.
- **Fallback chains** — on a 5xx, timeout, empty response, *or schema violation*, the call automatically walks to the next model. Customers never see a hard failure.
- **Zod 4 as a single source of truth** — the same schema validates the HTTP input, generates the JSON Schema sent to the model, and validates the model's output. Type-safe end to end.
- **Cost governance** — per-request USD caps (`$0.50` default, `$1.50` mockups, `$0.85` prospecting) with cost logged per call via OpenRouter usage tracking.
- **Defense in depth** — per-IP sliding-window rate limits on every endpoint, honeypot fields on public forms, a 30-minute cache on site-intel, and NDJSON structured logging of every AI call (task, model, tokens, cost, latency).
- **Graceful degradation** — public tools fall back to deterministic engines (pricing, default Kootenay site profile) rather than erroring.
- **Domain-specific prompt engineering** — versioned prompts grounded in BC building code, real Fernie Home Hardware supplier pricing, and regional snow-load/frost-line defaults, with hard rules against inventing permit codes.

The API key never touches the browser — every call is proxied through hardened server routes.

---

## 7. The Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router), React 19.2, TypeScript 5 |
| Styling | Tailwind CSS 4 with custom `@theme` brand tokens |
| Validation | Zod 4 (input + AI output) |
| Database | Supabase (PostgreSQL + RPCs + RLS + Storage) |
| AI orchestration | OpenRouter (direct fetch, no SDK) across 6+ model providers |
| Voice | OpenAI Whisper |
| Web grounding | Perplexity Sonar + SerpAPI |
| Email | Resend (leads + e-sign notifications) |
| PDF | html2canvas + jsPDF (client-side, serverless-friendly) |
| Images | Cloudinary |

**Resilience pattern worth noting:** several subsystems use **dual persistence** — Supabase in production, local JSONL on disk in dev — so the whole platform runs offline on a fresh clone with zero config and degrades gracefully if a service is down.

---

## 8. Peer Review — Scorecard

Reviewing this the way we'd review any serious build:

| Dimension | Score | Notes |
|---|---|---|
| Brand & visual craft | 9.5/10 | Cohesive design system, cinematic detail density, accessibility-aware |
| Conversion architecture | 9.5/10 | No dead ends; every section has a job; AI tools self-qualify leads |
| AI depth & engineering | 10/10 | Multi-model routing, fallbacks, cost caps, Zod end-to-end — genuinely production-grade |
| Local/market relevance | 10/10 | Hyper-specific to the Kootenays — towns, RDEK/RDCK, snow loads, FireSmart |
| Back-office completeness | 9.5/10 | Quotes, e-sign, AI bookkeeping, CRM, prospecting — a full business OS |
| SEO & shareability | 9/10 | Structured data, OG cards, keyword-targeted metadata |
| Lead generation system | 9.5/10 | Capture + progression + outbound prospecting |

**Overall: 9.6/10.**

### What makes it rare
Most contractor sites are a digital business card. This is an integrated system where the marketing site, the education funnel, the AI tools, and the back office are **one machine** — a lead enters cold at the top and exits as a signed, invoiced, filed job at the bottom, with AI accelerating every step.

---

## 9. What This Says About Kootenay Signal

If you're a contractor reading this on our site, here's the takeaway:

- **We understand your business** — BC tax rules, permit authorities, snow loads, the homeowner's real fears, the paperwork that eats your evenings.
- **We understand AI** — not as a buzzword, but as routed, validated, cost-governed infrastructure that actually books work and files receipts.
- **We build brands that convert and win** — premium craft on the surface, a revenue machine underneath.

We didn't make Black Timber a website. We made them look like the most organized, most established, most trustworthy contractor in the valley — and gave them the tools to run like it.

**That's the standard. That's [Kootenay Signal](https://www.kootenaysignal.com).**

---

*Prepared by Kootenay Signal as an internal/agency showcase. Black Timber Contracting serves Fernie, Sparwood, Elkford, Cranbrook, and Nelson, BC.*
