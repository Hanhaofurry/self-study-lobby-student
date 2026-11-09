# 自學大廳 Self-Study Lobby（學生端）

給高中十～十二年級（含高職）的英文自學練習網站。純 HTML／CSS／JavaScript，免伺服器，可直接部署在 GitHub Pages。完整設計規劃見 [`docs/self-study-site-plan.md`](docs/self-study-site-plan.md)。

## 學生可以做什麼

- **選班級或年級**：輸入老師給的班級代碼（例如 `10A-2026`），或直接選年級自由練習。也可以用 `?class=10A-2026` 的連結或 QR Code 直接加入。
- **五種題型**：閱讀、字彙、文法、寫作、聽力。每題標示布魯姆層次與 DOK。
- **標準版／支援版**：支援版文章 Lexile 較低（約低 100L–150L）、句子較短。系統會依上次表現建議版本，學生也可自己切換。
- **四階段提示**：方向 → 線索 → 部分解析 → 完整解析＋變式題。提示會在文章中標示段落、關鍵字，或排除錯誤選項。
- **即時回饋**：針對每個錯誤選項給具體、鼓勵性的說明。
- **學習紀錄**：分數、獨立完成率、技能熟練度、錯題分析、近 4 週練習、建議下一步，並可匯出給老師。
- **UDL／無障礙**：字體大小（4 段）、行距、易讀字型、深色／暖色模式、語音朗讀（含生字發音）、生字中文卡、鍵盤快捷鍵（A–D、Enter、H、N、R）、減少動畫、可選計時。聽力在無法播放聲音時自動改用「讀作聽」模式。

## 計分規則（練習模式）

| 情況 | 得分（滿分 10） |
| --- | --- |
| 不用提示、第一次答對 | 10 |
| 每答錯一次 | −2 |
| 用到提示 1／2／3 後答對 | −1／−3／−5 |
| 以上扣分合計最多扣 7 分 | 最低 3 |
| 看完整解析（提示 4） | 3，答對變式題再 +3 |

寫作題以 4 向度 rubric 自評計分，使用提示與寫作工具不扣分。老師可在班級設定改用 `no-penalty`（提示不扣分）或 `quiz`（限制提示階段）。

## 隱私

不需要帳號、不蒐集姓名。所有紀錄只存在學生自己的瀏覽器（localStorage）。學生在「學習紀錄」頁輸入座號或暱稱後，可下載 JSON 或複製「學習紀錄碼」交給老師。

## 老師：如何新增內容（不用改程式）

所有內容都在 `content/` 資料夾：

```
content/
├── catalog.json        課程清單（新增課程要在這裡登記）
├── classes.json        班級代碼、開放單元與日期、計分模式、預設版本
├── rubrics.json        寫作評分規準
└── courses/
    └── g10-core-a/
        ├── course.json     課程設定與單元檔清單
        └── units/
            └── u01-phones.json   單元：文章、題組、題目、變式題
```

1. **新增單元**：複製 `content/courses/g10-core-a/units/u01-phones.json`，修改內容後，把檔名加到該課程的 `course.json` → `units`。
2. **題目必填欄位**：`question_id`（全站唯一）、`skill`、`sub_skill`、`type`（`single-choice`／`fill-blank`／`essay`）、`stem`、`options`、`answer`、`explanation`、四個 `hints`、`difficulty`、`bloom`、`dok`、`status`。
   - 只有 `status: "published"` 的題目會出現給學生；`draft`／`review` 會被隱藏。
   - 支援版：文章寫在 `variants` 的 `level: "support"`；題幹可另填 `stem_support`。
   - 提示的 `action` 可用：`highlight-paragraph`（加 `paragraph`，從 0 起算）、`highlight-words`（加 `words`）、`eliminate-option`（加 `eliminate`）、`show-variant`、`show-frames`、`show-model`、`replay`、`replay-slow`、`explain`。
3. **新增班級**：在 `content/classes.json` 加一筆，設定 `class_code`、`course_id`、`released_units`（含 `open_date`／`due_date`）、`scoring_mode`、`default_level`、`hint_policy.max_level`。學期結束設 `"archived": true`。
4. **新增課程**：在 `content/courses/` 建新資料夾與 `course.json`，再到 `content/catalog.json` 登記。
5. 在 GitHub 網頁上直接編輯或上傳檔案，按 **Commit changes**，幾分鐘後網站自動更新。

範例班級代碼：`10A-2026`（練習模式）、`V1-2026`（高職、支援版、提示不扣分）、`11B-2026`、`12C-2026`（小考模式，只開放第一階段提示）。

## 部署到 GitHub Pages

Repo 的 **Settings → Pages → Build and deployment**，Source 選 *Deploy from a branch*，選擇分支與 `/ (root)`，儲存即可。

## 本機預覽

內容以 `fetch` 讀取，需要用本機伺服器開啟（直接雙擊 `index.html` 無法載入）：

```bash
python3 -m http.server 8000
```

然後開啟 <http://localhost:8000>。

## 備註

- 範例文章的 Lexile 為估計值（`lexile_source: "estimated"`），正式使用前建議以 Lexile Analyzer 實測。
- 範例文章長度比規劃書建議的年級字數短，方便示範；老師可依規劃書第 2.3 節擴寫。
