import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aiReady, draftFixture } from "./draft-fixtures";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      const out = answer(req);
      if (out instanceof Error) throw out;
      return out;
    },
    subscribeAi: () => () => {},
  },
}));

const { DescribeCard, ResumeDraftBanner } = await import("./DescribeCard");

const describeLabel = "Ce que doit faire le composant";
const generateName = "Générer avec un agent";

beforeEach(() => {
  calls.length = 0;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

test("DescribeCard proposes a title and an id, then starts the draft", async () => {
  const onStarted = mock(() => {});
  answer = (req) =>
    req.method === "getAiStatus" ? aiReady : req.method === "startComponentDraft" ? draftFixture({}) : null;
  render(<DescribeCard onStarted={onStarted} />);
  const user = userEvent.setup();
  const button = await screen.findByRole("button", { name: generateName });
  await user.type(screen.getByLabelText(describeLabel), "Burndown du sprint : tickets");
  expect(button.hasAttribute("disabled")).toBe(false);
  expect((screen.getByLabelText("Identifiant") as HTMLInputElement).value).toBe("burndown-du-sprint");
  await user.click(button);
  expect(calls.at(-1)).toEqual({
    method: "startComponentDraft",
    draft: {
      mode: "create",
      id: "burndown-du-sprint",
      title: "Burndown du sprint",
      kind: "widget",
      withServer: false,
      description: "Burndown du sprint : tickets",
    },
  });
  expect(onStarted).toHaveBeenCalledTimes(1);
});

test("DescribeCard shows a taken id", async () => {
  answer = (req) =>
    req.method === "getAiStatus"
      ? aiReady
      : req.method === "startComponentDraft"
        ? new KiboError("CONFLICT", "taken")
        : null;
  render(<DescribeCard onStarted={() => {}} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(describeLabel), "Burndown du sprint : tickets");
  await user.click(screen.getByRole("button", { name: generateName }));
  expect(await screen.findByText("Identifiant déjà pris.")).toBeTruthy();
});

test("an id the daemon would reject keeps the button disabled and explains why", async () => {
  answer = (req) => (req.method === "getAiStatus" ? aiReady : null);
  render(<DescribeCard onStarted={() => {}} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(describeLabel), "Burndown du sprint : tickets");
  const id = screen.getByLabelText("Identifiant");
  await user.clear(id);
  await user.type(id, "mon id é");
  expect(screen.getByRole("button", { name: generateName }).hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByText("Minuscules, chiffres et tirets, 2 à 40 caractères, en commençant par une lettre."),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: generateName }));
  expect(calls.some((c) => c.method === "startComponentDraft")).toBe(false);
});

test("a daemon rejection is shown in French, never as the raw detail", async () => {
  const raw = '[{"code":"invalid_string","path":["draft","id"]}]';
  answer = (req) =>
    req.method === "getAiStatus"
      ? aiReady
      : req.method === "startComponentDraft"
        ? new KiboError("INVALID_INPUT", raw)
        : null;
  render(<DescribeCard onStarted={() => {}} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(describeLabel), "Burndown du sprint : tickets");
  await user.click(screen.getByRole("button", { name: generateName }));
  expect((await screen.findByRole("alert")).textContent).toBe("Le démon a refusé ces données.");
  expect(screen.queryByText(/invalid_string/)).toBeNull();
});

test("DescribeCard is disabled offline", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  answer = (req) => (req.method === "getAiStatus" ? aiReady : null);
  render(<DescribeCard onStarted={() => {}} />);
  expect(await screen.findByText("Hors ligne")).toBeTruthy();
  expect(screen.getByRole("button", { name: generateName }).hasAttribute("disabled")).toBe(true);
});

test("ResumeDraftBanner translates a listing failure", async () => {
  answer = () => new KiboError("INTERNAL", "sqlite: disk I/O error");
  render(<ResumeDraftBanner onResume={() => {}} />);
  expect(await screen.findByText("Erreur interne du démon.")).toBeTruthy();
  expect(screen.queryByText(/sqlite/)).toBeNull();
});
