import { ProcessingStatus } from "@prisma/client";
import { Badge } from "@/app/ui/badge";

interface IStatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive";
  className?: string;
}

const STATUS_CONFIG: Record<ProcessingStatus, IStatusConfig> = {
  [ProcessingStatus.NotStarted]: {
    label: "Not Started",
    variant: "secondary",
  },
  [ProcessingStatus.Generating]: {
    label: "Generating",
    variant: "default",
  },
  [ProcessingStatus.Generated]: {
    label: "Generated",
    variant: "default",
    className: "bg-green-500 hover:bg-green-600 text-white",
  },
  [ProcessingStatus.Error]: {
    label: "Error",
    variant: "destructive",
  },
};

interface IGetStatusBadgeProps {
  status: ProcessingStatus;
}

export function getStatusBadge(props: IGetStatusBadgeProps) {
  const { status } = props;
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
