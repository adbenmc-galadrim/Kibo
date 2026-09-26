import { useEntities } from "@kibo/sdk";

const ENTITY = ["ticket"][0] ?? "ticket";

export function Component() {
  const rows = useEntities(ENTITY as "ticket");
  return <p>{rows.data.length}</p>;
}
