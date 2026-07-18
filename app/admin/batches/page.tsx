import { redirect } from "next/navigation";

export default function BatchesRedirectPage() {
  redirect("/admin/data?tab=batches");
}
