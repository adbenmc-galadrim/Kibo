export function initials(user: string): string {
  const words = user.split(/[\s._-]+/).filter(Boolean);
  const [first = "", second] = words;
  return (second ? `${first.charAt(0)}${second.charAt(0)}` : first.slice(0, 2)).toUpperCase();
}
