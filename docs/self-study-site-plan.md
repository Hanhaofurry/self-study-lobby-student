# Hanhao English Studio｜高中英文自學練習網站規劃書

> 適用對象：高中十年級（高一）、十一年級（高二）、十二年級（高三），含程度較低學生與高職生
> 核心原則：通用設計（UDL）、內容與介面分離、老師免改程式即可切換課程與班級
> 文件語言：規劃說明使用繁體中文；所有英文練習內容使用英文
> 技術前提：延續本 repo 的純 HTML／CSS／JavaScript，部署於 GitHub Pages；內容以 JSON 檔（或由試算表匯出的 CSV 轉成 JSON）驅動

---

## 目錄

0. 設計總則與技術架構
1. 網站整體架構與功能規劃
2. 練習題型與認知層次
3. 即時回饋與分階段提示（鷹架設計）
4. 通用設計（UDL）與無障礙考量
5. 視覺風格
6. 交付內容
   - 6.1 網站頁面草圖文字描述
   - 6.2 資料庫與內容欄位範例結構
   - 6.3 老師新增課程與班級內容操作說明
7. 分期開發建議與驗收清單

---

## 0. 設計總則與技術架構

### 0.1 五項設計總則

1. **一套網站，多套內容**：網站程式只負責「讀取內容、呈現、記錄」。課程、單元、題目、班級全部放在 `content/` 資料夾中，老師新增或替換資料即可切換課程與年級。
2. **同一題，多種入口**：每篇閱讀與每道題目都可以有「標準版」與「支援版」，學生可自行選擇或由系統建議，不貼標籤、不公開顯示學生選了哪一版。
3. **先鼓勵嘗試，再提供協助**：提示分四階段，由淺到深；使用提示會被記錄，但「學習歷程」與「熟練度」分開呈現，避免學生因怕扣分而不敢求助。
4. **低門檻、高天花板**：程度較低的學生能完成基本任務並獲得成就感；程度較高的學生可挑戰延伸題（DOK 3）。
5. **隱私優先**：第一版不建立學生帳號、不蒐集個資；學習紀錄存在學生自己的瀏覽器（`localStorage`），需要時由學生「匯出學習紀錄」交給老師。第二版再視需求串接 Google 試算表或 Firebase／Supabase。

### 0.2 檔案架構（建議）

```
/
├── index.html                 首頁
├── practice.html              練習頁（以網址參數載入題組）
├── report.html                成績回饋與學習紀錄
├── teacher.html               老師工具（內容檢查、匯入、預覽、發布碼）
├── styles.css / app.js
├── js/
│   ├── content-loader.js      讀取並驗證 content/*.json
│   ├── engine.js              題目呈現、判分、提示、回饋
│   ├── progress-store.js      本機學習紀錄（localStorage）
│   └── a11y-settings.js       字體、行距、深色模式、朗讀、節奏設定
└── content/
    ├── catalog.json           所有課程索引（老師主要編輯檔之一）
    ├── classes.json           班級 ↔ 課程 ↔ 單元發布設定
    ├── tags.json              共用標籤字典
    └── courses/
        └── g10-core-a/
            ├── course.json
            └── units/
                ├── u01-identity.json
                └── u02-technology.json
```

> 範例內容檔請見 `docs/sample-content/unit-sample.json`，可直接作為老師複製修改的樣板。

### 0.3 網址與切換規則

- `index.html?class=10A-2026` → 以班級代碼載入該班已發布的課程。
- `practice.html?course=g10-core-a&unit=u01&set=reading-1&level=support` → 直接開啟某一題組的支援版。
- 學生第一次進站輸入（或掃 QR Code 帶入）班級代碼，之後記憶在本機；可隨時在設定中更換。

---

## 1. 網站整體架構與功能規劃

### 1.1 首頁

**主要內容**
1. 網站介紹：一句話說明「每天 10–15 分鐘，選自己的步調練英文」，搭配三個圖示說明「選單元 → 練習與提示 → 看回饋與下一步」。
2. 學習入口：
   - 「繼續上次練習」（若有紀錄，最醒目的主要按鈕）
   - 「選擇我的班級／年級」
   - 「今日推薦練習」（依未完成單元與錯題自動建議 1 組）
3. 近期進度摘要：本週練習次數、完成單元數、連續學習天數、最需要複習的技能（例如「Grammar：relative clauses」）。

**使用流程**
- 首次造訪：看到簡短導覽（3 張可跳過的卡片）→ 輸入班級代碼或選年級 → 進入單元列表。
- 回訪：直接看到「繼續上次練習」與進度摘要 → 一鍵回到上次的題目。

### 1.2 班級或年級選擇

**主要內容**
1. 三張年級卡片：十年級、十一年級、十二年級，每張顯示「目前開放課程數」與 Lexile 範圍說明（用學生看得懂的語言，例如「文章長度約 350–550 字」）。
2. 班級代碼輸入欄：輸入後直接載入該班老師發布的課程與單元（優先於年級預設課程）。
3. 課程切換器：同一年級可能有多門課（例如「必修英文 B1」「選修：英文閱讀與寫作」「高職英文」），以分段控制項（Segmented Control）切換。

**使用流程**
- 有班級代碼：輸入代碼 → 系統讀取 `classes.json` → 顯示「你已加入 10A（王老師）」→ 進入單元列表。
- 無班級代碼：選年級 → 選課程 → 進入單元列表（自由練習模式）。

### 1.3 課程單元列表

**主要內容**
1. 頁首：課程名稱、年級、整體完成度環形圖。
2. 篩選列：依「技能（閱讀／字彙／文法／寫作／聽力）」「難度（基礎／標準／挑戰）」「狀態（未開始／進行中／已完成／需複習）」篩選；可用主題標籤搜尋（如 `#environment`）。
3. 單元卡片：每個單元一張卡片，顯示
   - 單元編號與主題（例如 Unit 3 · Living with AI）
   - 包含的題組與預估時間（例如 5 組 · 約 40 分鐘）
   - 進度條與狀態徽章（✓ 已完成、● 進行中、↻ 需複習、🔒 尚未開放）
   - 老師設定的截止日（若有）

**使用流程**
- 點單元卡片 → 展開題組清單（閱讀 1、字彙 1、文法 1、寫作 1、聽力 1）→ 選題組 → 選版本（標準版／支援版，系統依上次表現預選）→ 進入練習頁。

### 1.4 練習頁面

**互動流程（每一題）**
1. **呈現**：顯示題目、必要的文本或音訊；上方顯示題組進度（第 3／8 題）與工具列（朗讀、字典、字體、計時開關）。
2. **作答**：選擇、拖曳、輸入或撰寫；鍵盤可完整操作。
3. **檢查答案**：學生按「檢查」後立即回饋（不是自動跳下一題）。
4. **答錯時**：顯示具體回饋 →「再試一次」或「我需要提示」（提示逐階開啟）。
5. **答對時**：顯示簡短肯定與「為什麼對」的一句話說明 →「下一題」。
6. **題組結束**：顯示小結（正確率、獨立完成題數、使用提示次數、建議下一步）。

**其他功能**
- 「標記此題」：學生可標記「我不確定」，即使答對也會列入複習清單。
- 「稍後再做」：可跳過題目，題組結束前提醒回來作答。
- 自動儲存：每次作答即存檔，關閉頁面不會遺失進度。

### 1.5 成績回饋與學習紀錄

**主要內容**
1. **本次成績**：分數、正確率、獨立完成率（未使用提示即答對的比例）、用時。
2. **錯題分析**：依「技能 → 子技能」分類（例如 Reading：inference 錯 3 題；Grammar：subject-verb agreement 錯 2 題），每類附「重新練習這類題目」按鈕（從同標籤題庫抽取變式題）。
3. **學習歷程**：近 4 週練習時間軸、各技能熟練度雷達圖或長條圖、提示使用趨勢（使用次數下降代表進步，以正向語言呈現）。
4. **建議下一步**：系統依規則給 1–3 個具體建議，例如：
   - 「你在 Inference 題目正確率 50%，建議先做『Reading 1 支援版』的變式題 3 題。」
   - 「字彙單元已全部完成！可以挑戰 Unit 2 的寫作任務。」
