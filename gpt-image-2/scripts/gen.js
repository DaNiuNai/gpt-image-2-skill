#!/usr/bin/env node
// Generate an image via Codex CLI's imagegen tool, reusing the user's
// ChatGPT subscription session. Supports text-to-image and image-to-image.

const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const IMAGE_MAGIC_PREFIXES = [
  ["iVBORw0KGgo", "png"],
  ["/9j/", "jpg"],
  ["UklGR", "webp"],
];
const MIN_BLOB_LENGTH = 200;
const BASE64_BLOB_PATTERN = new RegExp(`^[A-Za-z0-9+/=]{${MIN_BLOB_LENGTH},}$`);
const ALLOWED_OUTPUT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const EXTENSION_BY_IMAGE_TYPE = {
  png: ".png",
  jpg: ".jpg",
  webp: ".webp",
};
const FORBIDDEN_POSIX_PREFIXES = [
  "/bin",
  "/boot",
  "/dev",
  "/etc",
  "/lib",
  "/proc",
  "/sbin",
  "/sys",
  "/usr",
  "/System",
  "/Library",
  "/var/root",
  "/var/log",
  "/var/db",
];

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

function findCommand(command) {
  const probe = process.platform === "win32" ? "where.exe" : "command";
  const probeArgs = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(probe, probeArgs, {
    shell: process.platform !== "win32",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return null;
  }

  const matches = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (process.platform === "win32") {
    return (
      matches.find((line) => /\.exe$/i.test(line)) ||
      matches.find((line) => /\.(cmd|bat)$/i.test(line)) ||
      matches[0] ||
      null
    );
  }

  return matches[0] || null;
}

function expandHome(rawPath) {
  if (rawPath === "~") {
    return os.homedir();
  }
  if (rawPath.startsWith("~/") || rawPath.startsWith("~\\")) {
    return path.join(os.homedir(), rawPath.slice(2));
  }
  return rawPath;
}

function resolveInputPath(rawPath) {
  return path.resolve(expandHome(rawPath));
}

async function collectRollouts(root) {
  const found = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) {
          found.push(fullPath);
        }
      }),
    );
  }

  await walk(root);
  return found.sort();
}

function createRunMarker() {
  const random = Math.random().toString(36).slice(2);
  return `gpt-image-2-run:${Date.now()}:${process.pid}:${random}`;
}

function validateOutputPath(rawOut) {
  const expanded = expandHome(rawOut);
  const ext = path.extname(expanded).toLowerCase();
  if (!ALLOWED_OUTPUT_EXTENSIONS.has(ext)) {
    throw new Error(
      `output path must end in one of ${Array.from(ALLOWED_OUTPUT_EXTENSIONS).sort().join(", ")}; got ${ext || "<none>"}`,
    );
  }

  const resolved = path.resolve(expanded);
  if (process.platform !== "win32") {
    const alt = resolved.startsWith("/private/")
      ? resolved.slice("/private".length)
      : null;
    const isForbidden = (value) =>
      FORBIDDEN_POSIX_PREFIXES.some(
        (prefix) => value === prefix || value.startsWith(`${prefix}/`),
      );
    if (isForbidden(resolved) || (alt && isForbidden(alt))) {
      throw new Error(
        `refusing to write under a system directory: ${resolved}`,
      );
    }
  }
  return resolved;
}

function outputPathForImageType(outPath, imageType) {
  const expectedExt = EXTENSION_BY_IMAGE_TYPE[imageType];
  const actualExt = path.extname(outPath).toLowerCase();
  if (
    !expectedExt ||
    actualExt === expectedExt ||
    (imageType === "jpg" && actualExt === ".jpeg")
  ) {
    return outPath;
  }

  return path.join(
    path.dirname(outPath),
    `${path.basename(outPath, path.extname(outPath))}${expectedExt}`,
  );
}

async function fileContainsText(filePath, needle) {
  try {
    const text = await fsp.readFile(filePath, "utf8");
    return text.includes(needle);
  } catch {
    return false;
  }
}

async function filterSessionsByMarker(sessionPaths, marker) {
  const checks = await Promise.all(
    sessionPaths.map(async (sessionPath) => ({
      sessionPath,
      matches: await fileContainsText(sessionPath, marker),
    })),
  );
  return checks
    .filter((entry) => entry.matches)
    .map((entry) => entry.sessionPath);
}

