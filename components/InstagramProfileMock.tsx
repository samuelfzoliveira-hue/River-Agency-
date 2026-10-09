import { ProfileAvatar } from "./ProfileAvatar";

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function MockStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-[13px] font-semibold text-black leading-tight">{value}</span>
      <span className="text-[10.5px] text-black/60 leading-tight whitespace-nowrap">{label}</span>
    </div>
  );
}

export function InstagramProfileMock({
  username,
  fullName,
  profilePicUrl,
  posts,
  followers,
  following,
  bio,
  isVerified,
}: {
  username: string;
  fullName: string;
  profilePicUrl?: string;
  posts: number;
  followers: number;
  following: number;
  bio: string;
  isVerified?: boolean;
}) {
  return (
    <div className="bg-white text-black">
      {/* Top bar */}
      <div className="flex items-center justify-center px-4 py-2.5 border-b border-black/5 relative">
        <span className="text-[13px] font-semibold flex items-center gap-1">
          {username}
          {isVerified && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#3897f0">
              <path d="M12 2l2.4 1.4 2.8-.3 1.4 2.4 2.4 1.4-.3 2.8 1.4 2.4-1.4 2.4.3 2.8-2.4 1.4-1.4 2.4-2.8-.3L12 22l-2.4-1.4-2.8.3-1.4-2.4L3 17.1l.3-2.8L1.9 11.9l1.4-2.4-.3-2.8 2.4-1.4L6.8 1.5l2.8.3L12 2z" />
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </div>

      <div className="px-3.5 pt-4">
        <div className="flex items-center gap-4">
          <ProfileAvatar profilePicUrl={profilePicUrl} username={username} size={60} />
          <div className="flex-1 grid grid-cols-3">
            <MockStat value={fmt(posts)} label="posts" />
            <MockStat value={fmt(followers)} label="seguidores" />
            <MockStat value={fmt(following)} label="seguindo" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[13px] font-semibold text-black">{fullName}</div>
          <div className="text-[12.5px] text-black/80 leading-snug mt-0.5 whitespace-pre-line">{bio}</div>
        </div>

        <div className="flex gap-1.5 mt-3">
          <div className="flex-1 bg-[#efefef] rounded-lg py-1.5 text-center text-[12.5px] font-semibold text-black">
            Seguir
          </div>
          <div className="flex-1 bg-[#efefef] rounded-lg py-1.5 text-center text-[12.5px] font-semibold text-black">
            Mensagem
          </div>
        </div>

        <div className="flex justify-around border-t border-black/5 mt-4 pt-2 pb-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeOpacity="0.3" strokeWidth="1.5"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeOpacity="0.3" strokeWidth="1.5"><circle cx="12" cy="8" r="3"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>
        </div>
        <div className="grid grid-cols-3 gap-[2px]">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-black/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