5. **匯出／分享**：匯出 JSON 或 PDF 學習報告；產生「學習紀錄碼」供老師匯入彙整（第一版）。

### 1.6 老師免改程式的內容切換機制

**分類欄位（每一筆題目與題組都必須具備）**

| 欄位 | 說明 | 範例值 |
| --- | --- | --- |
| `unit_id` | 單元 | `u03` |
| `topic` | 主題 | `technology`, `environment`, `identity` |
| `grade` | 適用年級（可多選） | `[10, 11]` |
| `difficulty` | 難度 | `foundation`（基礎）／`standard`（標準）／`challenge`（挑戰） |
| `skill` | 技能 | `reading`, `vocabulary`, `grammar`, `writing`, `listening` |
| `sub_skill` | 子技能 | `main-idea`, `inference`, `word-in-context`, `relative-clause` |
| `bloom` | 布魯姆層次 | `remember`…`create` |
| `dok` | 知識深度 | `1`, `2`, `3` |
| `lexile` | 文本 Lexile（閱讀／聽力適用） | `980` |
| `tags` | 自由標籤 | `["#gsat", "#vocational", "#textbook-L3"]` |

**標籤與篩選串接方式**
1. **課程 = 篩選條件的組合**：`course.json` 不一定要複製題目，可以用「查詢條件」組成課程，例如「grade 包含 11、topic 為 environment、tags 包含 `#textbook-L5`」。這讓同一份題庫可被不同課程重複使用。
2. **班級 = 課程 + 發布設定**：`classes.json` 指定班級代碼使用哪個課程、開放哪些單元、開放日期、截止日、是否允許支援版、計時設定。
3. **標籤命名規範**：使用 `#類別-值` 格式，例如 `#textbook-sanmin-b3-l5`（教科書版本與課次）、`#exam-gsat`（學測）、`#exam-tvee`（統測）、`#track-vocational`（高職）。
4. **篩選優先順序**：班級設定 > 課程設定 > 年級預設。如此老師只要改 `classes.json` 即可讓兩個班級使用不同進度。

---

## 2. 練習題型與認知層次

### 2.1 題型總覽

| 題型 | 布魯姆層次 | DOK | 主要作答形式 | 支援版調整重點 |
| --- | --- | --- | --- | --- |
| 閱讀理解 | 理解、分析 | 2–3 | 單選、多選、段落定位、證據配對、簡答 | 較低 Lexile 文本、段落小標、關鍵字標示 |
| 字彙 | 記憶、理解、應用 | 1–2 | 圖文配對、語境選詞、字根拆解、搭配詞 | 中文提示、例句、圖示、選項數減少 |
| 文法 | 理解、應用 | 1–2 | 選擇、句子改寫、錯誤偵測、句子重組 | 規則小卡、填空範圍縮小、句型框架 |
| 寫作 | 應用、分析、評鑑、創造 | 2–3 | 句子合併、段落組織、仿寫、短文寫作 | 句型框架（sentence frames）、詞彙庫、範文 |
| 聽力 | 理解、應用 | 1–2 | 聽後選擇、聽寫關鍵字、圖片配對 | 放慢語速、可重播、逐句字幕 |

### 2.2 各題型細部設計與英文題例

#### 2.2.1 閱讀理解（理解、分析；DOK 2–3）

**子技能與層次對應**

| 子技能 | 布魯姆 | DOK |
| --- | --- | --- |
| Main idea／Supporting details | 理解 | 2 |
| Word meaning in context | 理解 | 2 |
| Inference | 分析 | 2–3 |
| Author's purpose／Tone | 分析 | 3 |
| Text structure（cause–effect, compare–contrast） | 分析 | 2–3 |
| Evaluate an argument with evidence | 分析（延伸至評鑑） | 3 |

**題例（標準版文本節錄，約 1000L）**

> *Passage excerpt:* Many teenagers say they cannot imagine a day without their phones. Yet a growing number of schools are experimenting with phone-free classrooms, arguing that constant notifications fragment students' attention. Critics respond that banning phones ignores the reality that digital skills are essential for future careers.

- **Q1 (Main idea, DOK 2):** What is the passage mainly about?
  A. Why teenagers buy expensive phones
  B. A debate over whether schools should limit phone use
  C. How phones help students learn faster
  D. The history of mobile technology
- **Q2 (Inference, DOK 3):** Based on the passage, which statement would the critics most likely agree with?
  A. Phones should be banned in all public places.
  B. Schools should teach students to use phones responsibly.
  C. Notifications improve students' concentration.
  D. Digital skills are less important than reading skills.

**同一篇文章的支援版節錄（約 850L）**

> Many teenagers use their phones every day. Some schools now ask students to put their phones away in class. These schools say phone messages make it hard for students to focus. Other people do not agree. They say students need to learn digital skills for their future jobs.

#### 2.2.2 字彙（記憶、理解、應用；DOK 1–2）

| 活動 | 布魯姆 | DOK | 題例 |
| --- | --- | --- | --- |
| 圖文／定義配對 | 記憶 | 1 | Match the word *fragile* with its meaning: easily broken |
| 語境選詞 | 理解 | 1–2 | The glass vase is very ___, so please carry it carefully. (fragile / flexible / famous) |
| 字根字首拆解 | 理解 | 2 | *re-* in *rebuild* means ___. (again / not / before) |
| 搭配詞（collocation） | 應用 | 2 | We need to ___ a decision before Friday. (make / do / take) |
| 造句應用 | 應用 | 2 | Use *fragile* in a sentence about something in your home. |

#### 2.2.3 文法（理解、應用；DOK 1–2）

| 活動 | 布魯姆 | DOK | 題例 |
| --- | --- | --- | --- |
| 規則辨識 | 理解 | 1 | Which sentence uses the present perfect correctly? |
| 選擇填空 | 應用 | 1 | She ___ (live) in Tainan since 2020. |
| 錯誤偵測 | 理解 | 2 | Find the error: *Each of the students have a laptop.* |
| 句子改寫 | 應用 | 2 | Combine with *who*: I met a girl. She can speak three languages. |
| 情境應用 | 應用 | 2 | Write one sentence about your weekend using *used to*. |

#### 2.2.4 寫作（應用、分析、評鑑、創造；DOK 2–3）

| 任務層級 | 布魯姆 | DOK | 題例 |
| --- | --- | --- | --- |
| 句子合併 | 應用 | 2 | Combine: *It was raining. We went hiking.* (use *although*) |
| 段落排序與主題句 | 分析 | 2 | Put the four sentences in a logical order and choose the best topic sentence. |
| 評鑑範文 | 評鑑 | 3 | Read two short paragraphs. Which one supports its opinion better? Explain one reason. |
| 短文創作 | 創造 | 3 | Write 80–120 words: *Should high schools allow phones in class? Give two reasons.* |

**寫作的支援版設計**
- 句型框架：*In my opinion, ___. First, ___. For example, ___. Second, ___. Therefore, ___.*
- 主題詞彙庫：點選即可插入（如 *distraction, focus, responsible, emergency*）。
- 字數目標分級：基礎 40–60 字／標準 80–120 字／挑戰 150–180 字。
- 自我檢核清單（checklist）：☐ 有主題句 ☐ 有兩個理由 ☐ 至少一個例子 ☐ 有結論句 ☐ 檢查動詞時態。
- 評分：以 4 向度 rubric（Content、Organization、Language、Mechanics，每項 1–4 分）進行學生自評，老師可在匯入後複評；第二版可選擇加上 AI 輔助回饋（須經老師同意與審閱設定）。

#### 2.2.5 聽力（理解、應用；DOK 1–2）

