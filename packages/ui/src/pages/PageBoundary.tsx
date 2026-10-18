import { lazyPanel } from "@kibo/sdk";
import { Component, Fragment, type ReactNode } from "react";
import { fr } from "../i18n/fr";

const PageErrorNotice = lazyPanel(() => import("./PageErrorNotice").then((m) => m.PageErrorNotice), fr.lazy);

type Props = { resetKey: string; children: ReactNode };
type State = { failed: boolean; attempt: number; resetKey: string };

export class PageBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown) {
    console.error("[kibo] page crashed", error);
  }

  retry = () => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));

  render() {
    if (this.state.failed) return <PageErrorNotice onRetry={this.retry} />;
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
