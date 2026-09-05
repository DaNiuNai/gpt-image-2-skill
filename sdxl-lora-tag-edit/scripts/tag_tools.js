#!/usr/bin/env node
/*
 * LoRA 数据集标签工具（Node.js）。需要本机安装 Node.js（node 命令可用）。
 * 若未安装 Node，请直接告知用户安装，或改用手工编辑。
 *
 * 子命令：
 *   scan        扫描目录：图片/txt 配对情况 + 标签词频（找锚点特征）
 *   add-trigger 给所有 txt 最前面插入触发词（已存在则跳过，幂等）
 *   remove      从所有 txt 中删除指定标签（逗号分隔；括号/下划线/大小写均不敏感）
 *   normalize   规整为提示词格式：下划线转空格 + 括号转义（如 tashkent_(azur_lane) -> tashkent \(azur lane\)）
 *
 * 标签之间用英文逗号分隔；所有 txt 按 UTF-8 读写。
 * add-trigger / remove / normalize 会原地覆盖 txt，请先备份。
 *
 * 用法：
 *   node tag_tools.js scan        "D:\dataset" [--top 60]
 *   node tag_tools.js add-trigger "D:\dataset" --trigger "1s5x6g8a"
 *   node tag_tools.js remove      "D:\dataset" --tags "white hair,long hair,muscular"
 *   node tag_tools.js normalize   "D:\dataset"
 */
"use strict";
const fs = require("fs");
const path = require("path");

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".avif"]);

function splitTags(text) {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
function joinTags(tags) {
  return tags.join(", ");
}
// 比较用的归一化键：去掉转义反斜杠、转小写、压缩空白，使 "mountain \(arknights\)" 与 "mountain (arknights)" 等价
function key(tag) {
  return tag.replace(/\\/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
// 规整单个标签为提示词格式：下划线->空格，括号统一转义（幂等）
function normalizeTag(tag) {
  let s = tag.replace(/_/g, " ");
  s = s.replace(/\\([()])/g, "$1"); // 先去掉已有转义
  s = s.replace(/([()])/g, "\\$1"); // 再统一转义所有括号
  return s.replace(/\s+/g, " ").trim();
}

function listTxt(dir) {
  return fs
    .readdirSync(dir)
    .filter((n) => n.toLowerCase().endsWith(".txt"))
    .filter((n) => fs.statSync(path.join(dir, n)).isFile())
    .sort();
}
function readTxt(p) {
  return fs.readFileSync(p, "utf8");
}
function writeTxt(p, text) {
  fs.writeFileSync(p, text, "utf8");
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      flags[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else {
      positional.push(argv[i]);
    }
  }
  return { flags, positional };
}

function requireDir(dir) {
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`目录不存在: ${dir}`);
    process.exit(1);
  }
}

function cmdScan(dir, flags) {
  requireDir(dir);
  const top = parseInt(flags.top || "60", 10);
  const entries = fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isFile());
  const imageStems = new Set();
  const txtStems = new Set();
  for (const n of entries) {
    const ext = path.extname(n).toLowerCase();
    const stem = path.basename(n, path.extname(n));
    if (IMAGE_EXTS.has(ext)) imageStems.add(stem);
    else if (ext === ".txt") txtStems.add(stem);
  }
  console.log(`目录: ${dir}`);
  console.log(`图片: ${imageStems.size}   txt: ${txtStems.size}\n`);

  const missingTxt = [...imageStems].filter((s) => !txtStems.has(s)).sort();
  const missingImg = [...txtStems].filter((s) => !imageStems.has(s)).sort();
  if (missingTxt.length) {
    console.log(`[!] 有图片但缺 txt (${missingTxt.length}):`);
    missingTxt.slice(0, 20).forEach((s) => console.log(`    ${s}`));
    console.log("");
  }
  if (missingImg.length) {
    console.log(`[!] 有 txt 但缺图片 (${missingImg.length}):`);
    missingImg.slice(0, 20).forEach((s) => console.log(`    ${s}`));
    console.log("");
  }
  if (!missingTxt.length && !missingImg.length && imageStems.size) {
    console.log("[OK] 图片与 txt 一一配对\n");
  }

  const counter = new Map(); // 显示用原文 -> count
  const txts = listTxt(dir);
  for (const f of txts) {
    const seen = new Set();
    for (const tag of splitTags(readTxt(path.join(dir, f)))) {
      const k = key(tag);
      if (seen.has(k)) continue; // 每文件按"出现在几张图"计一次
      seen.add(k);
      counter.set(tag, (counter.get(tag) || 0) + 1);
    }
  }
  if (txts.length) {
    console.log(`标签词频（共 ${txts.length} 个 txt，数字 = 出现在多少张图里）：`);
    console.log("高频标签往往是该角色的固有特征 = 角色 LoRA 要删的锚点。\n");
    const sorted = [...counter.entries()].sort((a, b) => b[1] - a[1]);
    for (const [tag, c] of sorted.slice(0, top)) {
      const pct = ((100 * c) / txts.length).toFixed(1).padStart(5);
      console.log(`    ${String(c).padStart(4)}  ${pct}%  ${tag}`);
    }
    if (sorted.length > top) {
      console.log(`    ... 共 ${sorted.length} 种不同标签（用 --top 调整显示数量）`);
    }
  }
}

