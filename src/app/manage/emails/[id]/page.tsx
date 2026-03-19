import { redirect } from "next/navigation";

export default async function LegacyManageCampaignDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/emails/campaigns/${id}`);
}
