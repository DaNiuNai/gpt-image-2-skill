# danbooru 标签分类与删/留对照

本文件给出常见 danbooru / wd14 标签的分类，以及在不同 LoRA 类型下的默认删/留建议。编辑标签时按图索骥即可。**默认列针对最常见的「角色 LoRA」**；其他类型按 SKILL.md 的纲领调整（画风基本全留、概念删概念本身、功能性删目标维度）。

> 全文「删 / 留」都指**标签**：「留」= 把标签留在 txt 里，「删」= 把标签从 txt 去掉。你**想让 AI 学会**的特征 → **删**它的标签（绑到触发词）；你**不想学进去**的东西 → **留/补**它的标签。

## 目录

1. 基础数量词（必留）
2. 本体锚点特征（角色 LoRA 删）
3. 服装（看情况）
4. 环境 / 背景（留）
5. 动作 / 姿势 / 视角 / 构图（留）
6. 水印 / logo / 文字（务必打标 = 留/补）
7. 质量 / 元数据词（一般删）
8. 表情 / 情绪（看情况）

---

## 1. 基础数量词（必留）

描述画面里有几个人、是否独照。这是训练所需的骨架，几乎总是保留。

`1girl, 1boy, solo, 2girls, 2boys, multiple girls, multiple boys, 1other, solo focus, group`

物种 / 大类（furry、人外等）通常也作为基础词保留：`furry, furry male, furry female, anthro, humanoid`（注意：如果物种本身正是你要复刻的角色特征，则归到第 2 类删除）。

## 2. 本体锚点特征（角色 LoRA：删除）

这些是「这个角色长什么样」的标签。删掉它们，角色的外观就会绑到触发词。**这是角色 LoRA 删标的主力。** 在词频报告里出现在大多数图片中的，基本都属于这一类。

- **头发**：发色（`white hair, blonde hair, black hair, blue hair, gradient hair, multicolored hair…`）、发型/长度（`long hair, short hair, ponytail, braid, twintails, ahoge, bangs, hair between eyes…`）
- **眼睛**：瞳色（`purple eyes, red eyes, heterochromia…`）、眼型（`tsurime, sharp eyes…`）
- **皮肤 / 肤色**：`dark skin, pale skin, tan…`
- **体型 / 身材**：`muscular, muscular male, muscular female, bara, petite, curvy, large breasts, small breasts, flat chest, pectorals, abs, toned…`
- **非人特征**：`tail, horns, animal ears, cat ears, fox ears, wings, fangs, claws, scales, fur, slit pupils…`
- **面部固有特征**：`facial hair, beard, mole, freckles, scar (固定的), pointy ears…`
- **性别强调 / 视角占位**：`male focus, female focus`（介于基础词与锚点之间，角色 LoRA 通常可删）
- **年龄向标记**：`mature male, old, aged up…`（若是角色固有设定则删）

> 取舍：角色固有、几乎每张都出现 → 删。偶发的、会变的 → 可能属于第 3/5 类，保留。

## 3. 服装（看情况）

判断标准：**这件衣服是不是角色的「招牌固定造型」？**

- **招牌/固定服装**（想让角色总是穿它出现）→ **删**，让它绑到触发词。
- **该图特有 / 会变化的服装**（想能自由换装）→ **留**，让它可被分离控制。

示例：`shirt, black shirt, jacket, school uniform, armor, dress, swimsuit, hoodie, gloves, thighhighs, hat, cape, necktie…`

> 画风 LoRA：服装一律当内容**保留**。概念/功能性 LoRA：除非服装正是要学的概念，否则**保留**且保持数据集多样。

## 4. 环境 / 背景（留）

会随图变化、不想被学进角色的东西，保留它们让其各自归位。

`outdoors, indoors, sky, night, day, night sky, starry sky, sunset, cloud, grass, tree, forest, ocean, beach, room, bed, window, city, street, snow, rain, shooting star, star \(sky\), simple background, white background, gradient background…`（注意 `star \(sky\)` 这类带括号的标签括号要转义）

## 5. 动作 / 姿势 / 视角 / 构图（留 —— 而且一定要打全）

**这一类极其重要、最常被漏打。任何动作（哪怕只是「站着、坐着、躺着」这种最普通的）和任何镜头/视角/特殊构图，都一定要打标。** 漏打的话，这些信息会被错误地学进触发词，导致出图姿势僵化、构图固定。

- **动作 / 姿势**：`standing, sitting, lying, walking, running, kneeling, jumping, arms up, hand on hip, holding, leaning, crossed arms…`
- **视线 / 朝向**：`looking at viewer, looking up, looking back, looking to the side, facing away…`
- **镜头 / 视角 / 构图 / 特殊镜头**：`from side, from above, from below, from behind, upper body, full body, cowboy shot, close-up, portrait, dutch angle, wide shot, profile, pov…`

> 概念 LoRA 若要学的正是某个姿势/动作/视角本身，则把**描述该概念的那几个词删掉**，其余动作/镜头标签照常保留。

## 6. 水印 / logo / 文字（务必打标）

你**不想**被学进触发词的东西。打上标签 → 绑到自己的词 → 生成时不写这些词就不会出现。**编辑时确保它们在；看图打标时发现就加。**

`watermark, signature, logo, artist name, text, english text, japanese text, web address, twitter username, username, dated, character name, speech bubble, border, letterboxed, frame, censored, mosaic censoring, bar censor`

## 7. 质量 / 元数据词（一般删）

wd14 一般不加这些，但若数据里混入了，对训练 caption 通常无意义，删掉更干净：

`masterpiece, best quality, high quality, highres, absurdres, lowres, jpeg artifacts, scan, official art`

**无效元标签（Danbooru meta tag，描述帖子而非画面，必删）**：这些与画面内容/形式无关，纯粹是帖子的元信息，留着没有任何效果：

`commentary, commentary_request, translation_request, translated, check_translation, bad_id, bad_pixiv_id, md5_mismatch, artist_request, tagme, dated`

判断标准：标签描述的是「画面里有什么 / 画面长什么样」就可能有用，描述「这个帖子的元信息」就删。

## 8. 表情 / 情绪（看情况）

会随图变化的表情通常**保留**（不想固定到角色上）：`smile, open mouth, blush, angry, crying, expressionless, closed eyes, :d, tongue out, surprised`

> 但如果某个表情是角色的招牌固定神态、且想让它绑进角色，则删。

---

## 快速决策流程

对每一个标签问：**「这个特征，我想不想让 LoRA 学进触发词？」**

- 想（角色本体、要复刻的概念/维度）→ **删**
- 不想、希望它可被分离或不出现（背景、动作、换装、水印 logo）→ **留 / 补打**
- 训练骨架（数量词）→ **留**

记住总目标：让「想学的东西」因为没有标签而被迫绑到触发词；让「不想学的东西」因为有标签而各自归位。
