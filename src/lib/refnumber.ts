import type { Prisma } from "@prisma/client";

// refNumber format: "EK-2026-001" (§3). Sequence is per calendar year.
const PREFIX = "EK";

/**
 * Compute the next refNumber for the current year inside a transaction.
 * Low volume, but we still guard against collisions via a unique constraint on
 * Lead.refNumber and a retry in the caller.
 */
export async function nextRefNumber(
  tx: Prisma.TransactionClient,
  year = new Date().getFullYear()
): Promise<string> {
  const yearPrefix = `${PREFIX}-${year}-`;

  const last = await tx.lead.findFirst({
    where: { refNumber: { startsWith: yearPrefix } },
    orderBy: { refNumber: "desc" },
    select: { refNumber: true },
  });

  const lastSeq = last ? parseInt(last.refNumber.slice(yearPrefix.length), 10) : 0;
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;

  return `${yearPrefix}${String(nextSeq).padStart(3, "0")}`;
}
