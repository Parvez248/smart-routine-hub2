import { redirect } from "next/navigation";

export default function VersionsRedirectPage() {
  redirect("/admin/routine?tab=versions");
}
