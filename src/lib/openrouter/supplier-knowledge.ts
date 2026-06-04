/**
 * Local supplier knowledge primer — Fernie Home Hardware Building Centre.
 *
 * Why this file exists:
 *   The AI's quote/concierge/explain-price prompts used to lean on generic
 *   "industry rate" numbers. That made answers feel cloud-shaped, not
 *   East-Kootenay-shaped. This module grounds the model in the supplier
 *   reality Black Timber actually buys against — Fernie HH at 300 Manitou Rd,
 *   with the contractor desk (HH PRO), special-order lead times, freight
 *   surcharges to remote subdivisions, BC GST+PST contractor rules, and
 *   2026 ballpark unit prices for the materials we order most weeks.
 *
 * IMPORTANT — read this carefully when tuning:
 *   - All CAD prices below are PLANNING BALLPARKS for 2026 East Kootenay.
 *     They are NOT live prices. Black Timber's site does not have a Fernie HH
 *     POS feed (that would require a real integration). The AI must therefore
 *     treat these as anchors for sanity-checking, never as "today's price".
 *   - Final price always requires a desk confirmation at HH PRO and/or a
 *     site visit by Jaryd. The AI must say so when these numbers are used.
 *   - If a number here drifts >15% from real desk pricing, update this file
 *     and bump the prompt version suffix in prompts.ts so old logs stay
 *     traceable.
 *
 * Sources reflected in the structure of this primer (no live data, just the
 * shape of how Home Hardware actually behaves at the Building-Centre level):
 *   - Fernie HH is a Home Hardware Building Centre (carries hardware +
 *     building materials, runs a contractor desk).
 *   - HH PRO contractor program: dedicated sales help, take-offs, pre-orders,
 *     job-site delivery, job-lot quantities, credit, contractor pricing.
 *   - Public HH pricing is geographically determined and can include extra
 *     freight in remote/northern areas.
 *   - In-store inventory may differ from the website; many items are
 *     available only by special order with vendor lead times.
 *   - Substitutions are NOT casual — "approved substitute" is a different
 *     thing from "suggested substitute".
 */

