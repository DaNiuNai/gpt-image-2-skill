# 依据、边界与推断

仅在用户询问来源、当前模型能力或 API 参数时读取。本文件把官方事实与经验性防护分开，避免把推断写成 OpenAI 保证。

## 官方可验证事实

1. `gpt-image-2` 支持生成和编辑、灵活尺寸与高保真图像输入，并提供固定模型快照。
   - https://developers.openai.com/api/docs/models/gpt-image-2

2. 官方列出的限制包括：跨生成视觉一致性偶尔失稳，以及结构化或布局敏感构图中的精确摆放困难。
   - https://developers.openai.com/api/docs/guides/image-generation

3. 官方提示指南建议按场景/背景 → 主体 → 细节 → 约束组织复杂提示；明确构图、视角、人物尺度、姿态和交互；多参考图逐张编号；通过小步、单变量迭代减少漂移。
   - https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide

4. 超过 `2560x1440` 总像素的输出属于更易波动的实验性范围。`low` 适合草稿，复杂最终资产应比较 `medium`/`high`。
   - https://developers.openai.com/api/docs/guides/image-generation

5. 对 `gpt-image-2` 应省略 `input_fidelity`，因为输入图自动按高保真处理。
   - https://developers.openai.com/api/docs/guides/image-generation

6. Mask 是提示驱动的软约束，不保证严格遵循形状；多输入图时只应用到第一张。
   - https://developers.openai.com/api/docs/guides/image-generation

7. 流式 API 会发送部分图像和完成事件。只有最终完成事件应被保存为成品。
   - https://developers.openai.com/api/docs/guides/image-generation

8. Responses API 图像工具可能改写提示，并返回 `revised_prompt` 供检查。
   - https://developers.openai.com/api/docs/guides/image-generation

## 经验性防护，不是官方保证

- “单一连续画面、同一空间、同一时刻、同一镜头”是依据官方构图原则设计的防拼贴约束，不是保证词。
- 减少微细节、复合材质和主体重叠，属于降低复杂度的保守工程策略；官方没有证明它能消除所有全局纹理伪影。
- 只使用必要参考图是为了减少职责冲突；API 支持多图不代表参考图越少一定越好。
- 新会话可作为连续恶化或布局锁定后的诊断对照，但不是官方修复步骤。
- 从最后一张干净检查点恢复，避免把坏图递归输入，是生产工作流的风险控制方法。
- 任何万能 negative prompt、固定重试次数或 high quality 都不能被描述为根治。

## 不应声称的内容

- 不声称可见蜂窝、棋盘格或碎纹一定由隐藏水印造成。
- 不声称所有碎图都是提示过长造成。
- 不声称固定模型快照等同于固定 seed 或逐像素复现。
- 不声称 mask 会保护选择区外的每个像素。
- 不声称模型侧伪影已经被官方完全修复。

