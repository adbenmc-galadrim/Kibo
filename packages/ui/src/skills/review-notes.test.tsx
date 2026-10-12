import { beforeEach, expect, mock, test } from "bun:test";
import { EditorView } from "@codemirror/view";
import type { RpcRequest, Skill, SkillReview, Topic } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { projectsFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";
import { type Host, HostProvider } from "../shell/Host";
import { pluginSkill, reviewFixture, SKILL_TEXT, skillsFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let reviews: SkillReview[] = [];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        switch (req.method) {
          case "skills.read":
            return Promise.resolve({ content: SKILL_TEXT, hash: "h1", modifiedAt: 0, file: "SKILL.md" });
          case "skills.save":
            return Promise.resolve({ ok: true, value: { hash: "h2", modifiedAt: 1 } });
          case "skillReviews.list":
            return Promise.resolve(reviews);
          case "skills.assets":
          case "fileVersions.list":
            return Promise.resolve([]);
          default:
            return Promise.resolve(null);
        }
      },
      subscribeTopic: (_: Topic, __: () => void) => () => {},
      subscribe: () => () => {},
    },
  }),
);

const { ReviewNotes } = await import("./ReviewNotes");
const { SkillEditor } = await import("./SkillEditor");

const SUGGESTION = `${SKILL_TEXT}Relis uniquement les lignes modifiées.\n`;
const improve = reviewFixture({ suggestion: SUGGESTION });
const plain = reviewFixture({
  id: "rv2",
  verdict: "ok",
  note: "Rien à changer.",
  suggestion: null,
  runLabel: "kibo · review-pr · KIB-12",
});
const done = [
  reviewFixture({ id: "rv3", status: "integrated", runLabel: "global · livraison · KIB-9" }),
  reviewFixture({ id: "rv4", status: "ignored", runLabel: "global · livraison · KIB-8" }),
];

const host = (): Host & { opened: string[] } => {
  const opened: string[] = [];
  return {
    opened,
    openTicket: (id) => opened.push(id),
    openNewTicket: () => {},
    openAssign: () => {},
    openFile: () => {},
    openView: () => {},
    openTarget: () => {},
  };
};

beforeEach(() => {
  calls.length = 0;
  reviews = [improve, plain, ...done];
});

const notes = (skill: Skill, h = host()) => {
  const handlers = {
    onIntegrate: mock((_: SkillReview) => {}),
    onOpen: mock((_: SkillReview) => {}),
    onIgnore: mock((_: SkillReview) => {}),
    onCopy: mock((_: SkillReview | null) => {}),
  };
  render(
    <HostProvider host={h}>
      <ReviewNotes skill={skill} reviews={reviews} {...handlers} />
    </HostProvider>,
  );
  return handlers;
};

test("screen 195b: each open review shows its verdict, its note, its run, its ticket and its actions", async () => {
  const h = host();
  const handlers = notes(skillsFixture()[0] as Skill, h);
  const panel = within(screen.getByRole("complementary", { name: "Notes de review" }));
  expect(panel.getByText("2 à traiter")).toBeTruthy();
  const first = within(panel.getByRole("article", { name: "global · livraison · KIB-14" }));
  expect(first.getByText("À améliorer")).toBeTruthy();
  expect(first.getByText("il y a 2 h")).toBeTruthy();
  expect(first.getByText(/Le volet conventions a relu tout le fichier/)).toBeTruthy();
  expect(first.getByText("· suggestion jointe")).toBeTruthy();
  expect(first.queryByRole("button", { name: "Ouvrir KIB-14" })).toBeNull();
  const user = userEvent.setup();
  await user.click(first.getByRole("button", { name: "Intégrer" }));
  expect(handlers.onIntegrate.mock.calls[0]?.[0].id).toBe("rv1");
  const second = within(panel.getByRole("article", { name: "kibo · review-pr · KIB-12" }));
  expect(second.getByText("OK")).toBeTruthy();
  expect(second.queryByRole("button", { name: "Intégrer" })).toBeNull();
  await user.click(second.getByRole("button", { name: "Ouvrir ici" }));
  await user.click(second.getByRole("button", { name: "Ignorer" }));
  expect(handlers.onOpen.mock.calls[0]?.[0].id).toBe("rv2");
  expect(handlers.onIgnore.mock.calls[0]?.[0].id).toBe("rv2");
});