| 活動 | 布魯姆 | DOK | 題例 |
| --- | --- | --- | --- |
| 聽後選圖 | 理解 | 1 | Listen and choose the picture that matches the speaker's plan. |
| 關鍵資訊擷取 | 理解 | 1–2 | What time does the train leave? |
| 聽寫關鍵字 | 應用 | 2 | Fill in the missing word: *Please ___ your seat belt.* |
| 情境回應 | 應用 | 2 | Choose the best response: *"Would you mind closing the window?"* |

**無音訊資源時的替代方案（依優先順序）**
1. **瀏覽器語音合成（Web Speech API `speechSynthesis`）**：直接朗讀題目中的 `transcript` 欄位，可調語速（0.7×／0.85×／1.0×）與選擇英美口音；不需錄音檔，GitHub Pages 即可運作。
2. **老師自錄音檔**：以手機錄音，上傳至 repo 的 `content/audio/` 或雲端空間，於 `audio_url` 填入連結。
3. **外部影音嵌入**：嵌入公開的 YouTube 片段並標註起訖秒數。
4. **「讀作聽」模式**（完全無聲環境或聽障學生）：逐句淡入顯示逐字稿（模擬聽力的線性、一次性特性），題目改為「讀後回應」，並於紀錄中標示為 transcript-mode，不與聽力成績混算。

### 2.3 依年級差異化與 Lexile 設計

**標準版與支援版 Lexile 範圍**

| 年級 | 標準版範圍 | 支援版範圍（低 100L–150L） | 建議文本長度（標準／支援） | 平均句長（標準／支援） |
| --- | --- | --- | --- | --- |
| 十年級 | 900L–1100L | 750L–1000L | 300–450 字／200–300 字 | 15–18 字／10–13 字 |
| 十一年級 | 950L–1150L | 800L–1050L | 400–550 字／250–350 字 | 17–20 字／11–14 字 |
| 十二年級 | 1000L–1200L | 850L–1100L | 450–650 字／300–400 字 | 18–22 字／12–15 字 |

> 計算方式：支援版下限＝標準版下限 −150L；支援版上限＝標準版上限 −100L。老師亦可針對特定班級（如高職班）在 `classes.json` 中設定 `default_level: "support"`。

**差異化調整面向**

| 面向 | 十年級 | 十一年級 | 十二年級 | 支援版通用做法 |
| --- | --- | --- | --- | --- |
| 句長與句構 | 以簡單句、對等連接為主，少量從屬子句 | 增加關係子句、分詞構句 | 多重從屬子句、倒裝、假設語氣 | 長句拆成兩句；被動改主動；關係子句改成獨立句 |
| 詞彙密度 | 以 2000–4000 常用字為主，生字率 ≤ 3% | 4000–5000 字，生字率 ≤ 4% | 5000–7000 字（學測進階詞彙），生字率 ≤ 5% | 生字率 ≤ 2%；生字提供滑鼠懸停／點按中文釋義 |
| 文本長度 | 300–450 字 | 400–550 字 | 450–650 字 | 縮短 30–40%，保留核心論點 |
| 主題抽象程度 | 具體生活：校園、家庭、興趣、健康 | 社會議題：科技、環境、文化差異 | 抽象概念：倫理、媒體識讀、全球化、哲思 | 以具體例子開場，再帶出抽象概念 |
| 文本結構 | 敘事、說明（時間順序、列舉） | 比較對照、因果 | 議論、多觀點評論 | 加入段落小標與段首摘要句 |
| 題目設計 | DOK 1–2 為主，DOK 3 佔 10–15% | DOK 2 為主，DOK 3 佔 20–25% | DOK 2–3，DOK 3 佔 30% | 題幹使用更短句子；選項由 4 個減為 3 個（可選） |

**支援版撰寫檢核**：同一篇文章的支援版必須保留 (1) 相同主旨 (2) 相同關鍵概念 (3) 可回答同一組核心題目，以確保兩版學生能在課堂上一起討論。

**Lexile 實務**：Lexile 數值可用 Lexile Analyzer（MetaMetrics 官方工具）測量；若無帳號，可先以 Flesch-Kincaid Grade Level 作為粗估，於 `lexile_source` 欄位註記 `estimated`，待取得正式數值後再更新。

---

## 3. 即時回饋與分階段提示（鷹架設計）

### 3.1 四階段提示總架構

| 階段 | 目的 | 呈現方式 | 學生操作 |
| --- | --- | --- | --- |
| 第一階段：方向 | 提醒思考方向或定位文本段落 | 一句話 + 文本段落高亮 | 按「提示 1」 |
| 第二階段：線索 | 提供關鍵字或語法規則 | 關鍵字標記、規則小卡 | 再按「提示 2」 |
| 第三階段：部分解析 | 提供部分推理或範例句 | 排除一個錯誤選項、示範句 | 再按「提示 3」 |
| 第四階段：完整解析 + 變式題 | 完整說明並立即遷移練習 | 完整解析 + 一題同類變式題 | 按「看完整解析」 |

> 提示必須逐階開啟（不能直接跳到第四階段），但每一階段開啟後都可以選擇「我想自己再試一次」，鼓勵學生只取所需的最少協助。

### 3.2 各題型提示範例

**閱讀理解（以 2.2.1 Q2 Inference 為例）**
1. Hint 1: Look at the last sentence of the paragraph. Who are "the critics"?
2. Hint 2: Key words: *ignores the reality*, *digital skills are essential*. The critics think phones can be useful.
3. Hint 3: Option A goes too far—the critics never talk about *all public places*. Now compare B and D.
4. Hint 4（完整解析）: The critics believe digital skills are essential, so they would prefer teaching students to use phones well (B) rather than banning them. D is the opposite of their view.
   *Try a similar one:* "Supporters of phone-free classrooms would most likely agree that ___."

**字彙（語境選詞：fragile）**
1. Hint 1: Read the second half of the sentence: *carry it carefully*. Why do we carry something carefully?
2. Hint 2: Look for a word that means "easy to break."（中文提示：容易碎的）
3. Hint 3: Example: *The old book is fragile; its pages tear easily.*
4. Hint 4: *fragile* = easily broken. *flexible* = can bend; *famous* = well known. 變式題：*Be careful with the ___ eggs.*

**文法（現在完成式：She ___ (live) in Tainan since 2020.）**
1. Hint 1: Find the time words in the sentence.
2. Hint 2: *since* + a point in the past → present perfect: **have/has + p.p.**
3. Hint 3: Example: *I have known him since 2019.* Is the subject *she* singular or plural?
4. Hint 4: Answer: **has lived**. 時間從 2020 年持續到現在，主詞 she 為第三人稱單數，故用 has + p.p.。變式題：*They ___ (study) English for five years.*

**寫作（短文：Should high schools allow phones in class?）**
1. Hint 1: First decide your position: Yes or No? Write it in one sentence.
2. Hint 2: Useful words: *distraction, emergency, focus, research, responsible*. Useful linkers: *First, In addition, However, Therefore*.
3. Hint 3: Sample topic sentence and first reason: *In my opinion, phones should be allowed in class with clear rules. First, students can use them to look up information quickly.*
4. Hint 4: 完整範文（標註結構：主題句／理由一＋例子／理由二＋例子／結論），並提供「仿寫任務」：用範文結構寫另一題 *Should students wear uniforms?*

**聽力（關鍵資訊擷取：What time does the train leave?）**
1. Hint 1: Listen again. Focus on numbers.
2. Hint 2: 重播該句，速度降至 0.75×；提示關鍵字 *departs*。
3. Hint 3: 顯示部分逐字稿：*The train to Kaohsiung departs at ___ fifteen.*
4. Hint 4: 顯示完整逐字稿與答案並說明 *quarter past* 等時間說法，附一題變式題。

### 3.3 提示使用與成績計算

**雙軌分數設計**：成績頁同時顯示「得分」與「獨立度」，並以學習歷程呈現進步，而非只看單次分數。

