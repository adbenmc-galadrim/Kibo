import type { Domain, ProjectSnapshot, TicketView } from "@kibo/schema";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@kibo/sdk/ui/select";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frDomains } from "../i18n/fr-domains";

type Props = { project: ProjectSnapshot; ticket: TicketView; domains: Domain[] };

const NO_DOMAIN = "none";

function DomainGroup({ label, domains }: { label: string; domains: Domain[] }) {
  if (domains.length === 0) return null;
  return (
    <SelectGroup>
      <SelectLabel>{label}</SelectLabel>
      {[...domains]
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
        .map((d) => (
          <SelectItem key={`${d.owner.scope}:${d.id}`} value={d.id}>
            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: d.color }} />
            {d.name}
          </SelectItem>
        ))}
    </SelectGroup>
  );
}

export function DomainSelect({ project, ticket, domains }: Props) {
  const [failed, setFailed] = useState(false);
  const own = domains.filter((d) => d.owner.scope === "project");
  const workspace = domains.filter((d) => d.owner.scope === "workspace");
  const pick = async (value: string) => {
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId: project.meta.id,
        command: {
          method: "updateTicket",
          ticketId: ticket.id,
          domainId: value === NO_DOMAIN ? null : value,
        },
      });
    } catch {
      setFailed(true);
    }
  };
  return (
    <>
      <Select value={ticket.domainId ?? NO_DOMAIN} onValueChange={(v) => void pick(v)}>
        <SelectTrigger size="sm" aria-label={fr.ticket.domain} className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={NO_DOMAIN}>{fr.ticket.noDomain}</SelectItem>
          <DomainGroup label={frDomains.domainsOf(project.meta.name)} domains={own} />
          <DomainGroup label={frDomains.workspaceDomains} domains={workspace} />
        </SelectContent>
      </Select>
      {failed && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {fr.ticket.domainFailed}
        </p>
      )}
    </>
  );
}
