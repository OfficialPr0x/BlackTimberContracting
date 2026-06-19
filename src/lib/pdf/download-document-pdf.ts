// html2canvas-pro is a maintained drop-in replacement for html2canvas that
// supports modern CSS color functions (oklch / oklab / lab / color()) emitted
// by Tailwind v4. The original html2canvas 1.4.1 throws
// "unsupported color function 'oklab'" on any Tailwind v4 computed style.
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export const PDF_DOCUMENT_SELECTOR = "[data-pdf-document]";

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;
const MARGIN_PT = 20;

/**
 * Render a printable element into a multi-page letter-size jsPDF document.
 * Shared by the browser "download" path and the "email this PDF" path.
 */
async function renderElementToPdf(element: HTMLElement): Promise<jsPDF> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
    compress: true,
  });

  const printableWidth = LETTER_WIDTH_PT - MARGIN_PT * 2;
  const printableHeight = LETTER_HEIGHT_PT - MARGIN_PT * 2;
  const scale = printableWidth / canvas.width;
  const sliceHeightPx = Math.floor(printableHeight / scale);

  let offsetY = 0;
  let page = 0;

  while (offsetY < canvas.height) {
    const sliceHeight = Math.min(sliceHeightPx, canvas.height - offsetY);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;

    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Could not create PDF canvas context.");

    ctx.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    if (page > 0) pdf.addPage();
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.92),
      "JPEG",
      MARGIN_PT,
      MARGIN_PT,
      printableWidth,
      sliceHeight * scale,
      undefined,
      "FAST"
    );

    offsetY += sliceHeight;
    page += 1;
  }

  return pdf;
}

function ensurePdfExt(filename: string): string {
  return filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
}

export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const pdf = await renderElementToPdf(element);
  pdf.save(ensurePdfExt(filename));
}

/**
 * Render an element to a PDF and return its base64-encoded bytes (no data-URI
 * prefix) plus a `.pdf` filename — ready to POST as an email attachment.
 */
export async function generateElementPdfBase64(
  element: HTMLElement,
  filename: string
): Promise<{ base64: string; filename: string }> {
  const pdf = await renderElementToPdf(element);
  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  return { base64, filename: ensurePdfExt(filename) };
}

export function findPdfDocumentElement(root?: ParentNode): HTMLElement | null {
  const scope = root ?? document;
  return scope.querySelector(PDF_DOCUMENT_SELECTOR) as HTMLElement | null;
}

export async function downloadDocumentFromPage(
  filename: string,
  root?: ParentNode
): Promise<void> {
  const element = findPdfDocumentElement(root);
  if (!element) {
    throw new Error("Document preview is not ready yet.");
  }
  await downloadElementAsPdf(element, filename);
}

/** Generate the on-page branded document as a base64 PDF for emailing. */
export async function generateDocumentPdfBase64FromPage(
  filename: string,
  root?: ParentNode
): Promise<{ base64: string; filename: string }> {
  const element = findPdfDocumentElement(root);
  if (!element) {
    throw new Error("Document preview is not ready yet.");
  }
  return generateElementPdfBase64(element, filename);
}
