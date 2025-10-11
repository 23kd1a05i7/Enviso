import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Battery } from "lucide-react";

interface StatusBadgeProps {
  status: "online" | "offline" | "low_battery";
  className?: string;
}

const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case "online":
        return {
          icon: Wifi,
          label: "Online",
          className: "bg-status-online/10 text-status-online border-status-online/20",
        };
      case "offline":
        return {
          icon: WifiOff,
          label: "Offline",
          className: "bg-status-offline/10 text-status-offline border-status-offline/20",
        };
      case "low_battery":
        return {
          icon: Battery,
          label: "Low Battery",
          className: "bg-status-warning/10 text-status-warning border-status-warning/20",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.className} ${className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};

export default StatusBadge;
