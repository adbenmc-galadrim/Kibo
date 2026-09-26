import { useSdk } from "@kibo/sdk";
import { useEffect, useState } from "react";

export function Component() {
  const sdk = useSdk();
  const [state, setState] = useState("…");
  useEffect(() => {
    sdk
      .list("ticket")
      .then((tickets) => {
        const first = tickets[0];
        return first ? sdk.run({ method: "deleteTicket", ticketId: first.id }) : null;
      })
      .then(
        () => setState("deleted"),
        (e: unknown) => setState(String(e)),
      );
  }, [sdk]);
  return <p>{state}</p>;
}
