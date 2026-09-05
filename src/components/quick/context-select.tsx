import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/features/app/app-context";
import { contextEmoji, useContexts } from "@/features/contexts/queries";

export const NO_CONTEXT = "none";

/** Optional link between a record and a context. */
export function ContextSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { workspaceId } = useApp();
  const { data: contexts = [] } = useContexts(workspaceId);

  return (
    <div className="space-y-2">
      <Label>Contexto</Label>
      <Select value={value || NO_CONTEXT} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Nenhum" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_CONTEXT}>Nenhum</SelectItem>
          {contexts
            .filter((context) => context.status !== "ARCHIVED")
            .map((context) => (
              <SelectItem key={context.id} value={context.id}>
                {contextEmoji(context.type)} {context.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