| 作答情況 | 該題得分（滿分 10） | 獨立度標記 |
| --- | --- | --- |
| 未用提示，第一次答對 | 10 | ★ 獨立完成 |
| 未用提示，第二次答對 | 8 | ☆ 自我修正 |
| 使用提示 1 後答對 | 9 | ◐ 少量協助 |
| 使用提示 2 後答對 | 7 | ◐ 少量協助 |
| 使用提示 3 後答對 | 5 | ◑ 中度協助 |
| 使用提示 4（看完整解析） | 3（完成理解）＋變式題答對再加 3，最高 6 | ● 完整鷹架 |
| 跳過未作答 | 0 | — |

**規則說明**
1. 扣分可累加但設下限：同一題提示扣分＋重試扣分合計最多扣 7 分（保底 3 分），確保「有努力學習」被看見。
2. 「熟練度」（mastery）只採計 **變式題與後續同標籤題目**的獨立答對率，用來判斷是否「需複習」；提示使用不直接拉低熟練度。
3. 老師可在 `classes.json` 中選擇計分模式：
   - `practice`（預設）：上表規則，強調學習。
   - `quiz`：提示停用或僅開放第一階段，用於小考。
   - `no-penalty`：提示不扣分，只記錄次數（適合程度較低班級的起步階段）。
4. 寫作題不以提示扣分；改為記錄使用了哪些鷹架（句型框架、範文），作為老師給予個別回饋的參考。

### 3.4 即時回饋的語氣與內容原則

**三大原則：具體、鼓勵性、可行動**

| 原則 | 不建議 | 建議 |
| --- | --- | --- |
| 具體 | 「錯了。」 | 「這句的主詞 *Each of the students* 是單數，所以動詞要用 *has*。」 |
| 鼓勵性 | 「你又錯了。」 | 「很接近了！你已經找到正確的段落，再看看最後一句。」 |
| 可行動 | 「請再加油。」 | 「試著把 *since* 後面的時間點圈起來，再選一次。」 |

**撰寫規範**
1. 先肯定做對的部分，再指出一個（只指出一個）需要修正的地方。
2. 說明「為什麼」，不只說「是什麼」；答對時也提供一句原因，強化正確理解。
3. 句子簡短：中文回饋每則 ≤ 40 字；英文回饋使用比題目低一級的詞彙。
4. 針對錯誤選項撰寫「誤答診斷回饋」（distractor feedback），例如選 D 時回饋：「D 和批評者的立場相反喔，回到文中看看他們重視什麼。」
5. 回饋語言：支援版預設「中文說明＋英文關鍵詞」；標準版預設英文，可一鍵切換中文。
6. 避免負面圖示（大紅叉、刺耳音效）；使用柔和的琥珀色與「再試一次」字樣。答對使用綠色勾與輕微彈跳動畫。
7. 不比較學生之間的分數；排行榜功能預設關閉。

---

## 4. 通用設計（UDL）與無障礙考量

### 4.1 多元呈現（Multiple Means of Representation）

| 設計項目 | 具體做法 |
| --- | --- |
| 可調字體大小 | 四段：小（16px）／標準（18px）／大（21px）／特大（24px），以 `rem` 為基準整體縮放，不破版 |
| 可調行距 | 1.5／1.75／2.0 三段；閱讀文本預設 1.75 |
| 可選字型 | 系統預設（-apple-system、PingFang TC、Noto Sans TC）／易讀字型（Atkinson Hyperlegible）／讀寫障礙友善字型（OpenDyslexic，英文內容適用） |
| 深色模式 | 跟隨系統（`prefers-color-scheme`）或手動切換；另提供「暖色護眼」模式（米色底、降低藍光） |
| 語音朗讀 | 以 Web Speech API 朗讀題目、選項、文章；可逐句朗讀並同步高亮；語速 0.7×–1.2× |
| 文字與圖示並用 | 所有按鈕＝圖示＋文字（例如 💡 提示、🔊 朗讀）；狀態不只用顏色區分（✓／●／↻ 圖形＋文字） |
| 字彙即時支援 | 點按生字顯示：中文釋義、詞性、例句、發音；老師可在題目中預先標記 `glossary` |
| 視覺組織 | 文章可切換「段落小標」「關鍵句高亮」「心智圖摘要」 |
| 雙語介面 | 介面文字中英切換；預設中文介面 |

### 4.2 多元表達（Multiple Means of Action & Expression）

| 設計項目 | 具體做法 |
| --- | --- |
| 鍵盤操作支援 | 完整 Tab 順序；`1–4` 或 `A–D` 選擇選項；`Enter` 檢查答案；`H` 開啟下一階段提示；`R` 朗讀；`N` 下一題；`Esc` 關閉彈窗；所有焦點有清楚的焦點框（2px 以上、對比 ≥ 3:1） |
| 多種作答方式 | 選擇、拖放（同時提供「點選後再點目標」的非拖放替代）、打字、語音輸入（瀏覽器支援時） |
| 寫作工具 | 句型框架、詞彙庫插入、字數計、自我檢核清單、草稿自動儲存 |
| 可選擇練習節奏 | 「一次一題」或「整頁作答」；可暫停並稍後繼續 |
| 時間設定 | 預設不計時；可開啟「計時挑戰」（學生自選）；老師設定的時限可依學生需求延長 1.5×（由學生在設定中開啟「延長時間」，不需申請） |
| 觸控友善 | 可點區域 ≥ 44×44px；元件間距 ≥ 8px |

### 4.3 多元參與（Multiple Means of Engagement）

| 設計項目 | 具體做法 |
| --- | --- |
| 選擇權 | 學生可選版本（標準／支援／挑戰）、選主題、選練習順序 |
| 目標設定 | 進站時可設定「今天的小目標」（完成 1 組／10 分鐘／複習錯題） |
| 進度可視化 | 單元進度條、連續學習天數、技能成長圖 |
| 低壓力環境 | 預設不公開排名；錯題不顯示紅色大叉；可重做不限次數（練習模式） |
| 主題相關性 | 文章主題貼近高中生生活與高職職群（如餐旅、資訊、商業、機械情境題） |
| 自我反思 | 題組結束後一題反思：「今天最有幫助的提示是？」「下次我想先試試___。」 |
| 微型成就 | 獨立完成徽章、「求助也是能力」徽章（第一次使用提示並最終答對） |

### 4.4 無障礙技術規範（WCAG 2.1 AA）

1. 文字對比 ≥ 4.5:1，大字與圖示 ≥ 3:1（深色模式同樣檢核）。
2. 語意化 HTML：`<main>`、`<nav>`、`<fieldset>`／`<legend>` 包選項組；表單欄位皆有 `<label>`。
3. 即時回饋區使用 `aria-live="polite"`，螢幕閱讀器可讀出結果。
4. 圖片皆有替代文字；裝飾性圖片 `alt=""`。
5. 尊重 `prefers-reduced-motion`：關閉所有非必要動畫。
6. 不依賴顏色傳達唯一資訊；不使用閃爍超過每秒 3 次的元素。
7. 所有設定（字體、行距、模式）存於本機，下次進站自動套用。

---

## 5. 視覺風格

### 5.1 設計語言

簡潔、有質感、色彩溫和、留白充足、圓角元素、柔和陰影與流暢微互動。參考高品質 iOS 網站的「內容優先」原則：一個畫面只突出一個主要動作，其餘元素退居次要。

### 5.2 色彩系統（Design Tokens）

