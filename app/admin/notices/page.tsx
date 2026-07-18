import { redirect } from "next/navigation";

export default function NoticesRedirectPage() {
  redirect("/admin/people?tab=notices");
}
