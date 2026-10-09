import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import fc from "fast-check";
import { gameTitleOf, itchEmbedProblem, parseItchEmbed } from "./itch-embed";
import { itchProblemOf } from "./itch-problem";

const URL_333 = "https://itch.io/embed-upload/1234567?color=333333";
const CODE = `<iframe frameborder="0" src="${URL_333}" allowfullscreen="" width="640" height="380"><a href="https://sigmatronic.itch.io/una-war">Play una-war on itch.io</a></iframe>`;

test("an embed address keeps its upload id and color", () => {
  expect(parseItchEmbed(URL_333)).toEqual({ uploadId: "1234567", url: URL_333, color: "333333", page: null });
  expect(itchEmbedProblem(URL_333)).toBeNull();
});

test("other query parameters are dropped", () => {
  expect(parseItchEmbed(`${URL_333}&foo=bar`)?.url).toBe(URL_333);
  expect(parseItchEmbed("https://itch.io/embed-upload/42?foo=bar")).toEqual({
    uploadId: "42",
    url: "https://itch.io/embed-upload/42",
    color: null,
    page: null,
  });
});

test("the full embed code yields the address and the game page", () => {
  expect(parseItchEmbed(CODE)).toEqual({
    uploadId: "1234567",
    url: URL_333,
    color: "333333",
    page: "https://sigmatronic.itch.io/una-war",
  });
  expect(parseItchEmbed(CODE.replaceAll('"', "'"))?.page).toBe("https://sigmatronic.itch.io/una-war");
});

test("every refused text names its cause", () => {
  expect(itchEmbedProblem("")).toBe("empty");
  expect(itchEmbedProblem("   ")).toBe("empty");
  expect(itchEmbedProblem("https://sigmatronic.itch.io/una-war")).toBe("page-url");
  expect(itchEmbedProblem("https://html.itch.zone/html/123/index.html")).toBe("not-itch");
  expect(itchEmbedProblem("https://itch.io/embed/1234")).toBe("upload-missing");
  expect(itchEmbedProblem("http://itch.io/embed-upload/1")).toBe("not-itch");
  expect(itchEmbedProblem('<iframe src="https://evil.example/x"></iframe>')).toBe("not-itch");
  expect(itchEmbedProblem("https://user:pw@itch.io/embed-upload/1")).toBe("not-itch");
  expect(itchEmbedProblem("https://itch.io:8443/embed-upload/1")).toBe("not-itch");
  expect(itchEmbedProblem("https://www.itch.io/embed-upload/1")).toBe("not-itch");
  expect(itchEmbedProblem("https://itch.io/embed-upload/1234567890123")).toBe("upload-missing");
  expect(itchEmbedProblem("pas une adresse")).toBe("not-itch");
  for (const bad of ["", "https://sigmatronic.itch.io/una-war", "https://itch.io/embed/1"])
    expect(parseItchEmbed(bad)).toBeNull();
});

test("a link outside itch.io is not taken as the game page", () => {
  const code = `<iframe src="${URL_333}"><a href="https://evil.example/una-war">x</a></iframe>`;
  expect(parseItchEmbed(code)?.page).toBeNull();
});

test("the game title comes from the last segment of its page", () => {
  expect(gameTitleOf("https://sigmatronic.itch.io/una-war")).toBe("Una war");
  expect(gameTitleOf("https://sigmatronic.itch.io/")).toBeNull();
  expect(gameTitleOf(null)).toBeNull();
});

const uploadId = fc.stringMatching(/^[1-9][0-9]{0,11}$/);
const color = fc.option(fc.stringMatching(/^[0-9a-f]{6}$/), { nil: null });
const author = fc.stringMatching(/^[a-z0-9]{1,20}$/).filter((a) => a !== "www");
const game = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,20}$/);
const page = fc.option(
  fc.tuple(author, game).map(([a, g]) => `https://${a}.itch.io/${g}`),
  { nil: null },
);
const quote = fc.constantFrom('"', "'");

const embedCode = (src: string, href: string | null, q: string, srcFirst: boolean): string => {
  const attrs = [`src=${q}${src}${q}`, `width=${q}640${q}`, `frameborder=${q}0${q}`];
  const ordered = srcFirst ? attrs : attrs.reverse();
  const link = href ? `<a href=${q}${href}${q}>Play on itch.io</a>` : "";
  return `<iframe ${ordered.join(" ")}>${link}</iframe>`;
};

test("property: any accepted text normalises to an itch.io embed address that re-parses identically", () => {
  fc.assert(
    fc.property(uploadId, color, page, quote, fc.boolean(), (id, c, p, q, srcFirst) => {
      const src = `https://itch.io/embed-upload/${id}${c ? `?color=${c}` : ""}`;
      const parsed = parseItchEmbed(embedCode(src, p, q, srcFirst));
      expect(parsed).toEqual({ uploadId: id, url: src, color: c, page: p });
      expect(itchEmbedProblem(embedCode(src, p, q, srcFirst))).toBeNull();
      if (!parsed) return;
      const url = new URL(parsed.url);
      expect(url.hostname).toBe("itch.io");
      expect(url.pathname).toBe(`/embed-upload/${id}`);
      expect(parseItchEmbed(parsed.url)).toEqual({ ...parsed, page: null });
    }),
  );
});

test("property: no address on another host is accepted", () => {
  fc.assert(
    fc.property(fc.domain(), uploadId, (host, id) => {
      fc.pre(host !== "itch.io");
      expect(parseItchEmbed(`https://${host}/embed-upload/${id}`)).toBeNull();
    }),
  );
});

test("daemon errors map to the widget problems", () => {
  const of = (code: ConstructorParameters<typeof KiboError>[0]) => itchProblemOf(new KiboError(code, "x"));
  expect(of("REMOTE_UNAVAILABLE")).toEqual({ kind: "offline", code: "REMOTE_UNAVAILABLE" });
  expect(of("TIMEOUT")).toEqual({ kind: "offline", code: "TIMEOUT" });
  expect(of("EMBED_REFUSED")).toEqual({ kind: "refused", code: "EMBED_REFUSED" });
  expect(of("REMOTE_NOT_FOUND")).toEqual({ kind: "notFound", code: "REMOTE_NOT_FOUND" });
  expect(of("RATE_LIMITED")).toEqual({ kind: "rateLimited", code: "RATE_LIMITED" });
  expect(of("PERMISSION_DENIED")).toEqual({ kind: "unavailable", code: "PERMISSION_DENIED" });
  expect(itchProblemOf(new Error("boom"))).toEqual({ kind: "unavailable", code: null });
});
