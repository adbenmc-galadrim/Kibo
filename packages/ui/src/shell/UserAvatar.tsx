export function initials(user: string): string {
  const words = user.split(/[\s._-]+/).filter(Boolean);
  const [first = "", second] = words;
  return (second ? `${first.charAt(0)}${second.charAt(0)}` : first.slice(0, 2)).toUpperCase();
}

export function UserAvatar({ user }: { user: string }) {
  return (
    <span
      role="img"
      aria-label={user}
      title={user}
      className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold"
    >
      {initials(user)}
    </span>
  );
}
