import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, XCircle } from "lucide-react";

const stats = [
  { icon: ClipboardList, label: "Pending", value: 2, color: "text-warning", bg: "bg-warning/10" },
  { icon: Clock, label: "In Progress", value: 1, color: "text-primary", bg: "bg-primary/10" },
  { icon: CheckCircle2, label: "Completed", value: 5, color: "text-success", bg: "bg-success/10" },
];

export const RequestStatusCard = () => {
  return (
    <section className="px-4">
      <h2 className="text-lg font-semibold mb-4">My Requests</h2>
      <Card variant="elevated" className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-3 divide-x divide-border">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <button
                  key={stat.label}
                  className="flex flex-col items-center gap-2 p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-xl ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <span className="text-2xl font-bold">{stat.value}</span>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
