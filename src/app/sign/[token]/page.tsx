import type { Metadata } from "next";
import { getBusinessProfile } from "@/lib/business-config";
import SignPortalClient from "./sign-portal-client";

export const metadata: Metadata = {
  title: "Sign document · Black Timber Contracting",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const business = getBusinessProfile();

  return (
    <div className="min-h-[100dvh] bg-brand-black text-foreground">
      <SignPortalClient token={token} business={business} />
    </div>
  );
}
