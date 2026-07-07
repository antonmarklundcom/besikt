import Link from "next/link";
import { LeadStatus, LeadType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { LeadFilters } from "./lead-filters";
import { STATUS_BADGE, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
  sort?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const where: Prisma.LeadWhereInput = {};

  if (searchParams.status && searchParams.status in LeadStatus) {
    where.status = searchParams.status as LeadStatus;
  }
  if (searchParams.type && searchParams.type in LeadType) {
    where.type = searchParams.type as LeadType;
  }
  const q = searchParams.q?.trim();
  if (q) {
    where.OR = [
      { refNumber: { contains: q, mode: "insensitive" } },
      { clientName: { contains: q, mode: "insensitive" } },
      { propertyDesignation: { contains: q, mode: "insensitive" } },
    ];
  }

  const sort: Prisma.SortOrder = searchParams.sort === "asc" ? "asc" : "desc";

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: sort },
    include: { _count: { select: { contractors: true, reports: true } } },
    take: 200,
  });

  return (
    <main className="container py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Leadkö</h1>
        <span className="text-sm text-muted-foreground">
          {leads.length} lead{leads.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mb-6">
        <LeadFilters />
      </div>

      {leads.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Inga leads matchar filtret.
        </p>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/dashboard/leads/${lead.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {lead.refNumber}
                      </span>
                      <Badge className={STATUS_BADGE[lead.status]}>
                        {STATUS_LABELS[lead.status]}
                      </Badge>
                    </div>
                    <div className="font-medium">{lead.clientName}</div>
                    <div className="text-sm text-muted-foreground">
                      {TYPE_LABELS[lead.type]}
                      {lead.propertyDesignation
                        ? ` · ${lead.propertyDesignation}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>{fmtDate(lead.createdAt)}</div>
                    {lead.type === "SLUTBESIKTNING" &&
                      lead._count.contractors > 0 && (
                        <div>{lead._count.contractors} hantverkare</div>
                      )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
