import { Input } from "@kibo/sdk/ui/input";
import { Search } from "lucide-react";
import { fr } from "./fr";

type Props = { value: string; onChange(value: string): void; onClose(): void };

export function SearchField({ value, onChange, onClose }: Props) {
  return (
    <div className="relative w-[394px] max-w-full">
      <Search
        aria-hidden
        className="absolute top-1/2 left-2.5 size-[13px] -translate-y-1/2 text-(--tracking-dim)"
      />
      <Input
        type="search"
        autoFocus
        aria-label={fr.search}
        placeholder={fr.search}
        className="h-[27px] rounded-[7px] border-(--tracking-border) bg-(--tracking-muted) pl-8 text-[12.5px] shadow-none [&::-webkit-search-cancel-button]:hidden"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          onChange("");
          onClose();
        }}
        onBlur={() => value.trim() === "" && onClose()}
      />
    </div>
  );
}
