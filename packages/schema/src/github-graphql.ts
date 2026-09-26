export const GITHUB_GRAPHQL = {
  projectItems: `query KiboProjectItems($projectId: ID!, $after: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          updatedAt
          fieldValues(first: 20) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { optionId field { ... on ProjectV2SingleSelectField { id } } } } }
          content { ... on Issue { id number title body state updatedAt url repository { nameWithOwner } labels(first: 20) { nodes { name } } } }
        }
      }
    }
  }
}`,
  addItem: `mutation KiboAddItem($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
}`,
  setStatus: `mutation KiboSetStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }) { projectV2Item { id } }
}`,
  issueItems: `query KiboIssueItems($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      projectItems(first: 20) {
        nodes {
          id
          project { id }
          fieldValues(first: 20) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { optionId field { ... on ProjectV2SingleSelectField { id } } } } }
        }
      }
    }
  }
}`,
  listProjects: `query KiboListProjects($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    projectsV2(first: 50) {
      nodes {
        id number title
        owner { ... on Organization { login } ... on User { login } }
        field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
      }
    }
  }
}`,
} as const;
export type GithubOperation = keyof typeof GITHUB_GRAPHQL;
export const GITHUB_OPERATION_NAMES: Record<GithubOperation, string> = {
  projectItems: "KiboProjectItems",
  addItem: "KiboAddItem",
  setStatus: "KiboSetStatus",
  issueItems: "KiboIssueItems",
  listProjects: "KiboListProjects",
};
