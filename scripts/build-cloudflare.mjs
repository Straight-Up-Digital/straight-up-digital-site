import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const astroCli = fileURLToPath(new URL("../node_modules/astro/bin/astro.mjs", import.meta.url));
const result = spawnSync(process.execPath, [astroCli, "build"], {
  cwd: resolve(fileURLToPath(new URL("..", import.meta.url))),
  stdio: "inherit",
  env: { ...process.env, PUBLIC_FORM_MODE: "email" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
