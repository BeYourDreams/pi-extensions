// node vendor/pi-reflag/check-find.mjs — Node >=22.6, no dependencies
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "reflag-find-"));
try {
  // Node strips TS types but does not map the .js specifiers used by pi's loader
  for (const f of readdirSync(join(here, "src")).filter((f) => ["find.ts", "xargs.ts", "types.ts"].includes(f))) {
    writeFileSync(join(tmp, f), readFileSync(join(here, "src", f), "utf8").replaceAll('.js"', '.ts"'));
  }
  const { translateFindArgs: t } = await import(pathToFileURL(join(tmp, "find.ts")).href);
  const cases = [
    [["-name", "*.ts", "-print"], ["-H", "-g", "*.ts"]],
    [["-maxdepth", "2", "-type", "f", "-name", "*.js", "."], ["-H", "-d", "2", "-t", "f", "-g", "*.js"]],
    [["node_modules", "-name", "x"], ["-H", "--no-ignore", "-g", "x", "node_modules"]],
    [["!", "-name", "x"], ["-H", "-E", "x"]],
    [["-path", "./node_modules/*", "-prune", "-o", "-print"], ["-H", "-E", "node_modules"]],
    [["-iname", "*.JS"], ["-H", "-i", "-g", "*.JS"]],
    [["-name", "*.js", "-o", "-name", "*.ts"], ["-H", "-g", "{*.js,*.ts}"]],
    [["-exec", "rm", "{}", ";"], ["-H", "-x", "rm", "{}"]],
    [["-mtime", "-3"], ["-H", "--changed-within", "3d"]],
    [["-size", "+10M"], ["-H", "-S", "+10mi"]],
    [["-perm", "-u+s"], undefined],
    [["--help"], undefined],
    [["-D", "exec"], undefined],
    [["-name", "a", "-iname", "b"], undefined],
    [["-type", "d", "-empty"], undefined],
    [["-regex", "a", "-regex", "b"], undefined],
    [["-user", "root"], ["-H", "--owner", "root"]],
    [["-name", "a", ",", "-name", "b"], undefined],
    [["-L", "-maxdepth", "1", "-name", "x", "src"], ["-H", "-L", "-d", "1", "-g", "x", "src"]],
  ];
  for (const [args, expected] of cases) {
    assert.deepEqual(t(args), expected, JSON.stringify(args));
  }
  console.log("find translate: " + cases.length + " cases OK");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
