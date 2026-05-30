#!/usr/bin/env node

const { generateImage, GptImage2Error, stderrTail } = require("./image-gen");

function usage() {
  return `Generate an image through Codex CLI imagegen.

Usage:
  node scripts/gen.js --prompt "<text>" --out <path.png> [--ref <image>]... [--timeout-sec N] [--force]

Exit codes:
  0 success (path printed on stdout)
  2 bad args
  3 required CLI missing (codex)
  4 reference image not found
  5 codex exec failed
  6 no matching new session file detected
  7 image payload not found in session file`;
}

function parseArgs(argv) {
  const args = {
    prompt: "",
    out: "",
    refs: [],
    timeoutSec: 300,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      console.log(usage());
      process.exit(0);
    }

    const next = () => {
      if (i + 1 >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      i += 1;
      return argv[i];
    };

    if (arg === "--prompt") {
      args.prompt = next();
    } else if (arg === "--out") {
      args.out = next();
    } else if (arg === "--ref") {
      args.refs.push(next());
    } else if (arg === "--timeout-sec") {
      const value = Number(next());
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--timeout-sec must be a positive number");
      }
      args.timeoutSec = value;
    } else if (arg === "--force") {
      args.force = true;
    } else {
      throw new Error(`Unknown arg: ${arg}`);
    }
  }

  if (!args.prompt) {
    throw new Error("Missing --prompt");
  }
  if (!args.out) {
    throw new Error("Missing --out");
  }
  return args;
}

function printError(err) {
  if (err.exitCode === 5) {
    console.error(`${err.message} stderr tail:`);
    console.error(stderrTail(err.result.stderr));
    return;
  }
  if (err.exitCode === 6) {
    console.error(err.message);
    console.error(stderrTail(err.result.stderr));
    return;
  }
  if (err.exitCode === 7) {
    console.error(err.message);
    console.error("(imagegen likely did not run; stderr tail:)");
    console.error(stderrTail(err.result.stderr, 30));
    return;
  }

  console.error(err.message);
  if (err.existingPath) {
    console.error("Use --force to overwrite it.");
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  try {
    const outPath = await generateImage(args);
    console.log(outPath);
  } catch (err) {
    if (err instanceof GptImage2Error) {
      printError(err);
      process.exit(err.exitCode);
    }
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
}

main();