| Token | 淺色模式 | 深色模式 | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#F5F5F7` | `#101114` | 頁面底色 |
| `--surface` | `#FFFFFF` | `#1C1D21` | 卡片、面板 |
| `--surface-2` | `#F0F1F4` | `#26272C` | 次層區塊、輸入框 |
| `--text` | `#1D1D1F` | `#F2F2F4` | 主要文字 |
| `--text-secondary` | `#5E6068` | `#A6A8B0` | 次要文字（對比 ≥ 4.5:1） |
| `--accent` | `#2F6FDE`（沉穩藍） | `#6FA3FF` | 主要按鈕、連結、焦點 |
| `--success` | `#2E9E6A` | `#5CCB94` | 答對、完成 |
| `--warning` | `#C98A1B`（琥珀） | `#F0B85A` | 再試一次、需複習 |
| `--danger` | `#C9483A`（僅少量使用） | `#FF8A7A` | 錯誤操作警示（非答錯） |
| `--skill-reading` | `#5B8DEF` | 同色調提高亮度 | 閱讀技能標籤 |
| `--skill-vocab` | `#E07A5F` | 〃 | 字彙 |
| `--skill-grammar` | `#D9A441` | 〃 | 文法 |
| `--skill-writing` | `#7C6FD6` | 〃 | 寫作 |
| `--skill-listening` | `#3BA7A0` | 〃 | 聽力 |

> 與現有網站銜接：可將現有 `--navy #123b5d`、`--coral #ef765f`、`--yellow #f1c75b` 作為品牌色保留在首頁主視覺；練習頁改用上表較中性的系統色，以降低認知負荷。

### 5.3 字型層級

字型堆疊：`-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang TC", "Noto Sans TC", "Segoe UI", sans-serif`；英文閱讀文本可選 `"Atkinson Hyperlegible"`。

| 層級 | 大小／行高／字重 | 用途 |
| --- | --- | --- |
| Large Title | 34px / 1.2 / 700 | 頁面主標（首頁、成績頁） |
| Title 1 | 28px / 1.25 / 700 | 區塊標題 |
| Title 2 | 22px / 1.3 / 600 | 卡片標題、單元名稱 |
| Headline | 18px / 1.4 / 600 | 題目題幹 |
| Body | 17–18px / 1.6 / 400 | 一般內文 |
| Reading | 18–20px / 1.75 / 400 | 閱讀文章（最大行寬 68 字元） |
| Callout | 15px / 1.5 / 500 | 提示、回饋 |
| Caption | 13px / 1.4 / 500 | 標籤、輔助說明（不低於 13px） |

### 5.4 元件風格

| 元件 | 規格 |
| --- | --- |
| 卡片 | 圓角 20px；陰影 `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)`；內距 20–24px |
| 主要按鈕 | 圓角 14px（或膠囊形 999px）；高度 48px；`--accent` 底白字；按下縮放 0.97 |
| 次要按鈕 | 透明底 + 1px 邊框或 `--surface-2` 底 |
| 選項按鈕 | 整列可點、圓角 14px、左側字母圓點 A–D；選取時邊框 2px `--accent`；答對淡綠底 + ✓；答錯淡琥珀底 + ↻ |
| 分段控制項 | iOS 風格 segmented control，用於年級／版本切換 |
| 進度環／進度條 | 細線（4–6px）圓頭；動畫 600ms ease-out |
| 提示抽屜 | 從底部滑出（行動版）或右側面板（桌面版）；四個階段以步驟點顯示 |
| 毛玻璃導覽列 | `backdrop-filter: blur(20px)`、半透明底色 |
| 徽章 | 膠囊形、Caption 字級、技能色 12% 透明度底 |

### 5.5 微互動與動效

- 標準曲線：`cubic-bezier(.23,1,.32,1)`；時長 150–300ms（狀態變化）、400–600ms（進度動畫）。
- 答對：勾號描繪動畫＋卡片輕微上彈 4px；答錯：選項左右輕晃 2 次（幅度 4px），不使用刺耳音效（音效預設關閉）。
- 頁面切換：淡入＋上移 8px。
- 所有動效在 `prefers-reduced-motion: reduce` 時停用或改為淡入。

---

## 6. 交付內容

### 6.1 網站頁面草圖的文字描述

以下以「桌面版（≥ 1024px）／行動版（< 640px）」描述，版面區塊由上到下編號。

#### 頁面 A：首頁 `index.html`

| 區塊 | 主要元件 | 互動行為 |
| --- | --- | --- |
| A1 頂部導覽列（毛玻璃、固定） | 左：Logo；中：首頁／單元／學習紀錄；右：⚙ 閱讀設定、班級徽章（如「10A」） | ⚙ 開啟設定面板；班級徽章點擊可更換班級；行動版中間選單收進底部分頁列（Tab Bar） |
| A2 歡迎區 | Large Title「Good afternoon, let's practice!」＋一句中文說明；主要按鈕「繼續上次練習 →」；次要按鈕「選擇班級／年級」 | 無紀錄時主要按鈕改為「開始第一次練習」 |
| A3 今日小目標 | 三個可選膠囊：完成 1 組／練 10 分鐘／複習錯題 | 選擇後存本機，進度在 A4 顯示 |
| A4 近期進度摘要（三張小卡並排，行動版改橫向滑動） | 本週練習次數、完成單元數、連續天數；第四張「最需要複習：Inference」 | 點「最需要複習」直接開啟對應變式題組 |
| A5 今日推薦練習卡 | 單元名、技能徽章、預估時間、版本建議 | 點擊進入練習頁 |
| A6 使用說明（可收合） | 三步驟圖示：選單元 → 練習與提示 → 看回饋 | 首次進站自動展開，之後預設收合 |
| A7 頁尾 | 隱私說明（「紀錄只存在你的裝置」）、老師專區入口 | — |

#### 頁面 B：班級／年級選擇

| 區塊 | 主要元件 | 互動行為 |
| --- | --- | --- |
| B1 標題 | 「選擇你的班級或年級」 | — |
| B2 班級代碼輸入 | 輸入框（placeholder：例如 10A-2026）＋「加入」按鈕＋「掃描 QR Code」 | 代碼有效：顯示成功卡片（班級名、老師、課程）；無效：琥珀色提示「找不到這個代碼，請確認大小寫或詢問老師」 |
| B3 年級卡片（三張） | 十年級／十一年級／十二年級；每卡顯示課程數、文章長度範圍 | 點選後卡片放大選中、展開 B4 |
| B4 課程分段控制項 | 例如「必修英文｜閱讀寫作選修｜高職英文」 | 切換即時更新下方課程說明 |
| B5 確認按鈕 | 「進入課程」 | 進入頁面 C |

#### 頁面 C：課程單元列表

| 區塊 | 主要元件 | 互動行為 |
| --- | --- | --- |
| C1 課程頁首 | 課程名、年級、老師名；右側整體完成度環形圖 | 環形圖載入時動畫填滿 |
| C2 篩選列 | 技能膠囊（多選）、難度、狀態下拉、標籤搜尋框 | 即時篩選；空結果顯示「目前沒有符合的單元，試試清除篩選」 |
| C3 單元卡片格（桌面 3 欄、平板 2 欄、行動 1 欄） | 單元編號、主題、題組數、時間、進度條、狀態徽章、截止日 | 點卡片展開題組清單（手風琴式）；🔒 單元顯示開放日期 |
| C4 題組清單（展開後） | 每列：技能圖示＋名稱＋DOK 標記＋完成狀態＋「標準版／支援版」切換 | 系統預選版本並附說明「依你上次的表現推薦」；點「開始」進入練習頁 |

#### 頁面 D：練習頁 `practice.html`

**桌面版**：左右兩欄（閱讀／聽力題）— 左欄文本 60%，右欄題目 40%；字彙、文法題為置中單欄（最大寬 720px）。
**行動版**：文本與題目上下排列；文本可收合為「查看文章」抽屜。

