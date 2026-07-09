"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LeadType } from "@prisma/client";
import { TabBar, type TabItem } from "@/components/ui/tabs";
import { useAutosave } from "./use-autosave";
import type {
  EditorState,
  ContractorRow,
  FindingRow,
  QualityDocRow,
  PhotoRow,
  LeadScalars,
} from "./types";
import { ParterTab } from "./parter-tab";
import { InnehallTab } from "./innehall-tab";
import { FelTab } from "./fel-tab";
import { BilderTab } from "./bilder-tab";
import { DokumentationTab } from "./dokumentation-tab";

function saveLabel(status: string): string {
  switch (status) {
    case "saving":
      return "Sparar…";
    case "saved":
      return "Sparat";
    case "error":
      return "Kunde inte spara";
    default:
      return "";
  }
}

export function LeadEditor({
  initial,
  locked = false,
}: {
  initial: EditorState;
  locked?: boolean;
}) {
  const [lead, setLead] = useState<LeadScalars>(initial.lead);
  const [dataJson, setDataJson] = useState<Record<string, unknown>>(
    initial.dataJson
  );
  const [contractors, setContractors] = useState<ContractorRow[]>(
    initial.contractors
  );
  const [findings, setFindings] = useState<FindingRow[]>(initial.findings);
  const [qualityDocs, setQualityDocs] = useState<QualityDocRow[]>(
    initial.qualityDocs
  );
  const [photos, setPhotos] = useState<PhotoRow[]>(initial.photos);

  const { status, schedule } = useAutosave(initial.reportId);

  // Autosave lead scalars + dataJson + relational data (photos handled below).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (locked) return; // locked snapshot: the API would 409 anyway
    schedule({ lead, dataJson, contractors, findings, qualityDocs });
  }, [lead, dataJson, contractors, findings, qualityDocs, schedule, locked]);

  const tabs = useMemo<TabItem[]>(() => {
    const t: TabItem[] = [
      { value: "parter", label: "Parter" },
      { value: "innehall", label: "Innehåll" },
    ];
    if (initial.type !== LeadType.SKADEUTREDNING) {
      t.push({ value: "fel", label: "Fel-tabell" });
    }
    t.push({ value: "bilder", label: "Bilder" });
    if (initial.type === LeadType.SLUTBESIKTNING) {
      t.push({ value: "dokumentation", label: "Dokumentation" });
    }
    return t;
  }, [initial.type]);

  const [active, setActive] = useState("parter");

  return (
    <div className="space-y-6">
      {locked && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Rapporten är låst (godkänd/skickad/arkiverad) — fälten är skrivskyddade.
          Skapa en ny version för att göra ändringar.
        </p>
      )}
      <div className="flex items-center justify-between">
        <TabBar tabs={tabs} active={active} onChange={setActive} />
        <span
          className={
            "ml-4 shrink-0 text-sm " +
            (status === "error" ? "text-destructive" : "text-muted-foreground")
          }
        >
          {saveLabel(status)}
        </span>
      </div>

      <fieldset disabled={locked} className="min-w-0 space-y-6">
      {active === "parter" && (
        <ParterTab
          type={initial.type}
          lead={lead}
          setLead={setLead}
          contractors={contractors}
          setContractors={setContractors}
          dataJson={dataJson}
          setDataJson={setDataJson}
        />
      )}
      {active === "innehall" && (
        <InnehallTab
          type={initial.type}
          dataJson={dataJson}
          setDataJson={setDataJson}
          lead={lead}
          setLead={setLead}
        />
      )}
      {active === "fel" && (
        <FelTab type={initial.type} findings={findings} setFindings={setFindings} />
      )}
      {active === "bilder" && (
        <BilderTab
          reportId={initial.reportId}
          type={initial.type}
          photos={photos}
          setPhotos={setPhotos}
        />
      )}
      {active === "dokumentation" && (
        <DokumentationTab
          qualityDocs={qualityDocs}
          setQualityDocs={setQualityDocs}
        />
      )}
      </fieldset>
    </div>
  );
}
