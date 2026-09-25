import { fr } from "../i18n/fr";

export function KiboLogo({ className, decorative = false }: { className?: string; decorative?: boolean }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={className}
      role="img"
      aria-hidden={decorative}
      aria-label={fr.app.name}
    >
      <title>{fr.app.name}</title>
      <rect width="1024" height="1024" rx="224" fill="#F97316" />
      <rect x="232" y="256" width="144" height="512" rx="40" fill="#fff" />
      <rect x="440" y="256" width="144" height="360" rx="40" fill="#fff" />
      <rect x="648" y="256" width="144" height="436" rx="40" fill="#fff" />
    </svg>
  );
}