function cmdAddTrigger(dir, flags) {
  requireDir(dir);
  const trigger = (flags.trigger || "").trim();
  if (!trigger) {
    console.error("请用 --trigger 指定触发词");
    process.exit(1);
  }
  let changed = 0;
  for (const f of listTxt(dir)) {
    const p = path.join(dir, f);
    const tags = splitTags(readTxt(p));
    if (tags.some((t) => key(t) === key(trigger))) continue;
    writeTxt(p, joinTags([trigger, ...tags]));
    changed++;
  }
  console.log(`已在 ${changed} 个 txt 最前插入触发词 '${trigger}'（其余已存在，跳过）。`);
}

function cmdRemove(dir, flags) {
  requireDir(dir);
  const targets = new Set(splitTags(flags.tags || "").map(key));
  if (!targets.size) {
    console.error("请用 --tags 指定要删除的标签（逗号分隔）");
    process.exit(1);
  }
  let totalRemoved = 0;
  let filesChanged = 0;
  for (const f of listTxt(dir)) {
    const p = path.join(dir, f);
    const tags = splitTags(readTxt(p));
    const kept = tags.filter((t) => !targets.has(key(t)));
    const removed = tags.length - kept.length;
    if (removed) {
      writeTxt(p, joinTags(kept));
      totalRemoved += removed;
      filesChanged++;
    }
  }
  console.log(`已从 ${filesChanged} 个 txt 中删除 ${totalRemoved} 处标签。`);
  console.log(`删除的标签集: ${[...targets].sort().join(", ")}`);
}

function cmdNormalize(dir) {
  requireDir(dir);
  let changed = 0;
  const txts = listTxt(dir);
  for (const f of txts) {
    const p = path.join(dir, f);
    const tags = splitTags(readTxt(p));
    const next = tags.map(normalizeTag).filter((t) => t.length > 0);
    if (joinTags(next) !== joinTags(tags)) {
      writeTxt(p, joinTags(next));
      changed++;
    }
  }
  console.log(`已规整（下划线->空格、括号转义）：${changed}/${txts.length} 个 txt。`);
}

function main() {
  const [, , cmd, ...rest] = process.argv;
  const { flags, positional } = parseFlags(rest);
  const dir = positional[0];
  switch (cmd) {
    case "scan":
      return cmdScan(dir, flags);
    case "add-trigger":
      return cmdAddTrigger(dir, flags);
    case "remove":
      return cmdRemove(dir, flags);
    case "normalize":
      return cmdNormalize(dir);
    default:
      console.error("用法: node tag_tools.js <scan|add-trigger|remove|normalize> <目录> [选项]");
      process.exit(1);
  }
}

main();
