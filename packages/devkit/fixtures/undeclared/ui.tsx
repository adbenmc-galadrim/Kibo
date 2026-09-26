import { useEntities } from "@kibo/sdk";

export function Component() {
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  return (
    <p>
      {tickets.data.length} / {links.data.length}
    </p>
  );
}
