import type { Database } from "bun:sqlite";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import type { Account } from "./account";
import type { Challenges } from "./challenges";
import { readJson } from "./http";
import type { PairTokens } from "./pair-tokens";
import type { Passkeys } from "./passkeys";
import { clearedCookie, createSession, endSession, sessionCookie } from "./phone-sessions";
import {
  AuthenticationResponse,
  challengeOf,
  RegistrationResponse,
  type WebauthnPort,
} from "./webauthn-port";

const AUTH_MAX_BYTES = 64 * 1_024;
const USER_NAME = "kibo";

const Pairing = z.object({ accountId: z.string().min(1), pairToken: z.string().min(1) });
const PairVerify = Pairing.extend({ response: RegistrationResponse });
const LoginVerify = z.object({ response: AuthenticationResponse });

export type PhoneAuthDeps = {
  db: Database;
  now(): number;
  account: Account;
  pairTokens: PairTokens;
  passkeys: Passkeys;
  challenges: Challenges;
  webauthn: WebauthnPort;
};

const pairingInvalid = () => new KiboError("REMOTE_PAIRING_INVALID", "unknown or expired pairing code");
const loginRefused = () => new KiboError("UNAUTHORIZED", "passkey not recognised");

async function body<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await readJson(req, AUTH_MAX_BYTES));
  if (!parsed.success) throw new KiboError("INVALID_INPUT", "invalid passkey request");
  return parsed.data;
}

function assertPairing(deps: PhoneAuthDeps, { accountId, pairToken }: z.infer<typeof Pairing>): void {
  const verdict = deps.pairTokens.check(pairToken);
  if (verdict === "rate-limited") throw new KiboError("RATE_LIMITED", "too many wrong pairing codes");
  if (verdict === "invalid" || accountId !== deps.account.accountId()) throw pairingInvalid();
}

const signedIn = (token: string) =>
  Response.json({ ok: true }, { headers: { "set-cookie": sessionCookie(token) } });

async function pairOptions(req: Request, deps: PhoneAuthDeps): Promise<Response> {
  const pairing = await body(req, Pairing);
  assertPairing(deps, pairing);
  const options = await deps.webauthn.registrationOptions({
    userId: pairing.accountId,
    userName: USER_NAME,
    excludeCredentialIds: deps.passkeys.ids(),
  });
  deps.challenges.issue(options.challenge, "pair");
  return Response.json(options);
}

async function pairVerify(req: Request, deps: PhoneAuthDeps): Promise<Response> {
  const { response, ...pairing } = await body(req, PairVerify);
  assertPairing(deps, pairing);
  const expectedChallenge = challengeOf(response);
  if (!deps.challenges.consume(expectedChallenge, "pair")) throw pairingInvalid();
  const passkey = await deps.webauthn.verifyRegistration({ response, expectedChallenge });
  const token = deps.db.transaction(() => {
    if (!deps.pairTokens.consume(pairing.pairToken)) throw pairingInvalid();
    deps.passkeys.add(passkey);
    return createSession(deps.db, deps.now());
  })();
  return signedIn(token);
}

async function loginOptions(deps: PhoneAuthDeps): Promise<Response> {
  const options = await deps.webauthn.authenticationOptions({ allowCredentialIds: deps.passkeys.ids() });
  deps.challenges.issue(options.challenge, "login");
  return Response.json(options);
}

async function loginVerify(req: Request, deps: PhoneAuthDeps): Promise<Response> {
  const { response } = await body(req, LoginVerify);
  const expectedChallenge = challengeOf(response);
  if (!deps.challenges.consume(expectedChallenge, "login")) throw loginRefused();
  const passkey = deps.passkeys.find(response.id);
  if (!passkey) throw loginRefused();
  const { credentialId, counter } = await deps.webauthn.verifyAuthentication({
    response,
    expectedChallenge,
    passkey,
  });
  const token = deps.db.transaction(() => {
    deps.passkeys.use(credentialId, counter);
    return createSession(deps.db, deps.now());
  })();
  return signedIn(token);
}

function logout(req: Request, deps: PhoneAuthDeps): Response {
  endSession(deps.db, req);
  return Response.json({ ok: true }, { headers: { "set-cookie": clearedCookie() } });
}

type AuthHandler = (req: Request, deps: PhoneAuthDeps) => Promise<Response>;

const AUTH_ROUTES: Record<string, AuthHandler> = {
  "POST /api/phone/pair/options": pairOptions,
  "POST /api/phone/pair/verify": pairVerify,
  "POST /api/phone/login/options": (_req, deps) => loginOptions(deps),
  "POST /api/phone/login/verify": loginVerify,
  "POST /api/phone/logout": async (req, deps) => logout(req, deps),
};

export const authHandler = (route: string): AuthHandler | null =>
  Object.hasOwn(AUTH_ROUTES, route) ? (AUTH_ROUTES[route] ?? null) : null;
