import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(projectRoot, path), "utf8");
}

describe("deployment entrypoints", () => {
  const packageJson = JSON.parse(readProjectFile("package.json")) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
    packageManager: string;
    engines: Record<string, string>;
  };

  it("uses the standard Next.js lifecycle and strict validation commands", () => {
    expect(packageJson.scripts).toMatchObject({
      build: "next build",
      "db:lint": "supabase db lint --local --level warning --fail-on warning",
      "db:test": "supabase test db --local",
      dev: "next dev",
      lint: "eslint . --max-warnings 0",
      prebuild: "node scripts/verify-deploy-environment.mjs",
      preinstall: "only-allow pnpm",
      start: "next start",
      validate: "pnpm lint && pnpm ts-check && pnpm test && pnpm build",
    });
  });

  it("pins the supported package manager and Node.js runtime", () => {
    expect(packageJson.packageManager).toBe("pnpm@9.0.0");
    expect(packageJson.engines).toEqual({
      node: "24.x",
      pnpm: "9.x",
    });
  });

  it("does not retain the custom server toolchain", () => {
    expect(packageJson.devDependencies).not.toHaveProperty("tsup");
    expect(packageJson.devDependencies).not.toHaveProperty("tsx");
    expect(packageJson.devDependencies["@types/node"]).toMatch(/^\^24(?:\.|$)/);

    for (const path of [
      "scripts/build.sh",
      "scripts/dev.sh",
      "scripts/start.sh",
      "src/server.ts",
    ]) {
      expect(existsSync(join(projectRoot, path)), path).toBe(false);
    }
  });

  it("keeps local launchers on package lifecycle commands", () => {
    const startLocal = readProjectFile("start-local.sh");
    const startAll = readProjectFile("start-all.sh");
    const retainedLaunchers = `${startLocal}\n${startAll}`;

    expect(retainedLaunchers).not.toMatch(
      /src\/server\.ts|dist\/server\.js|scripts\/(?:build|dev|start)\.sh|pnpm\s+(?:tsx|tsup)/,
    );

    expect(startLocal).toMatch(/START_CMD=\(pnpm dev\)/);
    expect(startLocal).toMatch(/pnpm build/);
    expect(startLocal).toMatch(/START_CMD=\(pnpm start\)/);

    expect(startAll).toMatch(/pnpm build/);
    expect(startAll).toMatch(/nohup pnpm start/);
    expect(startAll).toMatch(/nohup pnpm dev/);
    expect(startAll).toMatch(/export PORT/);
    expect(startAll).not.toMatch(/\$\{WHITE\}|超级管理员登录|手机号:|密\s*码:/);
  });

});
