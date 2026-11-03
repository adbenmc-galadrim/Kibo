import type { Database } from "bun:sqlite";

const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_LIVE_CHALLENGES = 64;

export type ChallengePurpose = "pair" | "login";

export type Challenges = {
  issue(challenge: string, purpose: ChallengePurpose): void;
  consume(challenge: string, purpose: ChallengePurpose): boolean;
};

export function createChallenges(db: Database, now: () => number): Challenges {
  const purge = () => db.run("DELETE FROM webauthn_challenges WHERE expires_at <= ?", [now()]);
  return {
    issue: (challenge, purpose) => {
      purge();
      db.run("INSERT INTO webauthn_challenges (challenge, purpose, expires_at) VALUES (?, ?, ?)", [
        challenge,
        purpose,
        now() + CHALLENGE_TTL_MS,
      ]);
      db.run(
        `DELETE FROM webauthn_challenges WHERE rowid NOT IN
           (SELECT rowid FROM webauthn_challenges ORDER BY expires_at DESC, rowid DESC LIMIT ?)`,
        [MAX_LIVE_CHALLENGES],
      );
    },
    consume: (challenge, purpose) => {
      purge();
      return (
        db.run("DELETE FROM webauthn_challenges WHERE challenge = ? AND purpose = ?", [challenge, purpose])
          .changes > 0
      );
    },
  };
}