test("the handled reviews are folded under Traitées, with their state", async () => {
  notes(skillsFixture()[0] as Skill);
  expect(screen.queryByRole("article", { name: "global · livraison · KIB-9" })).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Traitées · 2" }));
  expect(
    within(screen.getByRole("article", { name: "global · livraison · KIB-9" })).getByText("Intégrée"),
  ).toBeTruthy();
  expect(
    within(screen.getByRole("article", { name: "global · livraison · KIB-8" })).getByText("Ignorée"),
  ).toBeTruthy();
});

test("on a plugin skill, a review offers Copier pour modifier instead of Intégrer", async () => {
  const handlers = notes(pluginSkill("brainstorming"));
  const first = within(screen.getByRole("article", { name: "global · livraison · KIB-14" }));
  expect(first.queryByRole("button", { name: "Intégrer" })).toBeNull();
  await userEvent.setup().click(first.getByRole("button", { name: "Copier pour modifier" }));
  expect(handlers.onCopy).toHaveBeenCalled();
});

const views = () =>
  Array.from(document.querySelectorAll(".cm-editor")).flatMap((dom) => {
    const view = dom instanceof HTMLElement ? EditorView.findFromDOM(dom) : null;
    return view ? [view] : [];
  });

const editor = async () => {
  render(
    <HostProvider host={host()}>
      <SkillEditor
        skill={skillsFixture()[0] as Skill}
        projects={projectsFixture}
        carried={null}
        onBack={() => {}}
        onOpenSkill={() => {}}
      />
    </HostProvider>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /^Notes de review \(/ }));
  return user;
};
const saves = () => calls.filter((c) => c.method === "skills.save");

test("screen 195c: Intégrer shows the suggestion in diff, unified on a narrow screen, and Enregistrer marks the review", async () => {
  reviews = [{ ...improve, baseHash: "h0" }];
  const user = await editor();
  await user.click(await screen.findByRole("button", { name: "Intégrer" }));
  const diff = within(
    await screen.findByRole("region", { name: "Intégrer la review de global · livraison · KIB-14" }),
  );
  expect(diff.getByText("Le skill a changé depuis cette review")).toBeTruthy();
  await waitFor(() => expect(views().map((v) => v.state.doc.toString())).toEqual([SUGGESTION]));
  await user.click(diff.getByRole("radio", { name: "Côte à côte" }));
  await waitFor(() => expect(views().map((v) => v.state.doc.toString())).toEqual([SKILL_TEXT, SUGGESTION]));
  const lists = calls.filter((c) => c.method === "skillReviews.list").length;
  await user.click(diff.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() =>
    expect(saves()).toEqual([
      {
        method: "skills.save",
        id: "porte-qualite",
        scope: "user",
        content: SUGGESTION,
        baseHash: "h1",
        reviewId: "rv1",
      },
    ]),
  );
  await waitFor(() => expect(screen.queryByRole("region", { name: /^Intégrer la review/ })).toBeNull());
  expect(calls.filter((c) => c.method === "skillReviews.list").length).toBeGreaterThan(lists);
});

test("Annuler leaves the review untouched", async () => {
  const user = await editor();
  await user.click(await screen.findByRole("button", { name: "Intégrer" }));
  const diff = within(await screen.findByRole("region", { name: /^Intégrer la review/ }));
  expect(diff.queryByText("Le skill a changé depuis cette review")).toBeNull();
  await user.click(diff.getByRole("button", { name: "Annuler" }));
  expect(screen.queryByRole("region", { name: /^Intégrer la review/ })).toBeNull();
  expect(saves()).toEqual([]);
});

test("Ouvrir ici pins the note above the editor and the next save marks the review", async () => {
  const user = await editor();
  await user.click(await screen.findByRole("button", { name: "Ouvrir ici" }));
  expect(screen.getByText("Note de review ouverte ici")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(saves()).toHaveLength(1));
  expect(saves()[0]).toMatchObject({ reviewId: "rv2", content: SKILL_TEXT, baseHash: "h1" });
  await waitFor(() => expect(screen.queryByText("Note de review ouverte ici")).toBeNull());
});

test("Ignorer decides the review", async () => {
  const user = await editor();
  const panel = within(await screen.findByRole("complementary", { name: "Notes de review" }));
  await user.click(
    within(panel.getByRole("article", { name: "kibo · review-pr · KIB-12" })).getByRole("button", {
      name: "Ignorer",
    }),
  );
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "skillReviews.decide", id: "rv2", decision: "ignore" }),
  );
});
