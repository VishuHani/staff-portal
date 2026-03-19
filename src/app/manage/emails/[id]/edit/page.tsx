import { redirect } from "next/navigation";

export default async function LegacyManageCampaignEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/emails/campaigns/${id}/edit`);
}
