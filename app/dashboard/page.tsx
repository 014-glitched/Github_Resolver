export default function DashboardPage() {
  return (
    <div className="p-8 min-h-screen bg-[#0A0A0A]">

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold text-white/90 tracking-tight">
          Dashboard
        </h2>
        <p className="text-[13px] text-[#555] mt-1">
          Monitor and resolve your GitHub issues automatically.
        </p>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-4 mb-4">

        {/* Left column */}
        <div className="col-span-3 flex flex-col gap-4">
          {/* Automation Engine card */}
          <div className="border border-[#1E1E1E] rounded-2xl p-6 bg-[#111]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[15px] font-semibold text-white/90 tracking-tight">
                  Automation Engine
                </h3>
                <p className="text-[12px] text-[#555] mt-1 max-w-sm leading-relaxed">
                  Resolver is actively monitoring your connected repositories and automatically fixing identified bugs.
                </p>
              </div>
              <button className="shrink-0 px-4 py-1.5 rounded-lg bg-white text-black text-[12px] font-medium hover:bg-white/90 transition-colors cursor-pointer">
                Configure
              </button>
            </div>

            {/* Status bar */}
            <div className="mt-5 h-2.5 rounded-full overflow-hidden bg-[#1A1A1A]">
              <div
                className="h-full rounded-full"
                style={{
                  width: "100%",
                  background: "linear-gradient(to right, #4ade80, #a3e635, #facc15, #fb923c, #f87171)",
                }}
              />
            </div>
          </div>
          {/* Pull Requests with Issues */}
          <div className="border border-[#1E1E1E] rounded-2xl bg-[#111] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]">
              <h3 className="text-[14px] font-semibold text-white/90">
                Pull Requests with Issues
              </h3>
              <button className="flex items-center gap-1 text-[12px] text-[#555] hover:text-white/60 transition-colors cursor-pointer">
                View all
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            <div className="divide-y divide-[#161616]">
              {/* Empty state */}
              <div className="px-6 py-12 text-center">
                <div className="w-9 h-9 rounded-xl bg-white/3 border border-[#222] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-4 h-4 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[13px] text-[#444] font-medium">No pull requests with issues</p>
                <p className="text-[12px] text-[#333] mt-1">Connect repositories to start monitoring</p>
              </div>
            </div>
          </div>
        </div>
        {/* Right column */}
        <div className="col-span-2 flex flex-col gap-4">

          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-3">
            {[
              {
                label: "Open Issues",
                value: "0",
                description: "Awaiting resolution",
                icon: (
                  <svg className="w-4 h-4 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                ),
              },
              {
                label: "Resolved",
                value: "0",
                description: "Fixed by AI",
                icon: (
                  <svg className="w-4 h-4 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                label: "PRs Created",
                value: "0",
                description: "Opened automatically",
                icon: (
                  <svg className="w-4 h-4 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                ),
              },
              ].map((stat) => (
              <div
                key={stat.label}
                className="border border-[#1E1E1E] rounded-2xl p-5 bg-[#111]"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-[#555] uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <div className="w-7 h-7 rounded-lg bg-white/3 border border-[#222] flex items-center justify-center">
                    {stat.icon}
                  </div>
                </div>
                <p className="text-[28px] font-semibold text-white/90 leading-none mb-1">
                  {stat.value}
                </p>
                <p className="text-[11px] text-[#444]">{stat.description}</p>
              </div>
            ))}
          </div>
          {/* Recent Workflows */}
          <div className="border border-[#1E1E1E] rounded-2xl p-5 bg-[#111]">
            <h3 className="text-[14px] font-semibold text-white/90 mb-4">
              Recent Workflows
            </h3>
            <div className="flex flex-col gap-1">
              <div className="py-4 text-center">
                <p className="text-[12px] text-[#444]">No recent workflows</p>
                <p className="text-[11px] text-[#333] mt-0.5">Activity will appear here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}