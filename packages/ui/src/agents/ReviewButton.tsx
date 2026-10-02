import type { RunView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Eye } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { frRunChat } from "../i18n/fr-run-chat";
import { canEdit } from "../state/access";
import { useProject } from "../state/use-projects";
import { canSendToReview } from "./run-chat";

export function ReviewButton({ run }: { run: RunView }) {
  const project = useProject(run.ticketId === null ? null : run.projectId);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const ticket = project?.tickets.find((t) => t.id === run.ticketId) ?? null;
  if (!project || !ticket || !canEdit(project) || !canSendToReview(ticket.statusId)) return null;
  const send = async () => {
    setFailed(false);
    setSending(true);
    try {
      await client.rpc({
        method: "command",
        projectId: project.meta.id,
        command: { method: "setStatus", ticketId: ticket.id, statusId: "in_review" },
      });
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="outline" className="h-7" disabled={sending} onClick={send}>
        <Eye className="size-3" />
        {frRunChat.review}
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          {frRunChat.reviewFailed}
        </span>
      )}
    </>
  );
}
