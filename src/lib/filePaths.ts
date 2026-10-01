import { createContext } from "react";

/**
 * File paths in the chat, as agents write them ("saved to docs/demo.mp4", `~/out/x.png`),
 * opened in the file viewer. A bare path needs a folder in it and an extension, so words
 * like "and/or" or "e.g." stay text; code spans need only look like one file name.
 */

const BARE_PATH = /(?<![\w/.@~-])((?:~\/|\.{1,2}\/|\/)?(?:[\w@.+-]+\/)+[\w@+-][\w@.+-]*\.[A-Za-z0-9]{1,8})(?![\w/])/g;
const CODE_PATH = /^(?:~\/|\.{1,2}\/|\/)?(?:[\w@.+-]+\/)*[\w@+-][\w@.+-]*\.[A-Za-z0-9]{1,8}$/;

/**
 * A bare dotted name that is code or a host, not a file: a member of an object every agent
 * names (`process.env`, `Math.random`, `tool.monitor`) or a domain (`example.com`). It is a
 * short list of what is known not to be a file, not a list of file extensions: `main.c`,
 * `App.vue` and `go.mod` are files, and a list of extensions always misses some.
 */
const CODE_OBJECT = /^(?:process|console|window|document|navigator|globalThis|Math|JSON|Object|Array|Number|String|Date|Promise|Reflect|Symbol|Bun|Deno|module|exports|import|this|self|tool|os|sys|np|pd|plt|fmt|std)\./;
const HOST_NAME = /\.(?:com|org|net|io|dev|app|ai|co|kr)$/i;
function isCodeName(name: string): boolean {
  return !name.includes("/") && (CODE_OBJECT.test(name) || HOST_NAME.test(name));
}

/** Text split into plain runs and the file paths in it. */
export function splitFilePaths(text: string): (string | { path: string })[] {
  const parts: (string | { path: string })[] = [];
  let offset = 0;
  for (const match of text.matchAll(BARE_PATH)) {
    const index = match.index ?? 0;
    // a version number or a domain is not a path: one of its segments must hold a letter
    if (!/[A-Za-z]/.test(match[1]!.replace(/\.[A-Za-z0-9]{1,8}$/, ""))) continue;
    if (index > offset) parts.push(text.slice(offset, index));
    parts.push({ path: match[1]! });
    offset = index + match[0].length;
  }
  if (offset < text.length) parts.push(text.slice(offset));
  return parts;
}

/** A code span that is a single file name or path (`README.md`, `src/app.ts`). */
export function codeIsFilePath(code: string): boolean {
  return CODE_PATH.test(code) && !isCodeName(code) && /[A-Za-z]/.test(code.replace(/\.[A-Za-z0-9]{1,8}$/, "")) && !/^\d+(?:\.\d+)+$/.test(code);
}

/** Opens a path in the file viewer; null where nothing can open one (paths stay text). */
export const OpenFileContext = createContext<((path: string) => void) | null>(null);
