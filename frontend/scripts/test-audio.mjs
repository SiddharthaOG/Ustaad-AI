import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.resolve(__dirname, "..");
const output = path.join(root, ".audio-test-build");
const compiler = path.join(root, "node_modules", "typescript", "bin", "tsc");

try {
  const compile = spawnSync(process.execPath, [
    compiler,
    "src/lib/audio/wav.ts",
    "src/lib/audio/audio-file.ts",
    "--target", "ES2022",
    "--module", "commonjs",
    "--lib", "ES2022,DOM",
    "--outDir", ".audio-test-build",
    "--skipLibCheck",
    "--strict",
  ], { cwd: root, stdio: "inherit" });

  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const tests = spawnSync(process.execPath, ["--test", "tests/audio.test.mjs"], { cwd: root, stdio: "inherit" });
    process.exitCode = tests.status ?? 1;
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}