function detectImageType(blob) {
  let buffer;
  try {
    buffer = Buffer.from(blob, "base64");
  } catch {
    return null;
  }

  if (buffer.length < 12) {
    return null;
  }
  if (
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function collectBase64Strings(value, strings) {
  if (typeof value === "string") {
    if (BASE64_BLOB_PATTERN.test(value)) {
      strings.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectBase64Strings(item, strings);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectBase64Strings(item, strings);
    }
  }
}

async function findBestImageBlob(sessionPaths) {
  let best = null;

  for (const sessionPath of sessionPaths) {
    let text;
    try {
      text = await fsp.readFile(sessionPath, "utf8");
    } catch {
      continue;
    }

    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }

      let flat;
      try {
        flat = JSON.parse(line);
      } catch {
        continue;
      }

      const strings = [];
      collectBase64Strings(flat, strings);
      for (const blob of strings) {
        const magic = IMAGE_MAGIC_PREFIXES.find(([prefix]) =>
          blob.startsWith(prefix),
        );
        const type = magic && detectImageType(blob);
        if (type && (!best || blob.length > best.blob.length)) {
          best = { blob, ext: type };
        }
      }
    }
  }

  return best;
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function runCodex(codexArgs, instruction, timeoutSec) {
  return new Promise((resolve) => {
    const command = findCommand("codex");
    const isWindowsScript =
      process.platform === "win32" && command && /\.(cmd|bat)$/i.test(command);
    let child;
    try {
      child = isWindowsScript
        ? spawn(
            process.env.ComSpec || "cmd.exe",
            [
              "/d",
              "/s",
              "/c",
              `${quoteCmdArg(command)} ${codexArgs.map(quoteCmdArg).join(" ")}`,
            ],
            {
              stdio: ["pipe", "pipe", "pipe"],
              windowsHide: true,
            },
          )
        : spawn(command || "codex", codexArgs, {
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
          });
    } catch (err) {
      resolve({ code: 1, stdout: "", stderr: err.message, timedOut: false });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === "win32") {
        spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        child.kill("SIGTERM");
      }
    }, timeoutSec * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: `${stderr}${err.message}`, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: timedOut ? 124 : (code ?? 1), stdout, stderr, timedOut });
    });

    child.stdin.end(instruction);
  });
}

function stderrTail(text, lines = 40) {
  return text.split(/\r?\n/).slice(-lines).join("\n");
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  if (!findCommand("codex")) {
    console.error(
      "codex CLI not found. Install Codex CLI and run 'codex login' first.",
    );
    process.exit(3);
  }

  args.refs = args.refs.map(resolveInputPath);
  for (const ref of args.refs) {
    if (!fs.existsSync(ref) || !fs.statSync(ref).isFile()) {
      console.error(`Reference image not found: ${ref}`);
      process.exit(4);
    }
  }

  let outPath;
  try {
    outPath = validateOutputPath(args.out);
  } catch (err) {
    console.error(`invalid output path: ${err.message}`);
    process.exit(2);
  }
  if (!args.force && fs.existsSync(outPath)) {
    console.error(`output file already exists: ${outPath}`);
    console.error("Use --force to overwrite it.");
    process.exit(2);
  }

  const sessionsRoot = path.join(os.homedir(), ".codex", "sessions");
  await fsp.mkdir(sessionsRoot, { recursive: true });
  const before = new Set(await collectRollouts(sessionsRoot));

  const codexArgs = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--color",
    "never",
    "--enable",
    "image_generation",
  ];
  for (const ref of args.refs) {
    codexArgs.push("-i", ref);
  }

  const runMarker = createRunMarker();
  let instruction =
    "Use the imagegen tool to generate the image for the following request.";
  if (args.refs.length > 0) {
    instruction +=
      " Use the attached image(s) as visual reference / input for image-to-image.";
  }
  instruction +=
    `\nInternal correlation id: ${runMarker}` +
    "\nRequirements: generate the image directly, return only the image, no explanation.\n\nRequest:\n" +
    args.prompt;

  const result = await runCodex(codexArgs, instruction, args.timeoutSec);
  if (result.code !== 0) {
    console.error(`codex exec failed (exit=${result.code}). stderr tail:`);
    console.error(stderrTail(result.stderr));
    process.exit(5);
  }

  const after = await collectRollouts(sessionsRoot);
  const newSessions = after.filter((sessionPath) => !before.has(sessionPath));
  const ownSessions = await filterSessionsByMarker(newSessions, runMarker);
  if (ownSessions.length === 0) {
    console.error(`No new matching session rollout file under ${sessionsRoot}`);
    console.error(stderrTail(result.stderr));
    process.exit(6);
  }

  const image = await findBestImageBlob(ownSessions);
  if (!image) {
    console.error("Image payload not found in any new session file");
    console.error("(imagegen likely did not run; stderr tail:)");
    console.error(stderrTail(result.stderr, 30));
    process.exit(7);
  }

  const finalOutPath = outputPathForImageType(outPath, image.ext);
  if (!args.force && fs.existsSync(finalOutPath)) {
    console.error(`output file already exists: ${finalOutPath}`);
    console.error("Use --force to overwrite it.");
    process.exit(2);
  }

  await fsp.mkdir(path.dirname(finalOutPath), { recursive: true });
  await fsp.writeFile(finalOutPath, Buffer.from(image.blob, "base64"));
  console.log(finalOutPath);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
