import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const PDF_DOCUMENT_SELECTOR = "[data-pdf-document]";

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;
const MARGIN_PT = 20;

export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
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

  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  pdf.save(safeName);
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
