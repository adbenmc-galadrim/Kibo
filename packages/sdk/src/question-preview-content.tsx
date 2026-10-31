import type { Actor, Question, QuestionRecipient } from "@kibo/schema";
import { CircleAlert } from "lucide-react";
import type { MouseEvent } from "react";
import { humanName } from "./human-name";
import { cn } from "./lib/utils";
import type { QuestionPreviewProps } from "./question-preview";
import {
  PREVIEW_EXCERPT_MAX,
  previewAge,
  previewExcerpt,
  previewFr,
  previewState,
  ticketPreviewRows,
} from "./question-preview-text";

type ContentProps = Omit<QuestionPreviewProps, "children"> & { now: number };

const recipientOf = (recipients: readonly QuestionRecipient[], id: string): string =>
  recipients.find((r) => r.id === id)?.name ?? previewFr.removedRecipient;

const authorOf = (actor: Actor): string =>
  actor.kind === "human" ? humanName(actor.ref, previewFr.unknownMember) : actor.ref;

const META = "text-2xs text-muted-foreground";

function Blocking() {
  return (
    <CircleAlert
      role="img"
      aria-label={previewFr.blocking}
      className="mt-0.5 size-3 shrink-0 text-orange-600 dark:text-orange-400"
    />
  );
}

function TicketRows(props: ContentProps) {
  const { rows, more } = ticketPreviewRows(props.questions, props.ticket.id);
  const open = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    props.onOpen(id);
  };
  return (
    <div className="grid gap-1.5">
      <p className={cn(META, "px-1.5")}>
        <span className="font-mono">{props.ticket.keyLabel}</span>
        {` · ${previewFr.heading(rows.length + more)}`}
      </p>
      <ul className="grid gap-0.5">
        {rows.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              className="grid w-full gap-0.5 rounded-md px-1.5 py-1 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => open(e, q.id)}
            >
              <span className="flex gap-1 text-xs font-medium">
                {q.blocking && <Blocking />}
                <span className="line-clamp-2">{q.title}</span>
              </span>
              <span className={META}>
                {[
                  previewFr.for(recipientOf(props.recipients, q.recipient)),
                  previewState(q),
                  previewAge(q.createdAt, props.now),
                ].join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {more > 0 && <p className={cn(META, "px-1.5")}>{previewFr.more(more)}</p>}
    </div>
  );
}

function OneQuestion({ question: q, ...props }: ContentProps & { question: Question }) {
  const excerpt = previewExcerpt(q.context, PREVIEW_EXCERPT_MAX);
  return (
    <div className="grid gap-1.5">
      <p className={cn(META, "truncate")}>
        <span className="font-mono">{props.ticket.keyLabel}</span>
        {` · ${props.ticket.title}`}
      </p>
      <p className="flex gap-1 text-sm font-medium">
        {q.blocking && <Blocking />}
        <span className="line-clamp-3">{q.title}</span>
      </p>
      {excerpt !== "" && <p className="line-clamp-4 text-xs text-muted-foreground">{excerpt}</p>}
      {(q.options.length > 0 || q.provisional !== null) && (
        <p className="flex flex-wrap gap-x-3 text-2xs">
          {q.options.length > 0 && <span>{previewFr.options(q.options.join(" · "))}</span>}
          {q.provisional !== null && <span>{previewFr.provisional(q.provisional)}</span>}
        </p>
      )}
      <p className={META}>
        {`${previewFr.for(recipientOf(props.recipients, q.recipient))} · ${previewState(q)}`}
      </p>
      <p className={META}>{previewFr.by(authorOf(q.createdBy), previewAge(q.createdAt, props.now))}</p>
    </div>
  );
}

export function QuestionPreviewContent(props: ContentProps) {
  if (props.mode === "ticket") return <TicketRows {...props} />;
  const question = props.questions[0];
  return question ? <OneQuestion {...props} question={question} /> : null;
}
