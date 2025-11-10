import { redirect } from "next/navigation";
import { getProfile } from "@/lib/actions/profile";
import { ProfilePageClient } from "./profile-page-client";

export default async function ProfilePage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  return <ProfilePageClient profile={profile} />;
}
