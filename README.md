# skills

## gpt-image-2-skill

### 安装

```bash
npx skills add https://github.com/DaNiuNai/skills --skill gpt-image-2
```

安装完成后，请确保本机已安装并登录 Codex CLI：

1. 检查 `codex` 命令是否可用：

   ```bash
   codex --version
   ```

   如果提示找不到命令，请先安装：

   ```bash
   npm install -g @openai/codex
   ```

2. 确认已登录有 Plus 或 Pro 订阅的 OpenAI 账号：

   ```bash
   codex login status
   ```

   如果未登录，请执行 `codex login` 完成登录。Codex 的图像生成功能需要 Plus 或 Pro 订阅才能使用。

## gpt-image-fragmentation-guard

防止、诊断和恢复 GPT Image 生成中的碎图问题（碎图/破碎、网格、蜂窝、拼贴、分屏、重复肢体、画面接缝、脏噪点、ghosting 等）。通过建立空间连贯性规格、受控细节层级和生成后验收，并在失败时按恢复阶梯从干净状态回退。

### 安装

```bash
npx skills add https://github.com/DaNiuNai/skills --skill gpt-image-fragmentation-guard
```

## sdxl-lora-tag-edit

这个skill专门用于在SDXL模型上训练的LoRA进行标签编辑。