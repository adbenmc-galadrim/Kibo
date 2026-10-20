import { frPrs } from "./fr-prs";

export function PrsEmpty() {
  return (
    <div className="absolute inset-x-0 top-[410px] flex flex-col items-center gap-1.5 px-4 text-center">
      <p className="font-medium text-(--tracking-mfg) text-sm leading-[17px]">{frPrs.empty.title}</p>
      <p className="text-(--tracking-dim) text-[13px] leading-4">{frPrs.empty.hint}</p>
    </div>
  );
}
