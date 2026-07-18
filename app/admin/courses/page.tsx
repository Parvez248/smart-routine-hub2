import { redirect } from "next/navigation";

export default function CoursesRedirectPage() {
  redirect("/admin/data?tab=courses");
}
