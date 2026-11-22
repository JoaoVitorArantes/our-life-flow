import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Navegação por ano sem faixa fixa: setas, campo para digitar o ano e atalho para o ano atual. */
export function YearNav({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const [typed, setTyped] = useState(String(year));
  useEffect(() => setTyped(String(year)), [year]);
  const now = new Date().getFullYear();
  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="icon"
        variant="outline"
        className="size-10 shrink-0"
        aria-label="Ano anterior"
        onClick={() => onChange(Math.max(1900, year - 1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Input
        aria-label="Ano"
        inputMode="numeric"
        maxLength={4}
        className="h-10 w-20 text-center font-semibold tabular-nums"
        value={typed}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "");
          setTyped(v);
          const y = Number(v);
          if (v.length === 4 && y >= 1900) onChange(y);
        }}
        onBlur={() => setTyped(String(year))}
      />
      <Button
        size="icon"
        variant="outline"
        className="size-10 shrink-0"
        aria-label="Próximo ano"
        onClick={() => onChange(Math.min(9999, year + 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button
        size="sm"
        variant={year === now ? "secondary" : "outline"}
        className="h-10"
        onClick={() => onChange(now)}
      >
        Este ano
      </Button>
    </div>
  );
}
