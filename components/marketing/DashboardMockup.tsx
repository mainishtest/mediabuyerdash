export function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      {/* Glow effect */}
      <div className="absolute -inset-4 rounded-2xl bg-emerald-600/10 blur-2xl" />

      {/* Browser chrome */}
      <div className="relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-emerald-900/20">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          </div>
          <div className="ml-2 flex-1 rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-500">
            mediabuyerdash.com/home
          </div>
        </div>

        {/* Mock dashboard content */}
        <div className="flex">
          {/* Mini sidebar */}
          <div className="hidden w-36 shrink-0 border-r border-slate-800 bg-slate-900/80 p-3 sm:block">
            <div className="mb-4 flex items-center gap-1.5">
              <div className="h-5 w-5 rounded bg-emerald-600 text-center text-[8px] font-bold leading-5 text-white">
                MB
              </div>
              <span className="text-[10px] font-semibold text-slate-300">MediaBuyerDash</span>
            </div>
            {["Home", "Portfolio", "Creative Lab", "Operations", "Scale"].map((item, i) => (
              <div
                key={item}
                className={`mb-1 rounded px-2 py-1.5 text-[10px] ${
                  i === 0
                    ? "bg-emerald-600/20 font-medium text-emerald-400"
                    : "text-slate-500"
                }`}
              >
                {item}
              </div>
            ))}
          </div>

          {/* Main content area */}
          <div className="flex-1 p-4">
            {/* Header */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-white">Daily Executive Summary</div>
              <div className="mt-0.5 text-[10px] text-slate-500">March 21, 2026 — 3 clients, 12 accounts</div>
            </div>

            {/* KPI row */}
            <div className="mb-4 grid grid-cols-4 gap-2">
              {[
                { label: "Total Spend", value: "$48.2K", trend: "+12%", up: true },
                { label: "ROAS (CRM)", value: "3.42x", trend: "+0.3x", up: true },
                { label: "CPA (CRM)", value: "$24.18", trend: "-$2.40", up: true },
                { label: "Active Tests", value: "7", trend: "3 new", up: true },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-slate-800 bg-slate-800/40 p-2">
                  <div className="text-[8px] text-slate-500">{kpi.label}</div>
                  <div className="text-xs font-semibold text-white">{kpi.value}</div>
                  <div className={`text-[8px] ${kpi.up ? "text-emerald-400" : "text-rose-400"}`}>
                    {kpi.trend}
                  </div>
                </div>
              ))}
            </div>

            {/* Client rows */}
            <div className="space-y-1.5">
              {[
                { name: "Apex Fitness", status: "scaling", roas: "4.12x", spend: "$18.4K" },
                { name: "NovaSkin Co", status: "testing", roas: "2.89x", spend: "$14.2K" },
                { name: "UrbanGear", status: "issue", roas: "1.74x", spend: "$15.6K" },
              ].map((client) => (
                <div key={client.name} className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-800/30 px-3 py-2">
                  <div>
                    <span className="text-[10px] font-medium text-slate-200">{client.name}</span>
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-[8px] font-medium ${
                        client.status === "scaling"
                          ? "bg-emerald-950/60 text-emerald-400"
                          : client.status === "testing"
                          ? "bg-sky-950/60 text-sky-400"
                          : "bg-rose-950/60 text-rose-400"
                      }`}
                    >
                      {client.status}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[9px]">
                    <span className="text-slate-400">{client.spend}</span>
                    <span className="font-medium text-white">{client.roas}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
