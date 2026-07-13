import type { ReactNode } from "react";

type MetricDrilldownProps = {
  label: string;
  className?: string;
  children: ReactNode;
  onClick: () => void;
};

export function MetricDrilldown({ label, className, children, onClick }: MetricDrilldownProps) {
  return (
    <button
      type="button"
      className={["metric-drilldown", className].filter(Boolean).join(" ")}
      aria-label={`查看${label}明细`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
