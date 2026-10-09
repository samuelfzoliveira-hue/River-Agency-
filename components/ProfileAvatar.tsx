"use client";

import { useState } from "react";

export function ProfileAvatar({
  profilePicUrl,
  username,
  size = 48,
}: {
  profilePicUrl?: string;
  username: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const proxiedSrc = profilePicUrl ? `/api/image-proxy?url=${encodeURIComponent(profilePicUrl)}` : undefined;

  if (!proxiedSrc || failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-white border border-river-line flex items-center justify-center font-bold text-river-ink2 shrink-0"
      >
        {username.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxiedSrc}
      alt={username}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-full object-cover shrink-0"
      onError={() => setFailed(true)}
    />
  );
}
