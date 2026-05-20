#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) { console.error("usage: run-with-env.mjs <cmd> [args...]"); process.exit(2); }
const child = spawn(cmd, args, { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
