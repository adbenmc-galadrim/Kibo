import { activeThread, type LaneStep } from "@kibo/component-graph/models";
import { KiboError, type T3Preview } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { useProject } from "@kibo/sdk/hooks/use-project";
import { ChevronRight, Play, SquareArrowOutUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { frGraph } from "../../i18n/fr-graph";
import { PRIMARY_BUTTON } from "../PhoneScreen";
import { BottomSheet } from "./BottomSheet";

type Props = { step: LaneStep; writable: boolean; onClose(): void };

const ROW =
  "flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] font-medium disabled:opacity-60";
const SECONDARY =
  "flex h-11 w-full items-center justify-center rounded-lg border border-(--tracking-border) text-[15px] font-medium";
const SHOWN_BY_SHELL: ReadonlySet<string> = new Set(["REMOTE_UNAVAILABLE", "TIMEOUT", "REMOTE_REJECTED"]);

const messageOf = (e: unknown): string => (e instanceof KiboError ? e.detail : String(e));

function useLaunch(ticketKey: string, onClose: () => void) {
  const sdk = useSdk();
  const [preview, setPreview] = useState<T3Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    let alive = true;
    sdk.t3.preview(ticketKey).then(
      (next) => alive && setPreview(next),
      (e: unknown) => alive && setError(messageOf(e)),
    );
    return () => {
      alive = false;
    };
  }, [sdk, ticketKey]);
  const launch = async () => {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    try {
      await sdk.t3.launch(ticketKey);
      sdk.toast(frGraph.launch.launched(ticketKey));
      onClose();
    } catch (e) {
      if (e instanceof KiboError && e.code === "T3_THREAD_ACTIVE")
        sdk.toast(frGraph.launch.active(ticketKey));
      else if (!(e instanceof KiboError && SHOWN_BY_SHELL.has(e.code)))
        sdk.toast(frGraph.launch.failed(ticketKey, messageOf(e)));
      started.current = false;
      setBusy(false);
    }
  };
  return { preview, error, busy, launch };
}

function LaunchConfirm({ step, onClose }: { step: LaneStep; onClose(): void }) {
  const { preview, error, busy, launch } = useLaunch(step.key, onClose);
  return (
    <BottomSheet label={frGraph.launch.title(step.key)} onClose={onClose}>
      <div className="flex flex-col gap-3 px-4 pt-1 pb-2">
        <p className="text-(--tracking-mfg) text-[14px]">{frGraph.launch.help}</p>
        {error !== null && (
          <p role="alert" className="text-(--tracking-red) text-[14px]">
            {error}
          </p>
        )}
        {preview === null && error === null && (
          <p className="text-(--tracking-dim) text-[14px]">{frGraph.launch.loading}</p>
        )}
        {preview !== null && (
          <>
            <code className="block rounded-lg border border-(--tracking-border) bg-(--tracking-card) px-3 py-2.5 font-mono text-xs wrap-anywhere">
              {preview.command}
            </code>
            {preview.warning !== null && (
              <p className="font-medium text-(--tracking-amber) text-[13px]">{preview.warning}</p>
            )}
            <p className="flex gap-3 text-[13px]">
              <span className="shrink-0 text-(--tracking-dim)">{frGraph.launch.folder}</span>
              <span className="min-w-0 font-mono wrap-anywhere">{preview.folder}</span>
            </p>
          </>
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={SECONDARY}>
            {frGraph.launch.cancel}
          </button>
          <button
            type="button"
            disabled={busy || preview === null}
            onClick={() => void launch()}
            className={`${PRIMARY_BUTTON} gap-2`}
          >
            <Play aria-hidden size={16} />
            {frGraph.launch.confirm}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function launchBlocker(writable: boolean, hasFolder: boolean | undefined): string | null {
  if (!writable) return frGraph.menu.macOff;
  return hasFolder === false ? frGraph.menu.noFolder : null;
}

export function StepMenu({ step, writable, onClose }: Props) {
  const sdk = useSdk();
  const project = useProject();
  const [confirming, setConfirming] = useState(false);
  if (confirming) return <LaunchConfirm step={step} onClose={onClose} />;
  const launchable = step.startable && activeThread(step) === null;
  const blocker = launchBlocker(writable, project?.hasFolder);
  return (
    <BottomSheet label={frGraph.menu.label(step.key, step.title)} onClose={onClose}>
      <ul className="pb-2">
        {launchable && (
          <li>
            <button
              type="button"
              disabled={blocker !== null}
              aria-label={blocker === null ? frGraph.menu.launch : `${frGraph.menu.launch} · ${blocker}`}
              onClick={() => setConfirming(true)}
              className={ROW}
            >
              <Play aria-hidden size={18} className="shrink-0 text-(--tracking-brand)" />
              <span className="flex min-w-0 flex-1 flex-col">
                {frGraph.menu.launch}
                {blocker !== null && (
                  <span aria-hidden className="font-normal text-(--tracking-dim) text-[13px]">
                    {blocker}
                  </span>
                )}
              </span>
              <ChevronRight aria-hidden size={16} className="shrink-0 text-(--tracking-dim)" />
            </button>
          </li>
        )}
        <li>
          <button
            type="button"
            onClick={() => {
              onClose();
              sdk.openTicket(step.ticketId);
            }}
            className={ROW}
          >
            <SquareArrowOutUpRight aria-hidden size={18} className="shrink-0 text-(--tracking-mfg)" />
            {frGraph.menu.open}
          </button>
        </li>
      </ul>
    </BottomSheet>
  );
}
