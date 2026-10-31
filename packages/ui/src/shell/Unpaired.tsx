import { frStartup } from "../i18n/fr-startup";
import { KiboLogo } from "./KiboLogo";

export function Unpaired() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <div className="grid w-full max-w-md justify-items-center gap-4 text-center">
        <KiboLogo className="size-14" />
        <h1 className="text-lg font-semibold">{frStartup.unpaired}</h1>
      </div>
    </main>
  );
}
