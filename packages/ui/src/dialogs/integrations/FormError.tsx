import { CircleX } from "lucide-react";

export function FormError({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
      <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
