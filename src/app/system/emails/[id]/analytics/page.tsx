import { redirect } from "next/navigation";

export default async function LegacySystemCampaignAnalyticsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/emails/campaigns/${id}`);
}
