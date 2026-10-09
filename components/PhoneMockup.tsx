export function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[300px] mx-auto">
      <div className="relative rounded-[2.4rem] bg-black p-[10px] shadow-[0_20px_40px_-20px_rgba(18,24,43,.35)]">
        <div className="relative rounded-[1.9rem] overflow-hidden bg-white">
          {/* Status bar */}
          <div className="relative h-11 flex items-end justify-between px-6 pb-1.5 bg-white">
            <span className="text-[11px] font-semibold text-black">9:41</span>
            <div className="flex items-center gap-1">
              <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><rect x="0" y="6" width="3" height="5" rx="0.5" fill="black"/><rect x="4.5" y="4" width="3" height="7" rx="0.5" fill="black"/><rect x="9" y="2" width="3" height="9" rx="0.5" fill="black"/><rect x="13.5" y="0" width="2.5" height="11" rx="0.5" fill="black" fillOpacity="0.3"/></svg>
              <svg width="22" height="11" viewBox="0 0 22 11" fill="none"><rect x="0.5" y="0.5" width="19" height="10" rx="2.5" stroke="black"/><rect x="2" y="2" width="16" height="7" rx="1.5" fill="black"/><rect x="20.5" y="3.5" width="1.5" height="4" rx="0.75" fill="black"/></svg>
            </div>
          </div>
          {/* Dynamic island */}
          <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-[90px] h-[22px] bg-black rounded-full" />
          <div className="min-h-[420px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
