/**
 * Central registry for branded Black Timber Contracting job photos.
 *
 * All photos live in /public/jobs/job-NN.jpg and were imported from the
 * official BTC photo archive.
 *
 * Files are renamed sequentially. Order is preserved by upload date so
 * the array roughly tracks the company timeline (earliest → most recent).
 *
 * To add more photos: drop them into /public/jobs/ as job-XX.jpg and
 * bump JOB_PHOTO_COUNT here.
 */

export const JOB_PHOTO_COUNT = 72;

export const JOB_PHOTOS: string[] = Array.from(
  { length: JOB_PHOTO_COUNT },
  (_, i) => `/jobs/job-${String(i + 1).padStart(2, "0")}.jpg`
);

/**
 * Curated indexes used for specific surface features. Tweak these freely
 * once you know which photos look best where. They simply pick from the
 * pool so we never end up with a broken image reference.
 */

// Live map — one photo per city pin (5 pins currently).
export const MAP_PHOTOS: string[] = pick([4, 18, 27, 41, 55]);

// Contractor Netflix — 6 episode thumbnails.
export const TV_PHOTOS: string[] = pick([2, 9, 22, 33, 48, 63]);

// Client Portal — daily site-log feed photos (2 sessions x 2 logs).
export const PORTAL_PHOTOS: string[] = pick([12, 25, 38, 51]);

// DrawItOut AI render output stills — 4 templates (deck / fence / garage / pergola).
export const DRAW_RENDER_PHOTOS: string[] = pick([7, 16, 29, 44]);

// Hero / dramatic feature shots (used for cinematic frames).
export const HERO_PHOTOS: string[] = pick([1, 14, 30, 50, 65, 70]);

// ───────────────────────── helpers ─────────────────────────

function pick(indexes: number[]): string[] {
  return indexes.map((i) => {
    const safe = ((i - 1) % JOB_PHOTO_COUNT + JOB_PHOTO_COUNT) % JOB_PHOTO_COUNT;
    return JOB_PHOTOS[safe];
  });
}
