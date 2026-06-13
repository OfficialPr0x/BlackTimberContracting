"use client";

import DownloadPdfButton from "@/components/pdf/DownloadPdfButton";

export default function PrintButton({
  filename,
}: {
  filename: string;
}) {
  return <DownloadPdfButton filename={filename} label="Download PDF" />;
}