| 區塊 | 主要元件 | 互動行為 |
| --- | --- | --- |
| D1 頂部工具列 | ← 返回、題組名稱、進度（3／8）細進度條、計時器（預設隱藏）、🔊 朗讀、Aa 閱讀設定、⚑ 標記 | 離開時若未完成，提示「進度已自動儲存」 |
| D2 文本區（閱讀／聽力） | 文章（段落編號）、生字底線、版本切換；聽力題為播放器（播放、重播、語速 0.75×/1×） | 點生字彈出詞彙卡；提示 1 啟動時對應段落淡黃高亮並自動捲動 |
| D3 題目卡 | 題號、技能與 DOK 徽章、題幹、作答區 | 選項可點選或鍵盤 A–D；寫作題為文字區＋字數計＋句型框架側欄 |
| D4 動作列 | 主要按鈕「檢查答案」；次要「💡 提示（0/4）」「稍後再做」 | 未作答時「檢查答案」為停用狀態並說明原因 |
| D5 回饋區（`aria-live`） | 答對：綠色卡片＋原因一句＋「下一題」；答錯：琥珀卡片＋診斷回饋＋「再試一次」「需要提示」 | 卡片由下滑入 200ms |
| D6 提示抽屜 | 四個步驟點；目前階段內容；「我想自己再試一次」「下一個提示」 | 每開啟一階段，步驟點填色，D4 的提示計數更新；第四階段顯示變式題 |
| D7 題組小結（全部完成後） | 正確率、獨立完成題數、提示使用、用時；反思問題一題；「看完整報告」「回單元列表」「再練一組類似題」 | 結果數字以計數動畫呈現 |

#### 頁面 E：成績回饋與學習紀錄 `report.html`

| 區塊 | 主要元件 | 互動行為 |
| --- | --- | --- |
| E1 本次成績卡 | 大數字分數、正確率、獨立完成率、用時 | 切換「本次／本週／全部」 |
| E2 技能概況 | 五技能長條圖（含熟練度百分比與文字標示） | 點長條進入該技能的子技能細項 |
| E3 錯題分析 | 依子技能分組的錯題列表：題目摘要、我的答案、正確答案、使用提示階段 | 每題可「重看解析」；每組可「練習 3 題變式題」 |
| E4 學習歷程時間軸 | 近 4 週每日練習量（點陣或長條）、提示使用趨勢折線 | 懸停／聚焦顯示當日細節 |
| E5 建議下一步 | 1–3 張行動卡（具體題組與理由） | 點擊直接開始 |
| E6 匯出 | 「下載學習報告（PDF）」「產生學習紀錄碼」「下載 JSON」 | 紀錄碼可複製或顯示為 QR Code 交給老師 |

#### 頁面 F：設定面板（全站共用彈出面板）

字體大小（4 段滑桿）、行距（3 段）、字型（3 選 1）、外觀（淺色／深色／暖色／跟隨系統）、朗讀語速與口音、回饋語言（中文／英文）、練習節奏（一次一題／整頁）、計時（關／開／延長 1.5×）、動畫（標準／減少）、鍵盤快捷鍵說明。所有設定即時預覽，存於本機。

#### 頁面 G：老師工具 `teacher.html`（無需登入的本機工具）

| 區塊 | 主要元件 | 互動行為 |
| --- | --- | --- |
| G1 內容匯入 | 拖放 CSV／JSON 檔，或貼上試算表內容 | 自動驗證欄位，列出錯誤（例如「第 12 列缺少 answer」） |
| G2 題目預覽 | 以學生視角預覽題目與四階段提示，可切換標準／支援版 | 一鍵切換深色模式與大字體檢查可讀性 |
| G3 班級發布設定產生器 | 表單：班級代碼、課程、開放單元、日期、計分模式、預設版本 | 產生 `classes.json` 片段供複製貼上或下載 |
| G4 學習紀錄彙整 | 貼上多位學生的學習紀錄碼 | 產生全班錯題熱點表與 CSV 下載 |

---

### 6.2 資料庫與內容欄位的範例結構

> 第一版以 JSON 檔實作（每張「表」對應一個 JSON 檔或陣列）；第二版若改用資料庫，可直接沿用相同欄位作為資料表結構。

#### 表 1：`courses`（課程）

| 欄位 | 型別 | 必填 | 說明 | 範例 |
| --- | --- | --- | --- | --- |
| `course_id` | string | ✓ | 唯一代碼 | `g10-core-a` |
| `title` | string | ✓ | 課程名稱 | `十年級必修英文（上）` |
| `grade` | int[] | ✓ | 適用年級 | `[10]` |
| `track` | enum | ✓ | `general`（普高）／`vocational`（高職） | `general` |
| `description` | string |  | 課程說明 | `以生活議題為主的閱讀與寫作` |
| `unit_ids` | string[] | ✓* | 依序列出單元（與 `filter` 擇一） | `["u01","u02"]` |
| `filter` | object | ✓* | 以條件組成課程 | `{"grade":11,"tags":["#textbook-L5"]}` |
| `default_level` | enum |  | `standard`／`support` | `standard` |
| `version` | string | ✓ | 內容版本 | `2026.09` |

#### 表 2：`units`（單元）

| 欄位 | 型別 | 必填 | 說明 | 範例 |
| --- | --- | --- | --- | --- |
| `unit_id` | string | ✓ | 單元代碼 | `u01` |
| `course_id` | string | ✓ | 所屬課程 | `g10-core-a` |
| `order` | int | ✓ | 排序 | `1` |
| `title` | string | ✓ | 單元名稱（英文） | `Who Am I Online?` |
| `topic` | string | ✓ | 主題 | `identity` |
| `objectives` | string[] | ✓ | 學習目標（英文 can-do） | `["I can identify the main idea of an article."]` |
| `estimated_minutes` | int |  | 預估時間 | `40` |
| `set_ids` | string[] | ✓ | 題組清單 | `["u01-r1","u01-v1"]` |
| `tags` | string[] |  | 標籤 | `["#textbook-L1"]` |

#### 表 3：`passages`（閱讀／聽力文本）

| 欄位 | 型別 | 必填 | 說明 | 範例 |
| --- | --- | --- | --- | --- |
| `passage_id` | string | ✓ | 文本代碼 | `p-u01-01` |
| `title` | string | ✓ | 標題 | `Phones in the Classroom` |
| `variants` | object[] | ✓ | 各版本文本（見下） | — |
| `variants[].level` | enum | ✓ | `standard`／`support`／`challenge` | `support` |
| `variants[].text` | string | ✓ | 文本（段落以 `\n\n` 分隔） | — |
| `variants[].lexile` | int | ✓ | Lexile 值 | `850` |
| `variants[].lexile_source` | enum |  | `analyzer`／`estimated` | `estimated` |
| `variants[].word_count` | int |  | 字數 | `240` |
| `glossary` | object[] |  | 生字卡：`word`, `pos`, `zh`, `example` | `{"word":"fragment","pos":"v.","zh":"使分裂","example":"..."}` |
| `audio_url` | string |  | 音檔（聽力） | `content/audio/u01-l1.mp3` |
| `transcript` | string |  | 逐字稿（TTS 與讀作聽模式） | — |
| `topic` | string | ✓ | 主題 | `technology` |
| `abstraction` | enum |  | `concrete`／`social`／`abstract` | `social` |

#### 表 4：`question_sets`（題組）

| 欄位 | 型別 | 必填 | 說明 | 範例 |
| --- | --- | --- | --- | --- |
| `set_id` | string | ✓ | 題組代碼 | `u01-r1` |
| `unit_id` | string | ✓ | 所屬單元 | `u01` |
| `skill` | enum | ✓ | 技能 | `reading` |
| `title` | string | ✓ | 名稱 | `Reading 1: Phones in the Classroom` |
| `passage_id` | string |  | 綁定文本 | `p-u01-01` |
| `question_ids` | string[] | ✓ | 題目清單 | `["q-0001","q-0002"]` |
| `scoring_mode` | enum |  | `practice`／`quiz`／`no-penalty` | `practice` |

#### 表 5：`questions`（題目，核心表）

