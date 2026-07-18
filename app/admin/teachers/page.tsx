import { redirect } from "next/navigation";

export default function TeachersRedirectPage() {
  redirect("/admin/data?tab=teachers");
}
