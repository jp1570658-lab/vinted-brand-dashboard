// Derives prisma/schema.demo.prisma from prisma/schema.prisma for local DEMO runs.
//
// The ONLY difference is the datasource provider: DEMO uses SQLite (zero setup),
// LIVE/Railway uses PostgreSQL. Prisma's `provider` can't be switched via an env
// var, so DEMO gets its own generated schema. SQLite accepts the ItemStatus enum
// in Prisma 6, so the schema is otherwise byte-identical and the generated client
// is the same shape in both modes — no app code changes between DEMO and LIVE.
//
// This file is the single source of truth's transformer: schema.prisma is edited
// by hand; schema.demo.prisma is always regenerated (via `npm run db:demo`) and is
// git-ignored so the two can never drift.
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const srcPath = path.join(dir, 'schema.prisma');
const outPath = path.join(dir, 'schema.demo.prisma');

const src = fs.readFileSync(srcPath, 'utf8');
const NEEDLE = 'provider = "postgresql"';
if (!src.includes(NEEDLE)) {
  console.error(`[make-demo-schema] '${NEEDLE}' not found in schema.prisma — aborting.`);
  process.exit(1);
}

const header =
  '// AUTO-GENERATED from schema.prisma for local DEMO (SQLite). DO NOT EDIT.\n' +
  '// Regenerate with `npm run db:demo`. LIVE uses schema.prisma (PostgreSQL).\n\n';
const out = header + src.replace(NEEDLE, 'provider = "sqlite"');
fs.writeFileSync(outPath, out);
console.log('[make-demo-schema] wrote prisma/schema.demo.prisma (provider = sqlite)');
