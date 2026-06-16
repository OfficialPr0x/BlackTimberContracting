import type { Metadata } from "next";
import EstimatorChat from "@/components/admin/EstimatorChat";

export const metadata: Metadata = {
  title: "Onsite Estimator · Black Timber Admin",
  robots: { index: false, follow: false },
};

export default function AdminConciergePage() {
  return <EstimatorChat />;
}
