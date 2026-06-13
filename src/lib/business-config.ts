/**
 * Business identity & contact info — single source of truth.
 *
 * Why a config module instead of hard-coded strings:
 *   - The phone number, email, GST# and addresses appear in lots of places
 *     (footer, concierge prompt, quote letterhead, print view, AI primer).
 *     Hard-coding scatters churn across the repo every time something
 *     changes; pulling from one module lets us update once.
 *   - Sensitive-but-non-secret things (GST#, mailing address) are env-driven
 *     so they don't have to live in source if the homeowner prefers.
 *   - Defaults are provided so the site keeps working out of the box on
 *     local dev without any env config.
 *
 * NOTHING in here is a secret. Everything is safe to render to the browser.
 * A separate `getServerOnly()` is intentionally NOT provided — if a value
 * needs to stay server-side, put it elsewhere.
 */

export interface BusinessProfile {
  /** Display name. */
  name: string;
  /** "Black Timber Contracting Ltd." for signing / cheques / etc. */
  legalName: string;
  /** Single-line region tagline for letterhead and footers. */
  region: string;
  /** Phone, formatted exactly as it should display (e.g., "250-910-9071"). */
  phone: string;
  /** Public-facing email. */
  email: string;
  /** Bare hostname (no protocol) for letterhead. */
  domain: string;
  /** Postal address — multi-line allowed via "\n". */
  address?: string;
  /** GST/HST registration number (CRA business number with /RT0001 suffix). */
  gstNumber?: string;
  /** WCB / WorkSafe BC account, if you want it on quotes. */
  wcbNumber?: string;
  /** BC contractor license / business license #, if applicable. */
  licenseNumber?: string;
  /** E-transfer email or short instruction for invoices. */
  eTransferEmail?: string;
}

/**
 * Read business profile from env at request time.
 *
 * All fields are wrapped in `process.env.X ?? "default"` so unset envs fall
 * back to known-good values. This means the site works on a fresh clone with
 * no .env tweaking, but production deploys can override anything.
 */
export function getBusinessProfile(): BusinessProfile {
  return {
    name: process.env.BUSINESS_NAME ?? "Black Timber Contracting",
    legalName: process.env.BUSINESS_LEGAL_NAME ?? "Black Timber Contracting Ltd.",
    region:
      process.env.BUSINESS_REGION ?? "Cranbrook · East Kootenay · British Columbia",
    phone: process.env.BUSINESS_PHONE ?? "250-910-9071",
    email: process.env.BUSINESS_EMAIL ?? "hello@blacktimber.ca",
    domain: process.env.BUSINESS_DOMAIN ?? "blacktimber.ca",
    address: process.env.BUSINESS_ADDRESS || undefined,
    gstNumber: process.env.BUSINESS_GST_NUMBER || undefined,
    wcbNumber: process.env.BUSINESS_WCB_NUMBER || undefined,
    licenseNumber: process.env.BUSINESS_LICENSE_NUMBER || undefined,
    eTransferEmail: process.env.BUSINESS_ETRANSFER_EMAIL || undefined,
  };
}