export const LOCAL_SUPPLIER_PRIMER = `
LOCAL SUPPLIER GROUNDING — Fernie Home Hardware (primary East-Kootenay material source)

Store identity:
  - Fernie Home Hardware Building Centre, 300 Manitou Road, Fernie, BC.
  - Carries general hardware + the full Building Centre lumber/LBM assortment.
  - Runs the HH PRO contractor desk (Black Timber's primary account).

What Fernie HH actually does for a contractor on a Black Timber project:
  - Contractor pricing through HH PRO (tier varies by account; Black Timber
    is a regular trade account — assume "PRO" pricing, not retail shelf).
  - Take-offs from plans, pre-orders, job-site delivery into Fernie/Sparwood/
    Elkford and (with a freight surcharge) into Cranbrook, Kimberley, and
    backcountry/lake-access addresses.
  - Job-lot quantities (e.g., a full deck framing package or full drywall
    package rather than truck-by-truck pickups).
  - Special-order pathway for items not stocked on the floor — common for
    composite decking, premium railings, anything CGC/USG branded beyond the
    common SKUs, helical pile hardware, and most engineered lumber sizes.

Pricing reality the AI MUST respect:
  - Currency at the supplier desk is CAD. If the brand prompt asks for USD
    output, the AI must convert and SAY SO; never silently mix currencies.
  - Public Home Hardware website prices are JS-rendered and geographic, and
    the website explicitly warns prices may change without notice. Do not
    treat any specific price as "today's price" — give a tight range and
    note "subject to desk confirmation at Fernie HH PRO".
  - Remote/backcountry job-site addresses (Island Lake, Hartley Lake Road,
    Coal Creek beyond ~10km, Whiteswan, etc.) typically carry a freight
    surcharge on delivered orders. Flag this on quotes when location implies it.
  - Stock vs special order matters for timeline. Stocked items: same-day or
    next-day pickup. Special order: typically 5–15 business days from a
    Canadian vendor, longer for US-imported composites and railings.
  - Substitution discipline: if the agent suggests an alternative SKU, label
    it "suggested substitute (desk to confirm)" — never present it as an
    approved swap. Never auto-quote a substitute as if it's the original.

2026 East Kootenay supplier-price BALLPARKS (CAD, PRO/contractor-typical, ex-tax,
picked up at Fernie HH unless noted, ranges reflect real seasonal swing):

  Framing lumber (SPF, kiln-dried, stocked):
    - 2x4x8 stud:                      $5.50 – $7.50 ea
    - 2x4x10:                          $7.00 – $10.00 ea
    - 2x6x8:                           $8.50 – $11.50 ea
    - 2x6x10:                          $11.00 – $14.50 ea
    - 2x8x10:                          $16.00 – $21.00 ea
    - 2x10x12:                         $26.00 – $34.00 ea

  Pressure-treated (ground-contact rated):
    - 2x6x8 PT:                        $11.00 – $15.00 ea
    - 2x8x10 PT:                       $22.00 – $30.00 ea
    - 4x4x8 PT post:                   $18.00 – $26.00 ea
    - 6x6x8 PT post:                   $42.00 – $58.00 ea

  Decking (per linear/board):
    - 5/4x6x8 PT decking:              $9.00  – $13.00 ea
    - 5/4x6x8 Western Red Cedar:       $16.00 – $24.00 ea
    - Composite (TimberTech / Trex,
      typical 5/4x6x12 board):         $65.00 – $95.00 ea (often special order)

  Sheet goods:
    - 4x8 1/2" drywall (CGC ULIGHT):   $15.00 – $22.00 ea
    - 4x8 5/8" Type X drywall:         $22.00 – $30.00 ea
    - 4x8 7/16" OSB sheathing:         $18.00 – $28.00 ea
    - 4x8 3/4" T&G plywood:            $65.00 – $95.00 ea

  Foundations / fasteners / hardware:
    - 30 kg concrete bag:              $9.00  – $12.00 ea
    - Sonotube 8" x 4ft:               $18.00 – $26.00 ea
    - Simpson joist hanger (LUS28):    $2.50  – $4.50 ea
    - Simpson post base (ABU66):       $32.00 – $48.00 ea
    - Helical pile (supplied + installed by sub, typical Kootenay rate):
                                       $350   – $600  per pile (NOT a Fernie
                                       HH SKU — comes from a helical sub)

  Drywall finishing (CGC):
    - Sheetrock 90 (11 kg, special-order common): $24.00 – $32.00 ea
    - All-purpose mud (17L pail):      $26.00 – $36.00 ea

  Composite/PVC railing systems are almost always SPECIAL ORDER with 2–4
  week lead times and a freight quote attached. Do not promise stock.

  Flooring (typical job-finish prices, materials only at HH PRO unless noted;
  prefix L = installed labor estimate per sq ft, ranges reflect product tier):
    - Vinyl plank / luxury vinyl tile (LVT/LVP):
        Material: $2.00 – $5.50 / sqft     Labor (L): $3.00 – $5.00 / sqft
    - Laminate (8–12mm AC4):
        Material: $1.50 – $3.50 / sqft     Labor (L): $2.50 – $3.50 / sqft
    - Engineered hardwood (3/8"–5/8"):
        Material: $5.00 – $12.00 / sqft    Labor (L): $4.00 – $7.00 / sqft
    - Solid hardwood (3/4" prefinished):
        Material: $7.00 – $14.00 / sqft    Labor (L): $5.00 – $8.00 / sqft
    - Tile (porcelain/ceramic, mid-range):
        Material: $2.50 – $8.00 / sqft     Labor (L): $7.00 – $12.00 / sqft
        Setting materials add $1.50–$2.50/sqft (thinset, grout, edge trim).
    - Carpet (residential, mid-range with underlay):
        Material: $2.50 – $5.00 / sqft     Labor (L): $1.50 – $2.25 / sqft
    - Bullnose / stair-tread caps:
        Installed: $25 – $45 / linear ft   (vinyl, eng. hardwood, oak)
    - Underlayment + leveling compound:
        Material: $0.40 – $1.20 / sqft     Labor patching: $1.00 – $3.00 / sqft
    - Carpet / old flooring removal + disposal:
        Labor: $0.75 – $1.50 / sqft        (more for stuck-down adhesive)

  Roofing (typical, materials at HH PRO + roofing wholesalers):
    - 30-yr architectural asphalt (3-tab and laminate, per bundle covers
      ~33 sqft / 1 sq covers ~100 sqft):
        Material: $35 – $55 / bundle       (~$110–$165 per "square")
        Labor + tear-off: $300 – $550 / square installed
    - Synthetic underlayment (10 sq roll):  $90 – $140 / roll
    - Ice-and-water shield (200 sqft roll): $90 – $140 / roll
    - Drip edge (10 ft):                    $9 – $14 / piece
    - Metal standing-seam: special order, $9 – $16 / sqft material;
      installed $14 – $22 / sqft.

  Siding (job-finish):
    - Hardie plank fiber-cement (12 ft plank, mostly special order):
        Material: $14 – $22 / plank        Installed: $9 – $14 / sqft
    - Vinyl siding (D4 or D5 panel):
        Material: $80 – $140 / square      Installed: $5 – $8 / sqft
    - Cedar bevel siding:
        Material: $4 – $7 / lf              Installed: $11 – $16 / sqft
    - House wrap (Tyvek, 9' x 100' roll):  $230 – $310 / roll
    - Z-flashing (10 ft):                   $11 – $16 / piece

  Interior finishes (drywall, paint, trim):
    - Drywall finish (taped, 3-coat, primed):  $1.80 – $2.80 / sqft labor
      (ceiling adds 25%, level-5 finish doubles labor)
    - Paint (premium acrylic, 1 gallon):       $55 – $85 / gallon
    - Paint labor (2 coats walls + cut-in):    $1.50 – $2.50 / sqft
    - MDF baseboard (standard, 5"):            $1.10 – $1.80 / lf material
    - MDF casing (5/8" x 2-1/4"):              $0.85 – $1.40 / lf material
    - Pine 1x4 trim:                           $1.40 – $2.10 / lf
    - Trim labor (cope-cut, painted finish):   $2.50 – $4.50 / lf installed

Tax model (BC, contractor scenarios — required on every quote):
  - GST 5% applies to almost everything Black Timber sells. Charge GST on
    the pre-PST amount (PST does not stack into GST).
  - PST 7% in BC is rule-driven, not a flat checkbox:
      * Material sold WITHOUT installation (homeowner picks up product) →
        seller charges PST. (For a Black Timber-supplied DIY material list,
        Fernie HH charges the PST at their till.)
      * Materials installed into REAL PROPERTY by Black Timber (deck framed
        and built into the structure, drywall installed, etc.) → typically
        treated as a service to real property. Black Timber pays PST on the
        materials at the supplier; the labor portion of the contract to the
        homeowner is generally not subject to PST. Do NOT show PST as a
        line item to the homeowner in this case.
      * Mixed contracts (e.g., supply-only railing + installed deck) →
        require a split. The AI should flag mixed scope, never silently
        average.
      * Repairs to real property: services to real property are generally
        not PST-charged to the homeowner; Black Timber still pays PST on
        materials at the supplier.
  - When the AI is uncertain which PST scenario applies, it MUST say so and
    recommend Jaryd confirm at quote-final.

Quote presentation expectations (when the AI assembles a material list or
quote that touches Fernie HH):
  - Anchor every line to either "stocked at Fernie HH" or "special-order via
    Fernie HH PRO" — be honest if you don't know; default to "desk to confirm".
  - Include a freight note for remote job sites.
  - Include a validity window — quotes from supplier reality go stale fast;
    7 days is a sensible default.
  - Add a small waste/contingency factor on material-list quantities:
      * Lumber framing:        +5% to +10%
      * Decking boards:        +8% to +12%
      * Drywall sheets:        +10% to +15%
      * Fasteners:             +15% (round up to nearest box)
      * Flooring (rectangular rooms): +8%   (planks/laminate/LVT)
      * Flooring (diagonal/herringbone or many cuts): +15%
      * Tile:                   +10%        (more for diagonal layouts)
      * Asphalt shingles:       +10%        (waste + starter strip)
      * Siding (vinyl/Hardie):  +10%
      * Paint:                  1 gal covers ~350 sqft / coat (round up)
  - Never claim live stock counts. Use language like "typically stocked" or
    "usually special order" and flag desk confirmation.

Closing rule: this primer makes the AI sound like a Kootenay journeyman who
buys at Fernie HH every week. It does NOT replace real desk pricing or a
site visit, and the AI must keep saying so.
`.trim();

