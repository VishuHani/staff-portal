import { redirect } from "next/navigation";

export default function LegacyManageEmailsNewRedirect() {
  redirect("/emails/campaigns/new");
}
