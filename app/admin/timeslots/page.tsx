import { redirect } from "next/navigation";

export default function TimeSlotsRedirectPage() {
  redirect("/admin/data?tab=timeslots");
}