| 欄位 | 型別 | 必填 | 說明 | 範例 |
| --- | --- | --- | --- | --- |
| `question_id` | string | ✓ | 題目代碼 | `q-0002` |
| `set_id` | string | ✓ | 所屬題組 | `u01-r1` |
| `unit_id` | string | ✓ | 所屬單元 | `u01` |
| `skill` | enum | ✓ | `reading`／`vocabulary`／`grammar`／`writing`／`listening` | `reading` |
| `sub_skill` | string | ✓ | 子技能 | `inference` |
| `type` | enum | ✓ | `single-choice`／`multi-choice`／`fill-blank`／`reorder`／`match`／`short-answer`／`essay` | `single-choice` |
| `stem` | string | ✓ | 題幹（英文） | `Which statement would the critics most likely agree with?` |
| `stem_support` | string |  | 支援版題幹（較短句） | `What do the critics think?` |
| `options` | object[] | 選擇題 ✓ | 選項：`key`, `text`, `feedback`（誤答診斷） | 見下方 JSON |
| `answer` | string／string[] | ✓（寫作除外） | 正確答案；填空可列多個可接受答案 | `"B"`；`["has lived"]` |
| `answer_rules` | object |  | 判分規則：是否忽略大小寫、標點 | `{"ignore_case":true}` |
| `explanation` | string | ✓ | 完整解析（中英皆可） | `The critics believe digital skills...` |
| `hints` | object[4] | ✓ | 四階段提示：`level`, `text`, `action` | 見下方 JSON |
| `hints[].action` | enum |  | 提示觸發的介面動作：`highlight-paragraph`／`highlight-words`／`eliminate-option`／`show-example` | `highlight-paragraph` |
| `variant_question_id` | string |  | 第四階段變式題 | `q-0002v` |
| `rubric_id` | string | 寫作 ✓ | 評分規準 | `rb-opinion-4x4` |
| `scaffolds` | object |  | 寫作鷹架：`frames`, `word_bank`, `model_text`, `checklist` | — |
| `grade` | int[] | ✓ | 年級 | `[10,11]` |
| `difficulty` | enum | ✓ | `foundation`／`standard`／`challenge` | `standard` |
| `level_available` | string[] |  | 提供的版本 | `["standard","support"]` |
| `lexile` | int |  | 依附文本之 Lexile（閱讀／聽力） | `1000` |
| `bloom` | enum | ✓ | `remember`／`understand`／`apply`／`analyze`／`evaluate`／`create` | `analyze` |
| `dok` | int | ✓ | 1／2／3 | `3` |
| `paragraph_ref` | int |  | 答案依據段落 | `1` |
| `points` | int |  | 配分（預設 10） | `10` |
| `tags` | string[] |  | 標籤 | `["#exam-gsat"]` |
| `author` | string |  | 命題者 | `Ms. Wang` |
| `status` | enum | ✓ | `draft`／`review`／`published` | `published` |
| `updated_at` | date |  | 更新日期 | `2026-11-09` |

**單題 JSON 範例**

```json
{
  "question_id": "q-0002",
  "set_id": "u01-r1",
  "unit_id": "u01",
  "skill": "reading",
  "sub_skill": "inference",
  "type": "single-choice",
  "stem": "Based on the passage, which statement would the critics most likely agree with?",
  "stem_support": "What do the critics think schools should do?",
  "options": [
    { "key": "A", "text": "Phones should be banned in all public places.", "feedback": "The critics never talk about all public places. This goes too far." },
    { "key": "B", "text": "Schools should teach students to use phones responsibly.", "feedback": "" },
    { "key": "C", "text": "Notifications improve students' concentration.", "feedback": "The passage says notifications fragment attention, not improve it." },
    { "key": "D", "text": "Digital skills are less important than reading skills.", "feedback": "This is the opposite of the critics' view. Look at the word 'essential'." }
  ],
  "answer": "B",
  "explanation": "The critics say digital skills are essential for future careers, so they would prefer teaching responsible use (B) instead of banning phones.",
  "hints": [
    { "level": 1, "text": "Look at the last sentence of paragraph 1. Who are \"the critics\"?", "action": "highlight-paragraph" },
    { "level": 2, "text": "Key words: \"ignores the reality\" and \"digital skills are essential\".", "action": "highlight-words" },
    { "level": 3, "text": "Option A goes too far. Now compare B and D.", "action": "eliminate-option" },
    { "level": 4, "text": "The critics value digital skills, so they would choose teaching over banning. Try the similar question below.", "action": "show-example" }
  ],
  "variant_question_id": "q-0002v",
  "grade": [10],
  "difficulty": "standard",
  "level_available": ["standard", "support"],
  "lexile": 1000,
  "bloom": "analyze",
  "dok": 3,
  "paragraph_ref": 1,
  "points": 10,
  "tags": ["#topic-technology", "#exam-gsat"],
  "status": "published",
  "updated_at": "2026-11-09"
}
```

#### 表 6：`rubrics`（寫作評分規準）

| 欄位 | 說明 | 範例 |
| --- | --- | --- |
| `rubric_id` | 規準代碼 | `rb-opinion-4x4` |
| `criteria` | 向度陣列：`name`, `descriptors`（1–4 分描述） | `Content`: 4 = clear position with two well-supported reasons… |
| `student_checklist` | 學生自評清單 | `["I wrote a topic sentence.", "I gave two reasons."]` |

#### 表 7：`classes`（班級發布設定）

| 欄位 | 型別 | 說明 | 範例 |
| --- | --- | --- | --- |
| `class_code` | string | 班級代碼（學生輸入） | `10A-2026` |
| `class_name` | string | 顯示名稱 | `高一甲班` |
| `teacher` | string | 老師顯示名稱 | `王老師` |
| `course_id` | string | 使用課程 | `g10-core-a` |
| `released_units` | object[] | `unit_id`, `open_date`, `due_date` | `{"unit_id":"u01","open_date":"2026-09-01","due_date":"2026-09-15"}` |
| `scoring_mode` | enum | 預設計分模式 | `practice` |
| `default_level` | enum | 預設版本 | `support` |
| `allow_level_switch` | bool | 學生是否可自行切換版本 | `true` |
| `timer` | object | `enabled`, `minutes_per_set`, `allow_extension` | `{"enabled":false}` |
| `hint_policy` | object | `max_level`（quiz 模式可設 1） | `{"max_level":4}` |

#### 表 8：`attempts`（作答紀錄，存於學生本機／第二版存資料庫）

| 欄位 | 說明 | 範例 |
| --- | --- | --- |
| `attempt_id` | 作答代碼 | `a-20261109-0012` |
| `student_alias` | 學生自訂暱稱或座號（非真實姓名） | `10A-23` |
| `class_code` | 班級 | `10A-2026` |
| `question_id` | 題目 | `q-0002` |
| `level_used` | 使用版本 | `support` |
| `response` | 學生答案 | `"D"` → `"B"` |
| `tries` | 嘗試次數 | `2` |
| `hint_level_reached` | 開啟到第幾階段提示 | `2` |
| `is_correct` | 最終是否答對 | `true` |
| `score` | 該題得分 | `7` |
| `independence` | `independent`／`self-corrected`／`light`／`moderate`／`full` | `light` |
| `time_spent_sec` | 用時（秒） | `95` |
| `flagged` | 學生標記不確定 | `false` |
| `timestamp` | 時間 | `2026-11-09T14:32:10+08:00` |

#### 表 9：`tags`（標籤字典）

| 欄位 | 說明 | 範例 |
| --- | --- | --- |
| `tag` | 標籤 | `#track-vocational` |
| `category` | 類別：`topic`／`textbook`／`exam`／`track`／`skill` | `track` |
| `label_zh` | 中文顯示名稱 | `高職適用` |

#### 資料關聯圖

```
courses 1──* units 1──* question_sets 1──* questions *──1 passages
                                               │
                                               ├──? rubrics（寫作）
                                               └──? questions（variant 變式題）
classes *──1 courses
attempts *──1 questions；attempts *──1 classes
tags ── 透過 tags 欄位連結 courses / units / questions / passages
```

---

### 6.3 老師如何新增課程與班級內容（操作說明）

