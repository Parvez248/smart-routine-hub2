import { redirect } from "next/navigation";

export default function RoomsRedirectPage() {
  redirect("/admin/data?tab=rooms");
}
