const HOME = /^(?:\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)(?=$|[/\\])/;

export function abbreviateHome(path: string): string {
  return path.replace(HOME, "~");
}
