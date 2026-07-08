"use client";

import { LeadType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FindingRow } from "./types";

type Props = {
  type: LeadType;
  findings: FindingRow[];
  setFindings: React.Dispatch<React.SetStateAction<FindingRow[]>>;
};

export function FelTab({ type, findings, setFindings }: Props) {
  const showBet = type === LeadType.SLUTBESIKTNING;

  function add() {
    setFindings((prev) => [
      ...prev,
      { id: crypto.randomUUID(), bet: showBet ? "H" : "", delRum: "", felText: "", avhjalpt: false, avhjalptSign: "" },
    ]);
  }

  function update(id: string, patch: Partial<FindingRow>) {
    setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function remove(id: string) {
    setFindings((prev) => prev.filter((f) => f.id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    setFindings((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Fel-tabell ({findings.length})</h2>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + Lägg till fel
        </Button>
      </div>

      {findings.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Inga fel registrerade. Lägg till rader ovan.
        </p>
      )}

      {findings.map((f, i) => (
        <Card key={f.id}>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Nr {i + 1}</span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={i === findings.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(f.id)}>
                  Ta bort
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              {showBet && (
                <div className="space-y-2">
                  <Label>Bet</Label>
                  <Input value={f.bet} onChange={(e) => update(f.id, { bet: e.target.value })} placeholder="H" />
                </div>
              )}
              <div className={showBet ? "space-y-2 sm:col-span-3" : "space-y-2 sm:col-span-4"}>
                <Label>Del / Rum</Label>
                <Input value={f.delRum} onChange={(e) => update(f.id, { delRum: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fel</Label>
              <Textarea rows={2} value={f.felText} onChange={(e) => update(f.id, { felText: e.target.value })} />
            </div>

            <div className="flex items-center gap-2">
              <input
                id={`avhjalpt-${f.id}`}
                type="checkbox"
                className="h-4 w-4"
                checked={f.avhjalpt}
                onChange={(e) => update(f.id, { avhjalpt: e.target.checked })}
              />
              <Label htmlFor={`avhjalpt-${f.id}`}>Avhjälpt</Label>
            </div>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        Kolumnen “Avhjälpt/sign” lämnas alltid tom i det genererade dokumentet.
      </p>
    </div>
  );
}
