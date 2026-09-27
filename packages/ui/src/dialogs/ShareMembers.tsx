import { type MemberInfo, MemberRole } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frShare } from "../i18n/fr-share";
import { manageErrorText } from "../lib/share-errors";
import { CopyButton } from "../settings/CopyButton";
import { groupByFour } from "./AddDeviceDialog";

const t = frShare;
type InviteRole = "editor" | "viewer";
type OnError = (message: string) => void;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
const inviteRole = (value: string): InviteRole => (value === "viewer" ? "viewer" : "editor");

type MembersProps = {
  projectId: string;
  owner: boolean;
  me: string | null;
  members: MemberInfo[];
  onChange(members: MemberInfo[]): void;
  onError: OnError;
};

export function Members({ projectId, owner, me, members, onChange, onError }: MembersProps) {
  const listId = useId();
  const change = async (userId: string, role: MemberRole | null) => {
    try {
      onChange(await client.rpc({ method: "setMemberRole", projectId, userId, role }));
    } catch (e) {
      onError(manageErrorText(e));
    }
  };
  return (
    <section className="grid gap-2">
      <h3 id={listId} className="text-sm font-medium">
        {t.members}
      </h3>
      <ul aria-labelledby={listId} className="divide-y rounded-md border">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span aria-hidden className="grid size-6 place-items-center rounded-full bg-muted text-2xs">
              {initials(m.name)}
            </span>
            <span className="flex-1 truncate">{m.userId === me ? t.you(m.name) : m.name}</span>
            {owner && m.role !== "owner" ? (
              <>
                <Select value={m.role} onValueChange={(r) => void change(m.userId, MemberRole.parse(r))}>
                  <SelectTrigger size="sm" className="w-28" aria-label={t.roleOf(m.name)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MemberRole.options.map((r) => (
                      <SelectItem key={r} value={r}>
                        {fr.sync.roles[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => void change(m.userId, null)}>
                  {t.remove}
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">{fr.sync.roles[m.role]}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Invite({ projectId, onError }: { projectId: string; onError: OnError }) {
  const [role, setRole] = useState<InviteRole>("editor");
  const [code, setCode] = useState<string | null>(null);
  const generate = async () => {
    try {
      setCode((await client.rpc({ method: "createProjectInvite", projectId, role })).code);
    } catch (e) {
      onError(manageErrorText(e));
    }
  };
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium">{t.invite}</h3>
      <div className="flex items-center gap-2">
        <Select value={role} onValueChange={(r) => setRole(inviteRole(r))}>
          <SelectTrigger size="sm" className="w-28" aria-label={t.inviteRole}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="editor">{fr.sync.roles.editor}</SelectItem>
            <SelectItem value="viewer">{fr.sync.roles.viewer}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void generate()}>
          <UserPlus aria-hidden />
          {t.generate}
        </Button>
      </div>
      {code && (
        <div className="grid gap-1">
          <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2">
            <span className="flex-1 break-words font-mono text-sm font-medium">{groupByFour(code)}</span>
            <CopyButton variant="outline" text={code} />
          </div>
          <p className="text-xs text-muted-foreground">{t.codeHelp}</p>
        </div>
      )}
    </section>
  );
}

type StopProps = { projectId: string; onStopped(): void; onError: OnError };

export function StopSharing({ projectId, onStopped, onError }: StopProps) {
  const [confirm, setConfirm] = useState(false);
  const stop = async () => {
    try {
      await client.rpc({ method: "unshareProject", projectId });
      onStopped();
    } catch (e) {
      onError(manageErrorText(e));
    }
  };
  if (!confirm)
    return (
      <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
        {t.stop}
      </Button>
    );
  return (
    <div className="grid gap-2 rounded-md border border-destructive/40 p-3">
      <p className="text-sm text-muted-foreground">{t.stopConfirm}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
          {fr.common.cancel}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => void stop()}>
          {t.stop}
        </Button>
      </div>
    </div>
  );
}
