import { redirect } from "next/navigation";

export default function TeacherRequestsRedirectPage() {
  redirect("/admin/people?tab=requests");
}
