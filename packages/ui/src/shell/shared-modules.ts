import * as sdk from "@kibo/sdk";
import * as utils from "@kibo/sdk/lib/utils";
import * as badge from "@kibo/sdk/ui/badge";
import * as button from "@kibo/sdk/ui/button";
import * as card from "@kibo/sdk/ui/card";
import * as dialog from "@kibo/sdk/ui/dialog";
import * as dropdownMenu from "@kibo/sdk/ui/dropdown-menu";
import * as input from "@kibo/sdk/ui/input";
import * as label from "@kibo/sdk/ui/label";
import * as radioGroup from "@kibo/sdk/ui/radio-group";
import * as select from "@kibo/sdk/ui/select";
import * as separator from "@kibo/sdk/ui/separator";
import * as sheet from "@kibo/sdk/ui/sheet";
import * as skeleton from "@kibo/sdk/ui/skeleton";
import * as switchUi from "@kibo/sdk/ui/switch";
import * as table from "@kibo/sdk/ui/table";
import * as textarea from "@kibo/sdk/ui/textarea";
import * as tooltip from "@kibo/sdk/ui/tooltip";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";

export const SHARED_MODULES: Readonly<Record<string, unknown>> = Object.freeze({
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "@kibo/sdk": sdk,
  "@kibo/sdk/lib/utils": utils,
  "@kibo/sdk/ui/badge": badge,
  "@kibo/sdk/ui/button": button,
  "@kibo/sdk/ui/card": card,
  "@kibo/sdk/ui/dialog": dialog,
  "@kibo/sdk/ui/dropdown-menu": dropdownMenu,
  "@kibo/sdk/ui/input": input,
  "@kibo/sdk/ui/label": label,
  "@kibo/sdk/ui/radio-group": radioGroup,
  "@kibo/sdk/ui/select": select,
  "@kibo/sdk/ui/separator": separator,
  "@kibo/sdk/ui/sheet": sheet,
  "@kibo/sdk/ui/skeleton": skeleton,
  "@kibo/sdk/ui/switch": switchUi,
  "@kibo/sdk/ui/table": table,
  "@kibo/sdk/ui/textarea": textarea,
  "@kibo/sdk/ui/tooltip": tooltip,
});

export function exposeSharedModules(): void {
  if (Reflect.get(globalThis, "__kiboShared") === SHARED_MODULES) return;
  Object.defineProperty(globalThis, "__kiboShared", {
    value: SHARED_MODULES,
    writable: false,
    configurable: false,
  });
}
