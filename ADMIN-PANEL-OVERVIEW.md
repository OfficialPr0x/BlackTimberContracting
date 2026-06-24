# The Black Timber Operating System
### A full breakdown & peer review of the contractor admin panel

> **What this is:** A single, AI-powered back office that runs the whole non-swinging-a-hammer side of a contracting business — quoting, invoicing, getting paid, email, signatures, bookkeeping, and finding work — built for one operator to run a real company without a front-desk team.
>
> **Who it's for:** Solo contractors, small crews, and trades businesses (decks, framing, renovations, flooring, roofing, siding, structural) who are drowning in paperwork, losing quotes in their texts, chasing unpaid invoices, and doing admin at 11pm instead of being on the tools or with family.

This document is written contractor-to-contractor. It explains **what every part does, why it matters, and where it saves you real time and money** — plus an honest peer review of strengths and trade-offs at the end.

---

## Table of contents

1. [The problem this solves](#1-the-problem-this-solves)
2. [The big picture](#2-the-big-picture)
3. [Feature-by-feature breakdown](#3-feature-by-feature-breakdown)
   - [Dashboard — your money at a glance](#dashboard--your-money-at-a-glance)
   - [Onsite Estimator — quote from the jobsite with your phone](#onsite-estimator--quote-from-the-jobsite-with-your-phone)
   - [Quotes, Estimates & Invoices](#quotes-estimates--invoices)
   - [Inbox — a full AI email client](#inbox--a-full-ai-email-client)
   - [E-Sign — get contracts signed without DocuSign fees](#e-sign--get-contracts-signed-without-docusign-fees)
   - [AI Bookkeeper — your paperwork, filed for you](#ai-bookkeeper--your-paperwork-filed-for-you)
   - [Leads — AI prospect finder + CRM](#leads--ai-prospect-finder--crm)
   - [Cmd+K — talk to your software](#cmdk--talk-to-your-software)
4. [The AI engine under the hood](#4-the-ai-engine-under-the-hood)
5. [Security & data ownership](#5-security--data-ownership)
6. [The tech stack (why it's solid)](#6-the-tech-stack-why-its-solid)
7. [A day in the life](#7-a-day-in-the-life)
8. [Where the value is (ROI)](#8-where-the-value-is-roi)
9. [Honest peer review](#9-honest-peer-review)
10. [What you need to run it](#10-what-you-need-to-run-it)

---

## 1. The problem this solves

Most contractors run their business out of three places: a phone full of texts and photos, a truck full of crumpled receipts, and a head full of "I need to follow up with that guy." The result:

- **Quotes take all night** to write up and look unprofessional.
- **Invoices go out late** (or never), and you can't remember who still owes you.
- **Receipts get lost**, so tax time is a nightmare and you overpay.
- **Leads slip through the cracks** because there's no follow-up system.
- **Email is a mess** — important client threads buried under spam.
- **You're paying** for QuickBooks + DocuSign + a CRM + an email service + a quoting tool, and none of them talk to each other.

This system replaces that whole pile of subscriptions and sticky notes with **one back office that actually connects** — a quote becomes an invoice becomes a signed contract becomes a tracked payment becomes a filed record, automatically.

---

## 2. The big picture

There are **seven tools** behind one login, all sharing the same data:

| Tool | What it replaces | Core job |
|---|---|---|
| **Dashboard** | Mental math / spreadsheets | See what you're owed and what you've collected |
| **Onsite Estimator** | Notepad + late-night quoting | Quote a job from your phone, on site, with photos + voice |
| **Quotes / Estimates / Invoices** | Word docs, quoting apps | Branded documents with BC tax done right |
| **Inbox** | Gmail + a VA | Full email client that drafts and replies for you |
| **E-Sign** | DocuSign ($$/mo) | Get quotes & contracts legally signed |
| **AI Bookkeeper** | Shoebox of receipts + bookkeeper hours | Files receipts and keeps your books current |
| **Leads** | Buying lead lists | AI finds GCs/developers to partner with |

The thread that ties it together: **AI that understands your business** — your trades, your region, your suppliers, your tax rules — not a generic chatbot.

---

## 3. Feature-by-feature breakdown

### Dashboard — your money at a glance

**What it is:** The first screen after login. The financial pulse of the business.

**What it does:**
- Shows **Total invoiced**, **Deposits collected**, and **Outstanding owing** across *all* invoices — with animated counters and a collection-progress bar so you instantly see how much of your billed work is actually in the bank.
- An **Outstanding** tab lists every unpaid invoice, **overdue ones first**, with an "overdue only" filter — so you know exactly who to call to get paid.
- A **Recent deposits** feed shows the latest payments (cash, e-transfer, credit card) as they come in.
- Quick stats on recent documents and your active pipeline, plus one-tap launchers into every tool.

**Why it's valuable:** Most contractors have *no idea* what they're owed at any given moment. This turns "I think people owe me a few grand?" into "**$8,400 outstanding, $3,100 of it overdue — call these three.**" That clarity alone gets invoices paid faster.

*Files: `src/app/admin/(panel)/page.tsx`, `src/components/admin/DashboardFinancePanel.tsx`, finance rollup in `src/lib/admin/invoice-payments.ts`.*

---

### Onsite Estimator — quote from the jobsite with your phone

**What it is:** A mobile-first AI estimator you use **standing in the customer's backyard**.

**What it does:**
- **Open the live camera right in the app** and snap multiple job-site photos in a row (rot, framing, access issues, dimensions) — no leaving the page, no fumbling with the gallery.
- **Talk to it** — hold the mic, describe the job out loud ("rebuild this 12x16 deck, PT framing, cedar boards, customer is Dave"), and it transcribes your voice (OpenAI Whisper).
- The AI **reads the photos**, understands the scope, and builds a **live line-item estimate with real totals** in front of you.
- When it looks right, you say **"create the estimate"** and it saves a real document and gives you a PDF link. Say **"send it to Dave for signature"** and it does.

**Why it's valuable:** This is the killer feature. You can **walk a job, quote it, and send it before you leave the driveway**. The contractor who quotes on the spot wins the job over the three guys who say "I'll get back to you next week." It turns hours of evening quoting into a 5-minute conversation on site.

*Files: `src/components/admin/EstimatorChat.tsx`, `CameraCapture.tsx`, `src/app/api/admin/concierge/route.ts`, `src/lib/admin/estimator-actions.ts`. Vision model: Claude Sonnet 4.5. Voice: Whisper.*

---

### Quotes, Estimates & Invoices

**What it is:** One builder for all three document types — they share the same engine and convert into each other with one click.

**What it does:**
- **Line items** with quantity, unit (each / linear ft / sq ft / box / hour / day / lot), price, supplier source, and lead time.
- **BC tax done correctly** — handles the real-property-install rule (GST only) vs supply-only (GST + PST), mixed jobs, and exempt work. *This is something generic quoting tools get wrong constantly.*
- **Server-calculated totals** — the math is recomputed on every save, so a typo or a tampered browser can never push out a wrong grand total.
- **Branded PDF** — your logo, your colors, clean line tables, tax breakdown, and a signature block (on quotes) or payment terms (on invoices), generated instantly.
- **Convert in one click** — quote → estimate → invoice, keeping all the line items and customer info.
- **Email it straight to the customer** as a PDF from your business address (`jaryd@blacktimber.ca`), and it automatically **marks the document "sent"** and logs it in your Sent folder.
- **Invoice payment tracking** — record deposits as they come in; when the balance hits zero, the invoice **auto-flips to "Paid"** and updates the dashboard.
- **AI "suggest line items"** — describe the job and the AI drafts a grounded set of line items (priced against real regional supplier ballparks) you can edit.

**Why it's valuable:** A professional, accurate, branded quote in minutes instead of an hour — and one that you can convert to an invoice and actually get paid on, all in the same place. The tax handling alone protects you from over- or under-charging GST/PST.

*Files: `src/app/admin/quote-builder.tsx`, `src/app/admin/(panel)/quotes/*`, `src/lib/admin/quotes*.ts`, `quote-totals.ts`, `BrandedDocument.tsx`, `src/lib/admin/send-document-email.ts`.*

---

### Inbox — a full AI email client

**What it is:** A complete, Gmail-style email client for your business domain — built in, not bolted on.

**What it does:**
- **Multiple mailboxes** (e.g. `jaryd@`, `info@`, `accounts@`) with custom signatures.
- Full **send / receive / reply / forward**, real **threading**, folders (Inbox, Sent, Archive, Spam, Trash, Starred), and Gmail-style categories (Primary, Promotions, Social, Updates).
- **Real-time** new-mail updates and search.
- **AI writes your emails.** Tell it the gist ("confirm the deck quote, propose starting Monday") and it drafts a professional reply *with full knowledge of the thread*. Pick a tone (professional, friendly, warm, concise, formal, apologetic, persuasive) or one-tap **Improve / Shorten / Expand / Fix grammar**.
- **AI signatures** — generates a clean, branded HTML signature for any mailbox.
- Attachments, deliverability tracking (delivered / opened / bounced).

**Why it's valuable:** Email is where deals are won and lost, and most contractors are bad at it because they hate writing. This makes you look like you have an assistant — polished, fast replies in the right tone — without hiring one. And because quotes/invoices send from the same system, your client emails and your documents all live together.

*Files: `src/components/admin/email/*`, `src/lib/email/*`, `src/app/api/admin/email/*`. Email engine: Resend. AI drafting: Claude Sonnet 4.5.*

---

### E-Sign — get contracts signed without DocuSign fees

**What it is:** Your own electronic-signature system, built in.

**What it does:**
- Turn any saved quote/estimate/invoice into a **signing envelope** and email the client a secure portal link.
- Client opens a clean page, reviews the document, types their signature (choice of signature fonts), fills legal name/title/company/address, and consents under **BC's Electronic Transactions Act**.
- **Track the lifecycle** — sent → viewed → signed → (or void) — and get notified at each step.
- Every signed document comes with a **Certificate of Completion** (legal name, email, address, timestamps) emailed to both you and the client for your records.

**Why it's valuable:** DocuSign-style tools cost $15–$45/month and up. This is included, branded as *your* company, and wired directly to your quotes — so "send it for signature" is one action, not a separate app and another subscription. Signed contracts protect you on change orders and disputes.

*Files: `src/app/admin/(panel)/esign/*`, `src/lib/esign/*`, public portal `src/app/sign/[slug]/*`. Emails sent from your business address via Resend.*

---

### AI Bookkeeper — your paperwork, filed for you

**What it is:** A document vault plus an AI assistant that keeps your books organized.

**What it does:**
- A **file vault** (folders, notes, spreadsheets, images) with an Excel viewer built in.
- **Snap a receipt** and the AI **reads it, names it, and files it** into the right folder (Receipts, Bank & Deposits, Tax & GST, Subcontractors) with a clean record — *it will never invent a dollar amount it can't see on the photo.*
- **Chat with your books** — ask "what's outstanding?", "what did I spend at the supplier this month?", "which quotes haven't been signed?"
- **Proactive alerts** — it flags missing receipts, unsigned quotes, and open receivables before they become a problem.
- **One-click archive** of all your quotes/invoices into the vault.

**Why it's valuable:** This is the difference between a smooth tax season and a panicked April. Receipts get captured *the moment you get them* instead of disintegrating in your truck. Your bookkeeper (or accountant) gets a clean, organized vault instead of a shoebox — which means fewer billable hours and fewer missed deductions.

> ⚠️ It organizes and surfaces your numbers; it is **not** a replacement for a CPA or for filing advice. Think "always-current shoebox + smart assistant," not "accountant."

*Files: `src/app/admin/(panel)/bookkeeper/*`, `src/components/admin/bookkeeper/*`, `src/app/api/admin/bookkeeper/route.ts`, vault at `src/app/api/admin/files/*`.*

---

### Leads — AI prospect finder + CRM

**What it is:** A pipeline for incoming leads *and* an AI that goes out and finds new B2B work.

**What it does:**
- **Site CRM:** every lead from your website (quote wizard, pricing tool, contact forms, exit-intent popups) lands here with status tracking (new → contacted → estimate → booked → won/lost), notes, and the AI estimate range the customer saw.
- **AI Prospect Finder:** tell it a focus (general contractors, developers, design-build firms) and a region, and it **searches the web, scores prospects 0–100 on fit**, explains *why* each is a good partner, and finds a collaboration angle — then saves them to your pipeline.
- **Pipeline CRM** to work those prospects (researching → contacted → qualified → partner).

**Why it's valuable:** Two ways to grow: stop leaking the leads you already get, and proactively find subcontracting/partnership work with bigger players instead of buying junk lead lists. It's a business-development engine, not just a contact list.

*Files: `src/app/admin/(panel)/leads/*`, `src/components/admin/leads/*`, `src/lib/leads/prospect-agent.ts`. Web search via SerpAPI/Perplexity; portfolio-aware matching.*

---

### Cmd+K — talk to your software

**What it is:** A command palette in the quote builder. Hit **Cmd/Ctrl+K**, describe a job in plain English (or paste a screenshot of a text thread / supplier quote), and the AI **fills in the form for you** — without overwriting fields you've already typed.

**Why it's valuable:** It reads messy real-world inputs (customer texts, handwritten notes, product labels, supplier quotes) and turns them into a structured quote. Paperwork at the speed of talking.

*File: `src/app/admin/cmd-k.tsx` → `src/app/api/admin/quotes/parse`.*

---

## 4. The AI engine under the hood

This isn't "ChatGPT bolted on." It's a purpose-built AI layer:

- **Right model for each job** — it routes to the best model per task (Claude Sonnet 4.5 for quoting & writing, Gemini Flash for fast form-fills, Perplexity for web research) and **automatically falls back** to a backup model if one is slow or down. You never see an outage.
- **Grounded in your business** — every AI prompt knows the trades, the East Kootenay market, regional labor rates, **Fernie Home Hardware** stock vs special-order, and BC's GST/PST rules. It doesn't hallucinate generic answers.
- **Cost-capped** — every AI request has a hard dollar ceiling, so a runaway prompt can never run up a surprise bill.
- **Validated** — AI responses are checked against strict schemas before they touch your data, so you don't get garbage line items or malformed documents.

*Files: `src/lib/openrouter/*`, `src/lib/openai/whisper.ts`, `AI_INTEGRATION.md`.*

---

## 5. Security & data ownership

- **Your data is yours.** It runs on your own database (Supabase) and email (Resend) — not locked inside someone else's SaaS.
- **Locked down** — admin is behind a password with a cryptographically signed session; sessions expire; the database blocks any direct browser access (everything goes through the server).
- **Rate-limited** — every AI and API endpoint is throttled to prevent abuse and cost spikes.
- **No customer-data resale, no per-seat creep** — it's your system, running for your business.

*Files: `src/lib/admin/session.ts`, `src/proxy.ts`, `src/lib/rate-limit.ts`.*

---

## 6. The tech stack (why it's solid)

Built on modern, production-grade tooling — the same stack serious software companies use:

| Layer | Technology |
|---|---|
| Framework | Next.js 16 + React 19 |
| Database & storage | Supabase (Postgres) |
| Email | Resend (send, receive, webhooks) |
| AI | OpenRouter (multi-model) + OpenAI Whisper |
| Documents | Server-validated, branded PDF generation |
| Hosting | Vercel (fast, global, auto-scaling) |

This matters because it means the system is **fast, reliable, mobile-first, and maintainable** — not a fragile no-code patchwork that breaks when you sneeze.

---

## 7. A day in the life

> **8:10 am** — On site for a deck estimate. Open the Onsite Estimator, snap 4 photos, talk through the scope. AI builds the estimate. Say "create it and send to the customer for signature." Done before coffee.
>
> **11:30 am** — Customer emails a question. Inbox AI drafts a warm, professional reply that already references the thread. One edit, send.
>
> **2:00 pm** — Pick up materials. Snap the receipt into the Bookkeeper; it's filed under Receipts with the amount and date.
>
> **4:45 pm** — Glance at the Dashboard: $3,100 overdue across two invoices. Tap to call. One pays by e-transfer; you record it and the invoice flips to Paid automatically.
>
> **Evening** — No quoting. No paperwork. You already did it from your phone.

---

## 8. Where the value is (ROI)

| Pain | Before | With this system |
|---|---|---|
| Writing a quote | 45–90 min at night | 5 min on site |
| Getting it signed | Print/scan or DocuSign sub | One tap, signed online |
| Sending an invoice | Days late, manual | Convert quote → send → tracked |
| Knowing who owes you | Guesswork | Exact $ on the dashboard |
| Receipts at tax time | Shoebox panic | Filed the day you got them |
| Replying to clients | Slow, awkward | AI-drafted, professional |
| Finding new work | Buying lead lists | AI prospect finder |
| **Monthly software** | QuickBooks + DocuSign + CRM + email + quoting tool | **One system** |

The headline: **get more jobs (quote faster on site), get paid faster (tracked invoices + e-sign), and pay less tax (no lost receipts) — while cancelling a stack of subscriptions.**

---

## 9. Honest peer review

A fair assessment — what's genuinely strong, and what to know going in.

**Strengths**
- **Genuinely integrated.** The quote→invoice→sign→pay→file loop is one continuous flow, which almost no off-the-shelf combo achieves.
- **The onsite mobile estimator is a real edge** — quoting on site with photos + voice is a closing advantage most competitors don't have.
- **The AI is grounded**, not generic — regional pricing, supplier knowledge, and correct BC tax handling are baked in.
- **Built on a serious, modern stack** with proper security, cost controls, and data ownership.
- **It's genuinely mobile-first** where it counts (estimator, inbox), so it works from the truck.

**Things to know / trade-offs**
- **It's currently single-operator by design.** One login, one business. Multi-user crews/roles would be a future addition.
- **It depends on a few services** (Supabase, Resend, an AI provider, optionally a web-search API). They're cheap and standard, but they need to be set up with API keys.
- **The AI estimates a starting point, not gospel.** It's explicitly designed to need a final human/site confirmation before pricing goes out — which is correct, but it's an assistant, not autopilot.
- **The Bookkeeper organizes; it doesn't file your taxes.** It makes your accountant's job easier; it doesn't replace one.
- **PDF generation happens in the browser**, so you generate/email a document from the device that has it open — reliable, but worth knowing.

**Verdict:** This is what a contracting business would build if a senior software team sat in the truck with them for a month. It's not a toy; it's an operating system for a trades business, and the onsite-quoting + integrated-paperwork combo is the standout.

---

## 10. What you need to run it

To stand up your own instance, you provide:
- A **Supabase** project (database + file storage) — free tier works to start.
- A **Resend** account on your verified domain (for email send/receive).
- An **AI provider key** (OpenRouter), and optionally an **OpenAI** key for voice and a **web-search** key for the prospect finder.
- An admin password.

Everything is environment-driven, so your business name, region, phone, tax numbers, and branding are configured without touching code.

---

*Built for Black Timber Contracting (Cranbrook · East Kootenay · BC) — and adaptable to any trades business. This document reflects the current feature set of the admin panel.*
