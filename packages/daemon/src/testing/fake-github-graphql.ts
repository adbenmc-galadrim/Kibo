import { GITHUB_GRAPHQL, type GithubOperation } from "@kibo/schema";
import type { FakeGithub, FakeIssue, FakeProject, FakeProjectItem } from "./fake-github";

type GqlBody = { query?: string | undefined; variables?: Record<string, unknown> | undefined };
type Out = { status: number; body: unknown };
type Variables = Record<string, unknown>;

const PAGE = 100;
const isOperation = (key: string): key is GithubOperation => key in GITHUB_GRAPHQL;
const OPERATIONS = Object.keys(GITHUB_GRAPHQL).filter(isOperation);

const ok = (data: unknown): Out => ({ status: 200, body: { data } });
const error = (message: string): Out => ({ status: 200, body: { errors: [{ message }] } });
const unresolved = () => error("Could not resolve to a node");

function issueNode(slug: string, i: FakeIssue) {
  return {
    id: i.nodeId,
    number: i.number,
    title: i.title,
    body: i.body ?? "",
    state: i.state === "open" ? "OPEN" : "CLOSED",
    updatedAt: i.updatedAt,
    url: `https://github.com/${slug}/issues/${i.number}`,
    repository: { nameWithOwner: slug },
    labels: { nodes: i.labels.map((name) => ({ name })) },
  };
}

const fieldValues = (p: FakeProject, item: FakeProjectItem) => ({
  nodes: item.optionId ? [{ optionId: item.optionId, field: { id: p.fieldId } }] : [],
});

const repoIssues = (gh: FakeGithub, p: FakeProject) => gh.repos.get(p.repo)?.issues;

function projectItems(gh: FakeGithub, v: Variables): Out {
  const p = gh.project;
  const issues = p ? repoIssues(gh, p) : undefined;
  if (!p || !issues || v.projectId !== p.nodeId) return unresolved();
  const all = [...p.items.values()];
  const start = typeof v.after === "string" ? Number(v.after) : 0;
  const nodes = all.slice(start, start + PAGE).map((item) => {
    const issue = issues.get(item.issueNumber);
    return {
      id: item.itemId,
      updatedAt: item.updatedAt,
      fieldValues: fieldValues(p, item),
      content: issue && issue.gone === null ? issueNode(p.repo, issue) : {},
    };
  });
  const pageInfo = { hasNextPage: start + PAGE < all.length, endCursor: String(start + PAGE) };
  return ok({ node: { items: { pageInfo, nodes } } });
}

function addItem(gh: FakeGithub, v: Variables): Out {
  const p = gh.project;
  const issues = p ? repoIssues(gh, p) : undefined;
  if (!p || !issues || v.projectId !== p.nodeId) return unresolved();
  const issue = [...issues.values()].find((i) => i.nodeId === v.contentId);
  if (!issue) return error("Could not resolve content");
  const existing = [...p.items.values()].find((i) => i.issueNumber === issue.number);
  const item = existing ?? gh.addProjectItem(issue.number, null);
  return ok({ addProjectV2ItemById: { item: { id: item.itemId } } });
}

function setStatus(gh: FakeGithub, v: Variables): Out {
  const p = gh.project;
  const item = p?.items.get(String(v.itemId));
  if (!p || !item || v.fieldId !== p.fieldId) return error("Could not resolve item");
  if (!p.options.some((o) => o.id === v.optionId)) return error("Invalid option");
  item.optionId = String(v.optionId);
  item.updatedAt = gh.tick();
  return ok({ updateProjectV2ItemFieldValue: { projectV2Item: { id: item.itemId } } });
}

function issueItems(gh: FakeGithub, v: Variables): Out {
  const slug = `${String(v.owner)}/${String(v.name)}`;
  const issue = gh.repos.get(slug)?.issues.get(Number(v.number));
  if (!issue) return ok({ repository: { issue: null } });
  const p = gh.project;
  const items =
    p && p.repo === slug ? [...p.items.values()].filter((i) => i.issueNumber === issue.number) : [];
  const nodes = p
    ? items.map((i) => ({ id: i.itemId, project: { id: p.nodeId }, fieldValues: fieldValues(p, i) }))
    : [];
  return ok({ repository: { issue: { id: issue.nodeId, projectItems: { nodes } } } });
}

function listProjects(gh: FakeGithub, v: Variables): Out {
  const slug = `${String(v.owner)}/${String(v.name)}`;
  const p = gh.project;
  const nodes =
    p && p.repo === slug
      ? [
          {
            id: p.nodeId,
            number: p.number,
            title: p.title,
            owner: { login: p.owner },
            field: { id: p.fieldId, options: p.options },
          },
        ]
      : [];
  return ok({ repository: { projectsV2: { nodes } } });
}

const HANDLERS: Record<GithubOperation, (gh: FakeGithub, v: Variables) => Out> = {
  projectItems,
  addItem,
  setStatus,
  issueItems,
  listProjects,
};

export function handleGraphql(gh: FakeGithub, body: GqlBody): Out {
  const op = OPERATIONS.find((key) => GITHUB_GRAPHQL[key] === body.query);
  if (!op) return { status: 400, body: { errors: [{ message: "unknown query" }] } };
  return HANDLERS[op](gh, body.variables ?? {});
}
