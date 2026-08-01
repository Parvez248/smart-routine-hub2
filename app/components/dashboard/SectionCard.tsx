import Link from "next/link";
import { Card, CardHeader } from "@/app/components/ui/Card";

export function SectionCard({
  title, description, viewAllHref, viewAllLabel = "View all", children,
}: {
  title: React.ReactNode;
  description?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={
          viewAllHref ? (
            <Link href={viewAllHref} className="text-xs font-semibold text-primary hover:opacity-80 whitespace-nowrap">
              {viewAllLabel} →
            </Link>
          ) : undefined
        }
      />
      {children}
    </Card>
  );
}
