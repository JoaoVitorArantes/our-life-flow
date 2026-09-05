import { Badge } from "@/components/ui/badge";
import { statusLabel, type PaymentStatus } from "@/features/finance/constants";

const VARIANT: Record<PaymentStatus, string> = {
  PAID: "border-success/40 text-success",
  PENDING: "border-border text-muted-foreground",
  OVERDUE: "border-destructive/40 text-destructive",
  CANCELLED: "border-border text-muted-foreground line-through",
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="outline" className={VARIANT[status]}>
      {statusLabel(status)}
    </Badge>
  );
}
