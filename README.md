# SBTI+

一个娱乐向的人格测试小站：31 题 · 15 维度 · 16 种人格。纯静态单页，零依赖。

灵感来自 B 站 up 主「蛆肉儿串儿」的 SBTI 测试，但**题目、维度、人格、文案均为原创**，与原作无任何内容复用。

## 结构

```
.
├── index.html   # 三个屏：首页 / 答题 / 结果
├── style.css    # 暗色极简
├── app.js       # 状态机 + 评分 + 渲染
├── data.js      # 15 维度 / 31 题 / 16 人格（全部在这里改）
└── README.md
```

## 本地预览

任何静态服务器即可，例如：

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

或直接双击 `index.html`。

## 部署到 Zeabur

Zeabur 原生支持静态站：

1. 把这个目录推到一个 Git 仓库（GitHub/GitLab 等）
2. Zeabur → New Project → Deploy from Git → 选仓库
3. Service Type 选 **Static**（或让它自动识别）
4. **Output Directory** 留空 / 填 `.`（根目录就是静态产物）
5. 绑定域名即可

不需要 build 命令，没有依赖。

## 扩展 / 自定义

所有内容都在 `data.js` 里：

- `DIMS`：15 个维度，每个 `{k, name, opp}`。改名字直接改这里。
- `QUESTIONS`：题目数组。`Q(text, mainDim, [A, B, C], extra?)` 其中 A/B/C 分别对主维度 `+20 / 0 / -20`，`extra` 里可以给次维度追加微调。
- `TYPES`：人格数组。每个有 `profile`（显著维度 → H/M/L），评分时按"与理想值的贴合度"取平均。

改完刷新页面即可，不需要打包。

## 评分逻辑 (简版)

1. 每个维度初始 50，按答案累加 / 减分，clamp 到 [0, 100]
2. 对每个人格：仅看它 `profile` 里列出的维度，目标值 H=85 / M=50 / L=15
3. 单维度贴合度 = max(0, 100 - |实际值 - 目标值|)
4. 人格匹配度 = 所有显著维度的贴合度平均
5. 取 Top1 作为主人格，Top2~4 作为"其他匹配"

没有随机，同样的答案 = 同样的结果。

## License

代码 MIT。内容原创，随便改随便用，别拿去卖就行。
