import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Globe, Plus, Terminal, Trash2 } from "lucide-react";
import { type ReactNode, useId } from "react";
import { fr } from "../../i18n/fr";
import { ChoiceCard } from "../ChoiceCard";
import type { McpForm } from "./mcp-form";

const t = fr.integrations.mcpServer;

type Props = {
  form: McpForm;
  id: string;
  onChange(patch: Partial<McpForm>): void;
  onIdChange(id: string): void;
};

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function EnvRows({ env, onChange }: { env: McpForm["env"]; onChange(env: McpForm["env"]): void }) {
  const edit = (i: number, patch: Partial<McpForm["env"][number]>) =>
    onChange(env.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{t.env}</legend>
      <p className="text-xs text-muted-foreground">{t.envHelp}</p>
      {env.map((e, i) => (
        <div key={e.key} className="flex gap-2">
          <Input
            aria-label={t.envName}
            className="w-2/5 font-mono"
            spellCheck={false}
            value={e.name}
            onChange={(ev) => edit(i, { name: ev.target.value })}
          />
          <Input
            aria-label={t.envValue}
            type="password"
            autoComplete="off"
            value={e.value}
            onChange={(ev) => edit(i, { value: ev.target.value })}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={fr.integrations.mcpServers.remove}
            onClick={() => onChange(env.filter((_, j) => j !== i))}
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="justify-self-start"
        onClick={() => onChange([...env, { key: crypto.randomUUID(), name: "", value: "" }])}
      >
        <Plus aria-hidden className="size-4" />
        {t.envAdd}
      </Button>
    </fieldset>
  );
}

function StdioFields({ form, onChange }: Pick<Props, "form" | "onChange">) {
  const ids = { command: useId(), args: useId() };
  return (
    <>
      <Field id={ids.command} label={t.command}>
        <Input
          id={ids.command}
          className="font-mono"
          spellCheck={false}
          value={form.command}
          onChange={(e) => onChange({ command: e.target.value })}
        />
      </Field>
      <Field id={ids.args} label={t.args} help={t.argsHelp}>
        <Textarea
          id={ids.args}
          className="font-mono"
          spellCheck={false}
          rows={3}
          value={form.args}
          onChange={(e) => onChange({ args: e.target.value })}
        />
      </Field>
      <EnvRows env={form.env} onChange={(env) => onChange({ env })} />
    </>
  );
}

function HttpFields({ form, onChange }: Pick<Props, "form" | "onChange">) {
  const ids = { url: useId(), bearer: useId() };
  return (
    <>
      <Field id={ids.url} label={t.url} help={t.urlHelp}>
        <Input
          id={ids.url}
          className="font-mono"
          spellCheck={false}
          value={form.url}
          onChange={(e) => onChange({ url: e.target.value })}
        />
      </Field>
      <Field id={ids.bearer} label={t.bearer}>
        <Input
          id={ids.bearer}
          type="password"
          autoComplete="off"
          value={form.bearer}
          onChange={(e) => onChange({ bearer: e.target.value })}
        />
      </Field>
    </>
  );
}

export function McpServerFields({ form, id, onChange, onIdChange }: Props) {
  const ids = { name: useId(), id: useId() };
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field id={ids.name} label={t.name}>
          <Input id={ids.name} value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field id={ids.id} label={t.id} help={t.idHelp}>
          <Input
            id={ids.id}
            className="font-mono"
            spellCheck={false}
            value={id}
            onChange={(e) => onIdChange(e.target.value)}
          />
        </Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t.type}</legend>
        <RadioGroup
          value={form.transport}
          onValueChange={(v) => onChange({ transport: v === "http" ? "http" : "stdio" })}
          className="grid grid-cols-2 gap-2"
        >
          <ChoiceCard value="stdio" icon={Terminal} title={t.stdio} description={t.stdioHelp} />
          <ChoiceCard value="http" icon={Globe} title={t.http} description={t.httpHelp} />
        </RadioGroup>
      </fieldset>
      {form.transport === "stdio" ? (
        <StdioFields form={form} onChange={onChange} />
      ) : (
        <HttpFields form={form} onChange={onChange} />
      )}
    </div>
  );
}
