---
name: gpt-image-2
description: >
  在 Agent 中使用 GPT Image 2（ChatGPT Images 2.0）生成图像，
  复用你现有的 ChatGPT Plus 或 Pro 订阅；无需单独的 OpenAI API
  访问权限，也没有按图计费。通过本地 Codex CLI 支持文生图、图生图编辑、
  风格迁移和多参考图组合。触发词包括 "gpt image 2"、"gpt-image-2"、
  "ChatGPT Images 2.0"、"image 2"，或任何明确要求通过用户 ChatGPT
  方案生成或编辑图像的请求。
---

# GPT Image 2 — 通过你的 ChatGPT 订阅生成图像

在你的 agent 中使用 **GPT Image 2**（ChatGPT Images 2.0）生成图像，复用你现有的 ChatGPT Plus 或 Pro 订阅；**不需要单独的 OpenAI API 访问权限，不需要 Fal 或 Replicate token，也没有按图计费。**

支持文生图、图生图编辑、风格迁移和多参考图组合。整个流程都通过你已经登录的本地 `codex` CLI 运行。

> **注意：这个 skill 需要 ChatGPT Plus 或 Pro 订阅，并且需要本地安装 Codex CLI。** 

*示例输出：通过 `--ref` 将一个普通纯色图标重绘为浮世绘风格；构图被保留，渲染风格被替换，模型还主动加入了符合时代感的红色印章。*

## 何时触发

当用户明确要求通过自己的 ChatGPT 订阅使用 GPT Image 2 时触发，例如：

- "use GPT Image 2" / "use gpt-image-2" / "use ChatGPT Images 2.0"
- "use Image 2" / "image 2 this"
- 用户附上参考图，并要求混合、编辑或重设风格

如果用户只是普通地说“生成一张图”，但没有指定这条路线，不要自动触发。若用户已经指定使用 GPT Image 2，则不要静默退回到 HTML mockup、截图或其他图像模型。

## 如何调用

单个 Node 脚本会处理完整流程：用正确参数运行 `codex exec`，然后从持久化的 session rollout 中解码生成图像。

**文生图：**

```powershell
node scripts/gen.js `
  --prompt "<user's raw prompt>" `
  --out "C:\absolute\path\to\output.png"
```

**图生图**（`--ref` 可重复传入，用于多参考图组合）：

```powershell
node scripts/gen.js `
  --prompt "<user's raw prompt, e.g. 'repaint in watercolor'>" `
  --ref "C:\absolute\path\to\reference.png" `
  --out "C:\absolute\path\to\output.png"
```

可选参数：`--timeout-sec 300`（默认 300）。

## 默认行为

- **原样传递用户 prompt。** 除非用户要求，否则不要翻译、润色或添加风格修饰。
- **选择输出路径。** 如果用户未指定，默认使用当前工作目录下的 `./image-<YYYYMMDD-HHMMSS>.png`。
- **交付图像。** 脚本成功后，展示或附上输出文件。不要只说“完成了，见路径 X”。
- **文字密集型版面没问题。** Image 2 能较好处理信息图和时间线类 prompt。不要仅仅因为 prompt 文字多就提前警告。

## 硬性约束

- 未经许可，不要切换路线。如果用户说“use GPT Image 2”，不要替换为 DALL·E、Midjourney、HTML mockup 或手动截图流程。
- 除非用户要求，否则不要改写 prompt。
- 不要暗示这个 skill 可以在没有本地 `codex` 登录、没有有效 ChatGPT 订阅或没有图像生成权限的情况下工作。

## 前置条件

1. 已安装 `codex` CLI；可参考 [openai/codex](https://github.com/openai/codex)。
2. 已登录包含 Image 2 权限的 ChatGPT 方案：`codex login`。
3. 已安装 Node.js，并且 `node` 在 PATH 中。

这个 skill **本身不会授予图像生成能力**。它只是暴露用户已经通过 ChatGPT 订阅拥有的能力。

## 退出码

| code | 含义 |
|------|---------|
| 0    | 成功；输出路径会打印到 stdout |
| 2    | 参数错误 |
| 3    | 缺少 `codex` 或 `node` CLI |
| 4    | `--ref` 文件不存在 |
| 5    | `codex exec` 失败（可能是认证、网络或模型问题） |
| 6    | 未检测到新的 session 文件 |
| 7    | imagegen 没有生成图像载荷（功能未启用、额度问题或能力被拒绝） |

失败时，用一句话说明出错层级，不要把完整 stderr 倒给用户。

## 工作原理

`codex` CLI 会复用已登录的 ChatGPT session，并暴露 `imagegen` 工具；该工具由 `image_generation` feature flag 控制。脚本会：

1. 在运行前快照 `~/.codex/sessions/`
2. 运行 `codex exec --enable image_generation --sandbox read-only ...`（每个参考图都会传入 `-i <file>`）
3. 对比 sessions 目录，扫描每个新 rollout JSONL 中的 base64 图像载荷（通过 PNG / JPEG / WebP magic header 匹配）
4. 解码最大的匹配 blob，并写入 `--out`

codex-cli 0.111.0+ 中有两个容易被其他封装写错的非显然参数：

- `--enable image_generation` 是**必需的**；该功能仍在开发中，默认关闭。
- **不能**使用 `--ephemeral`；临时 session 不会持久化，因此图像载荷没有地方保存。

## 数据处理

脚本刻意保持很窄的作用域：

- 它**只读取**由本次 `codex exec` 调用创建的 session rollout 文件。调用前会快照 sessions 目录，调用后再做差异对比，因此不会读取或传输之前已有的 `~/.codex/sessions/*` 文件（其中可能包含无关的 Codex 对话）。
- 它只写入输出图像文件，也就是调用方指定的 `--out` 路径。
- 不请求凭据，也不访问 `~/.codex/` 下除 sessions 目录之外的其他路径。
- 这个 skill 自身不会发起额外网络请求。唯一的出站流量来自 `codex` CLI 本身（使用用户现有的 ChatGPT 登录访问 OpenAI）；本 skill 不添加 endpoint、遥测或回调。

## 这个 skill 不是什么

它不是直接的 OpenAI API 客户端。它不会授予新能力，而是依赖用户可用的 Codex CLI 登录状态。它也不是多租户服务（每次调用只处理一次请求；并发调用依赖文件系统快照差异来区分）。

