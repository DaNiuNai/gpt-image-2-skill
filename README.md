# gpt-image-2-skill

## 安装

```bash
npx skills add https://github.com/DaNiuNai/gpt-image-2-skill --skill gpt-image-2
```

## 脚本是如何运作的？

`scripts/gen.js` 本质上是一个很薄的 Codex CLI 封装，而不是直接调用 OpenAI 图片 API。它会解析 `--prompt`、`--out`、可重复的 `--ref`、`--timeout-sec` 和 `--force` 参数，检查本机是否存在 `codex` 命令，然后运行类似下面的命令：

```powershell
codex exec `
  --skip-git-repo-check `
  --sandbox read-only `
  --color never `
  --enable image_generation `
  -i <参考图路径>
```

脚本会通过 stdin 给 `codex exec` 传入一段明确的 instruction，要求 Codex 使用 `imagegen` 工具生成图片，并且只返回图片、不做解释。生成完成后，脚本会从本次新产生且带有运行标记的 Codex session rollout 中找到图片 base64，校验图片格式，再解码写入输出路径。

因此，准确理解是：这个脚本让本地已登录的 Codex CLI 开一个受限会话，请它调用 `imagegen` 绘图，然后脚本从 Codex 的会话记录里取出图片。

Codex 理论上仍然是一个通用 agent，不是一个只能绘图的裸 API 客户端。不过本脚本把它限制得比较窄：

- 使用 `--sandbox read-only`，Codex 自身不应修改工作区文件。
- 使用 `--enable image_generation`，目的是启用图像生成能力。
- instruction 明确要求直接生成图片、只返回图片、不解释。
- 参考图只通过 `-i` 传入。

所以在这个配置下，Codex 不应该执行无关任务或修改文件；但它仍可能进行必要的推理、读取运行环境中允许读取的上下文，并写入自己的 session 日志。不能把它等同于“只会绘图、没有 agent 行为”的直接图片 API。