/**
 * Condensed primer for Cmd+K parse only (~2k tokens vs ~12k for the full doc).
 * Keeps flooring/deck ballparks + BC tax rules so parse stays fast on Vercel.
 */
export const PARSE_SUPPLIER_SNIPPET = `
Fernie Home Hardware PRO — parse-time ballparks (CAD, 2026 East Kootenay):
  Flooring:
    LVP material $2–$5.50/sqft, install labor $3–$5/sqft
    Laminate material $1.50–$3.50/sqft, labor $2.50–$3.50/sqft
    Bullnose / stair treads installed $25–$45/LF
    Carpet removal $0.75–$1.50/sqft labor
    Underlayment $0.40–$1.20/sqft material
    Waste: +8% rectangular rooms, +15% diagonal/many cuts
  Baseboard trim installed: $2.50–$4.50/LF labor + $1.10–$1.80/LF MDF material
  Deck PT framing: use full suggest endpoint for big decks; parse can add labor lines.
  Tax (BC): real_property_install = GST 5% only on invoice (no PST line to customer).
  Default taxMode for installed flooring/deck work: real_property_install.
  Source tags: fernie_hh_stocked | fernie_hh_special_order | labor | other_supplier | subcontractor | other
  UOM: SQFT for flooring, LF for trim/baseboard/bullnose, EA for lump sums, HR/DAY for crew.
  If user gives explicit $/sqft or $/LF, USE THOSE as unitPriceCAD — do not override with ballparks.
`.trim();
