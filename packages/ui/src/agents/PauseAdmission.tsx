import { Button } from "@kibo/sdk/ui/button";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

export function PauseAdmission({ paused }: { paused: boolean }) {
  const [failed, setFailed] = useState(false);
  const toggle = async () => {
    setFailed(false);
    try {
      await client.rpc({ method: "setHost", patch: { paused: !paused } });
    } catch {
      setFailed(true);
    }
  };
  return (
    <>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          {fr.queue.failed}
        </span>
      )}
      <Button variant="outline" size="sm" className="h-7" onClick={() => void toggle()}>
        {paused ? <Play /> : <Pause />}
        {paused ? fr.queue.resume : fr.queue.pause}
      </Button>
    </>
  );
}