> 提供兩種方式：**方式 A（推薦，非技術背景）**以 Google 試算表編寫，經老師工具轉成 JSON；**方式 B** 直接在 GitHub 網頁編輯 JSON。兩者結果相同。

#### 步驟 1：規劃課程

1. 決定課程代碼（命名規則：`年級-課程類型-版本`，例如 `g11-read-write-a`、`g10-voc-b`）。
2. 列出單元（建議每學期 6–10 個單元），每單元決定主題與 2–3 條英文 can-do 學習目標。
3. 為每單元規劃題組：建議至少「閱讀 1 組、字彙 1 組、文法 1 組、寫作 1 組」，聽力視資源加入。
4. 對照第 2 節，確認每組題目的布魯姆層次與 DOK 分佈（例如十年級 DOK 3 佔 10–15%）。

#### 步驟 2：建立課程檔

- **方式 A**：複製「課程內容範本」試算表（內含 `courses`、`units`、`passages`、`questions`、`classes` 五個工作表，欄位與 6.2 相同，並有下拉選單限制 `skill`、`bloom`、`dok`、`difficulty` 的值）。在 `courses` 工作表填入一列新課程。
- **方式 B**：在 GitHub repo 進入 `content/courses/`，點 **Add file → Create new file**，檔名輸入 `g11-read-write-a/course.json`，複製 `docs/sample-content/unit-sample.json` 中的 `course` 區塊修改後 **Commit changes**。
- 最後在 `content/catalog.json` 加入一行課程代碼，讓網站找得到它。

#### 步驟 3：新增文本與題目（匯入題目）

1. **撰寫文本**：在 `passages` 填入標準版文本；再撰寫支援版（依 2.3 節：句子拆短、生字率 ≤ 2%、縮短 30–40%）。
2. **測量 Lexile**：以 Lexile Analyzer 測量並填入 `lexile`；無法測量時填估計值並將 `lexile_source` 設為 `estimated`。確認落在年級範圍（十年級標準版 900L–1100L、支援版 750L–1000L，以此類推）。
3. **撰寫題目**：每題至少填寫必填欄位：`question_id`、`skill`、`sub_skill`、`type`、`stem`、`options`、`answer`、`explanation`、四階段 `hints`、`grade`、`difficulty`、`bloom`、`dok`。
4. **撰寫誤答回饋**：每個錯誤選項寫一句「具體＋鼓勵＋可行動」的回饋。
5. **建立變式題**：為重要題目建立一題變式題（`question_id` 加 `v`，如 `q-0002v`），並在原題 `variant_question_id` 填入。
6. **匯入**：
   - 方式 A：試算表 **檔案 → 下載 → CSV**（每個工作表各一檔）→ 開啟網站 `teacher.html` → 拖放 CSV → 工具自動驗證並轉成 JSON → 下載 `unit-xx.json`。
   - 方式 B：直接在 `content/courses/<課程>/units/` 新增或編輯 JSON 檔。
7. **驗證**：在 `teacher.html` 的「題目預覽」逐題檢查：答案正確、提示由淺到深、支援版可切換、深色模式與大字體下版面正常。驗證工具會列出缺漏欄位與格式錯誤，全部修正後才進入下一步。

#### 步驟 4：設定年級與難度

1. 在每題設定 `grade`（可多選，例如同一題適用 10、11 年級）。
2. 設定 `difficulty`：基礎（foundation）／標準（standard）／挑戰（challenge）。建議比例：基礎 30%、標準 50%、挑戰 20%；高職班可調整為 45%／45%／10%。
3. 設定 `level_available`，確認哪些題目有支援版。
4. 加上標籤：教科書課次（`#textbook-...`）、考試類型（`#exam-gsat`／`#exam-tvee`）、適用群組（`#track-vocational`）。
5. 將確認完成的題目 `status` 改為 `published`（`draft`／`review` 的題目不會出現在學生端）。

#### 步驟 5：上傳到網站

1. 方式 A：在 GitHub repo 的 `content/courses/<課程>/units/` 點 **Add file → Upload files**，拖入下載的 JSON 檔 → **Commit changes**。
2. 方式 B：已於步驟 3 完成。
3. 等待 1–5 分鐘，GitHub Pages 自動更新。可在 repo 的 **Actions** 分頁查看部署是否成功（綠色勾）。

#### 步驟 6：建立班級並發布給學生

1. 開啟 `teacher.html` →「班級發布設定產生器」。
2. 填寫：班級代碼（例如 `11B-2026`，建議「年級班別-學年」，避免使用學生姓名）、班級名稱、使用課程、要開放的單元與開放／截止日期、計分模式（練習／小考／不扣分）、預設版本（標準／支援）、是否允許學生切換版本、計時設定。
3. 按「產生設定」→ 複製產生的 JSON 片段 → 在 GitHub 編輯 `content/classes.json`，貼到陣列中 → **Commit changes**。
4. 發布給學生：工具會產生
   - 專屬連結：`https://hanhaofurry.github.io/?class=11B-2026`
   - QR Code（可投影或貼在 Google Classroom）
   - 班級代碼（學生手動輸入用）
5. 自己用手機掃 QR Code，以學生身分完整試做一個題組，確認流程無誤。

#### 步驟 7：追蹤學習與更新內容

1. **收集紀錄（第一版）**：請學生在成績頁按「產生學習紀錄碼」並繳交到 Google Classroom 或 Google 表單；老師貼入 `teacher.html` 的「學習紀錄彙整」，即可看到全班錯題熱點與技能分佈，並下載 CSV。
2. **開放新單元**：只要編輯 `classes.json` 的 `released_units`，新增單元與日期即可；不需改動任何程式。
3. **兩個班級不同進度**：建立兩筆 `classes` 設定，指向同一課程但開放不同單元。
4. **同一題庫跨年級使用**：在新課程的 `filter` 寫入條件（例如 `{"grade": 11, "topic": "environment"}`），即可自動組成新課程。
5. **修正題目**：直接修改該題 JSON 並 commit；建議同步更新 `updated_at`，舊作答紀錄不受影響。
6. **學期結束**：把 `classes.json` 中的舊班級加上 `"archived": true`，學生端即不再顯示，內容仍保留供下學年沿用。

---

## 7. 分期開發建議與驗收清單

### 7.1 分期

| 期別 | 範圍 | 說明 |
| --- | --- | --- |
| 第一期（MVP） | 首頁、班級選擇、單元列表、練習頁（單選／填空）、四階段提示、本機紀錄、設定面板 | 純前端，GitHub Pages 即可運作 |
| 第二期 | 寫作題（鷹架與自評）、聽力（TTS＋讀作聽模式）、成績頁圖表、老師工具（匯入驗證、班級設定產生器） | 仍為純前端 |
| 第三期 | 雲端紀錄（Firebase／Supabase 或 Google Apps Script）、老師儀表板、寫作 AI 回饋（需老師審閱設定） | 需處理個資與家長同意 |

### 7.2 驗收清單

- [ ] 只改 `content/` 資料夾即可新增課程、單元、班級，無需修改程式。
- [ ] 每題皆有四階段提示、完整解析，選擇題每個錯誤選項皆有誤答回饋。
- [ ] 每篇閱讀標準版 Lexile 落在年級範圍；支援版低 100L–150L。
- [ ] 每題皆有 `bloom` 與 `dok` 標註，且分佈符合年級建議。
- [ ] 全站可只用鍵盤完成一個題組。
- [ ] 字體放大至特大、行距 2.0、深色模式下版面不破、不需水平捲動。
- [ ] 螢幕閱讀器（VoiceOver／NVDA）可讀出題目、選項與回饋。
- [ ] 文字對比符合 WCAG 2.1 AA。
- [ ] `prefers-reduced-motion` 時動畫停用。
- [ ] 無音訊時，聽力題可用 TTS 或讀作聽模式完成。
- [ ] 不蒐集學生真實姓名；隱私說明清楚可見。
