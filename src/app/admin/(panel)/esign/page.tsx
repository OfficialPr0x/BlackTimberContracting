import type { Metadata } from "next";
import EsignWorkspace from "@/components/admin/esign/EsignWorkspace";

export const metadata: Metadata = {
  title: "E-Sign · Black Timber Admin",
  robots: { index: false, follow: false },
};

export default function AdminEsignPage() {
  return <EsignWorkspace />;
}
