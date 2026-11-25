import { Component, type ComponentType, lazy, type ReactNode, Suspense, useState } from "react";
import { fr } from "../i18n/fr";

type BoundaryProps = { onRetry(): void; children: ReactNode };

class ScreenBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[kibo-phone] screen failed", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-4">
        <p className="text-[15px] text-(--tracking-mfg)">{fr.screenFailed}</p>
        <button
          type="button"
          onClick={this.props.onRetry}
          className="flex min-h-11 items-center rounded-lg border border-(--tracking-border) px-4 text-[15px] font-medium"
        >
          {fr.retry}
        </button>
      </div>
    );
  }
}

export function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  const create = () => lazy(() => load().then((Loaded) => ({ default: Loaded })));
  let Loaded = create();
  function LazyScreen(props: P) {
    const [attempt, setAttempt] = useState(0);
    const retry = () => {
      Loaded = create();
      setAttempt((n) => n + 1);
    };
    return (
      <ScreenBoundary key={attempt} onRetry={retry}>
        <Suspense fallback={<p className="p-4 text-[15px] text-(--tracking-mfg)">{fr.loading}</p>}>
          <Loaded {...props} />
        </Suspense>
      </ScreenBoundary>
    );
  }
  return LazyScreen;
}
