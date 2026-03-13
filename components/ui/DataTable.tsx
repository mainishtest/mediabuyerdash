import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export interface TableColumn<T> {
  key:      string;
  header:   string;
  render:   (row: T, index: number) => ReactNode;
  align?:   "left" | "right" | "center";
  width?:   string;
}

export function DataTable<T>({
  columns,
  rows,
  getKey,
  emptyTitle    = "No data yet",
  emptyDescription,
  onRowClick,
}: {
  columns:          TableColumn<T>[];
  rows:             T[];
  getKey:           (row: T) => string;
  emptyTitle?:      string;
  emptyDescription?: string;
  onRowClick?:      (row: T) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const alignClass = (align?: "left" | "right" | "center") =>
    align === "right"  ? "text-right"  :
    align === "center" ? "text-center" : "text-left";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`pb-3 pr-4 text-xs font-semibold uppercase tracking-widest
                  text-slate-500 ${alignClass(col.align)} ${col.width ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((row, i) => (
            <tr
              key={getKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`transition-colors ${onRowClick ? "cursor-pointer" : ""} hover:bg-slate-800/30`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-3 pr-4 text-slate-300 ${alignClass(col.align)}`}
                >
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
