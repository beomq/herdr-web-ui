import type { IBuffer, ILink, ILinkProvider } from "@xterm/xterm";
import { hasFileNameEvidence } from "./filePaths.ts";

/** File names and paths, optionally followed by an agent's line/column reference. */
const FILE_PATH = /(?<![\p{L}\p{N}_/.@~:-])((?:~\/|\.{1,2}\/|\/)?(?:[\p{L}\p{N}_@.+-]+\/)*[\p{L}\p{N}_@+-][\p{L}\p{N}_@.+-]*\.[A-Za-z0-9]{1,8})(?::\d+(?::\d+)?)?(?![\p{L}\p{N}_/])/gu;

/** Local file URIs are read by the existing server-side file viewer. */
export function fileUriPath(uri: string): string | null {
  if (!/^file:\/\/\//i.test(uri)) return null;
  try {
    const url = new URL(uri);
    if (url.host || url.search || url.hash) return null;
    const path = decodeURIComponent(url.pathname);
    return path.includes("\0") ? null : path;
  } catch {
    return null; // malformed URI input is not a file link
  }
}

export function terminalFileLinks(buffer: IBuffer, lineNumber: number, open: (path: string) => void): (Omit<ILink, "activate"> & { activate: () => void })[] {
  let first = lineNumber - 1;
  while (first > 0 && buffer.getLine(first)?.isWrapped) first--;
  let text = "";
  const positions: { x: number; y: number }[] = [];
  for (let y = first; y < buffer.length; y++) {
    const line = buffer.getLine(y);
    if (!line || (y > first && !line.isWrapped)) break;
    for (let x = 0; x < line.length; x++) {
      const cell = line.getCell(x);
      if (!cell || cell.getWidth() === 0) continue;
      if (x === line.length - 1 && !cell.getChars() && buffer.getLine(y + 1)?.isWrapped
        && buffer.getLine(y + 1)?.getCell(0)?.getWidth() === 2) continue;
      const chars = cell.getChars() || " ";
      text += chars;
      for (let i = 0; i < chars.length; i++) positions.push({ x: x + 1, y: y + 1 });
    }
  }
  const links: (Omit<ILink, "activate"> & { activate: () => void })[] = [];
  for (const match of text.matchAll(/file:\/\/\/[^\s<>"'`]+/gi)) {
    const uri = match[0].replace(/[),.;:!?]+$/, "");
    const path = fileUriPath(uri);
    const start = positions[match.index];
    const end = positions[match.index + uri.length - 1];
    if (!path || !start || !end || lineNumber < start.y || lineNumber > end.y) continue;
    links.push({ range: { start, end }, text: uri, activate: () => open(path) });
  }
  for (const match of text.matchAll(FILE_PATH)) {
    const path = match[1];
    if (!path || !/\p{L}/u.test(path.replace(/\.[A-Za-z0-9]{1,8}$/, ""))) continue;
    if (/^v?\d+(?:\.\d+)+$/.test(path)) continue;
    if (!hasFileNameEvidence(path) || /^\s*\(/.test(text.slice(match.index + match[0].length))) continue;
    // Web addresses belong to WebLinksAddon, not the file viewer.
    const before = text.slice(0, match.index);
    if (/\S*(?:https?:\/\/|file:\/\/)[^\s]*$/i.test(before)) continue;
    const start = positions[match.index];
    const end = positions[match.index + match[0].length - 1];
    if (!start || !end || lineNumber < start.y || lineNumber > end.y) continue;
    links.push({ range: { start, end }, text: match[0], activate: () => open(path) });
  }
  return links;
}

export function terminalFileLinkProvider(buffer: () => IBuffer, open: (path: string) => void): ILinkProvider {
  return { provideLinks: (line, callback) => callback(terminalFileLinks(buffer(), line, open)) };
}
