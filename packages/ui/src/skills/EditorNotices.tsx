import { Alert, AlertDescription } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import type { FileEditor } from "../file-editor/use-file-editor";
import { frSkills } from "../i18n/fr-skills";

type Props = { editor: FileEditor; error: string | null };

const t = frSkills.editor;

export function EditorNotices({ editor, error }: Props) {
  return (
    <>
      {editor.changedOnDisk && (
        <Alert>
          <AlertDescription className="flex items-center gap-3">
            {t.changedOnDisk}
            <Button size="sm" variant="outline" onClick={() => void editor.reload()}>
              {t.reload}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {editor.missing && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center gap-3">
            {t.missing}
            <Button size="sm" variant="outline" onClick={() => void editor.recreate()}>
              {t.recreate}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
