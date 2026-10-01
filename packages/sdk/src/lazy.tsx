import { Component, type ComponentType, lazy, type ReactNode, Suspense, useState } from "react";
import { cn } from "./lib/utils";
import { Button } from "./ui/button";

export type LazyLabels = { loading: string; failed: string; retry: string };
export type LazyOptions = { fallback?: "visible" | "sr-only" | "children" };

export const LAZY_FALLBACK_SELECTOR = "[data-kibo-loading]";

class LazyLoadError extends Error {
  constructor(readonly original: unknown) {
    super("lazy module failed to load");
  }
}

type BoundaryProps = { labels: LazyLabels; onRetry(): void; children: ReactNode };

class LoadBoundary extends Component<BoundaryProps, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (error instanceof LazyLoadError) console.error(error.original);
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (!(error instanceof LazyLoadError)) throw error;
    return (
      <div role="alert" className="flex items-center gap-3 p-4 text-sm text-destructive">
        <span>{this.props.labels.failed}</span>
        <Button variant="outline" size="sm" onClick={this.props.onRetry}>
          {this.props.labels.retry}
        </Button>
      </div>
    );
  }
}

function Loading({ label, srOnly }: { label: string; srOnly: boolean }) {
  return (
    <output
      data-kibo-loading=""
      className={cn("block p-4 text-sm text-muted-foreground", srOnly && "sr-only")}
    >
      {label}
    </output>
  );
}

export function lazyPanel<P extends object>(
  load: () => Promise<ComponentType<P>>,
  labels: LazyLabels,
  opts: LazyOptions = {},
): ComponentType<P> {
  const create = () =>
    lazy(() =>
      load().then(
        (Loaded) => ({ default: Loaded }),
        (e: unknown) => {
          throw new LazyLoadError(e);
        },
      ),
    );
  let Loaded = create();
  function LazyPanel(props: P) {
    const [attempt, setAttempt] = useState(0);
    const retry = () => {
      Loaded = create();
      setAttempt((n) => n + 1);
    };
    const fallback =
      opts.fallback === "children" ? (
        ((props as { children?: ReactNode }).children ?? null)
      ) : (
        <Loading label={labels.loading} srOnly={opts.fallback === "sr-only"} />
      );
    return (
      <LoadBoundary key={attempt} labels={labels} onRetry={retry}>
        <Suspense fallback={fallback}>
          <Loaded {...props} />
        </Suspense>
      </LoadBoundary>
    );
  }
  return LazyPanel;
}
