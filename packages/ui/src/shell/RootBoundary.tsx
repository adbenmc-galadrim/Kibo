import { Button } from "@kibo/sdk/ui/button";
import { Component, type ReactNode } from "react";
import { fr } from "../i18n/fr";
import { KiboLogo } from "./KiboLogo";

type Props = { children: ReactNode; onReload?: () => void };

export class RootBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const reload = this.props.onReload ?? (() => location.reload());
    return (
      <main className="grid min-h-svh place-items-center bg-background p-6">
        <div className="grid w-full max-w-md justify-items-center gap-4 text-center">
          <KiboLogo className="size-14" />
          <h1 className="text-lg font-semibold">{fr.app.crashed}</h1>
          <Button onClick={reload}>{fr.app.reload}</Button>
        </div>
      </main>
    );
  }
}
