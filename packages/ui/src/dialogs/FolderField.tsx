import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { FolderOpen } from "lucide-react";
import { useState } from "react";
import { pickFolder } from "../desktop/pick-folder";
import { frFields } from "../i18n/fr-fields";
import { inTauri } from "../shell/workspace-actions";

export type FolderFieldProps = {
  id: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  describedBy?: string;
  canBrowse?: boolean;
  pick?: (current: string | null) => Promise<string | null>;
  autoFocus?: boolean;
};

export function FolderField({
  id,
  value,
  onChange,
  placeholder,
  describedBy,
  canBrowse = inTauri(),
  pick = pickFolder,
  autoFocus = false,
}: FolderFieldProps) {
  const [error, setError] = useState<string | null>(null);
  const browse = async () => {
    setError(null);
    try {
      const picked = await pick(value.trim() || null);
      if (picked !== null) onChange(picked);
    } catch (e) {
      console.error(e);
      setError(frFields.folder.pickFailed);
    }
  };
  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={describedBy}
          autoFocus={autoFocus}
          className="font-mono"
        />
        {canBrowse && (
          <Button type="button" variant="outline" onClick={() => void browse()}>
            <FolderOpen aria-hidden />
            {frFields.folder.browse}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
