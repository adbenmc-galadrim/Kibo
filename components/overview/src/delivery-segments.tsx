export function DeliverySegments({ steps }: { steps: number }) {
  const cases = Array.from({ length: steps }, (_, i) => `step-${i}`);
  return (
    <span aria-hidden className="flex shrink-0 gap-[3px]">
      {cases.map((id) => (
        <span key={id} className="h-[6px] w-[22px] rounded-[2px] bg-(--tracking-green)" />
      ))}
    </span>
  );
}
