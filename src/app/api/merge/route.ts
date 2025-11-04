import { NextResponse } from "next/server";
import "server-only";

// 簡單的字符串相似度計算（基於 Dice coefficient）
function compareTwoStrings(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return 0;
  
  const pairs1 = getBigrams(str1);
  const pairs2 = getBigrams(str2);
  const intersection = pairs1.filter(pair => pairs2.includes(pair));
  
  return (2 * intersection.length) / (pairs1.length + pairs2.length);
}

function getBigrams(str: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.slice(i, i + 2));
  }
  return bigrams;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RosterRow = { name: string; title: string; seniority: string; };
type MergedRow = { name: string; title: string; seniority: string; question: string; matchScore: number };

function normalize(s: string) {
  return s.replace(/\s+/g," ").trim();
}

// 從 txt 中，為每個「名單姓名」找到第一則包含 ? 或 ？ 的訊息
// 規則：行文字若以姓名開頭（或 fuzzy 相似度>0.85）→ 後面整段當他說的話；擷取第一條含問號的
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const rosterJson = form.get("roster") as string | null;
    if (!file || !rosterJson) {
      return NextResponse.json({ error: "缺少檔案或名單" }, { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let roster: RosterRow[];
    try {
      roster = JSON.parse(rosterJson);
    } catch (parseError) {
      return NextResponse.json({ error: "名單格式錯誤" }, { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const text = Buffer.from(await (file as File).arrayBuffer()).toString("utf-8");
    const lines = text.split(/\r?\n/).map(normalize).filter(Boolean);

    // 快速索引：姓名清單
    const names = roster.map(r=>r.name);

    // 收集每人第一則帶問號的訊息
    const got = new Map<string, string>();

    for (const line of lines) {
      // 排除明顯的系統訊息
      if (/(加入聊天|已收回訊息|變更了聊天室圖片|歡迎您參加|請您將顯示名稱|已將.*強制退出|已分享記事本)/.test(line)) continue;

      // 嘗試從行首抓「說話者」
      // 例：張小明 想請問…   /   張小明：…   /   張小明 影片
      const m = line.match(/^(.{1,20}?)[：:]\s*(.*)$/) || line.match(/^(.{1,20})\s+(.*)$/);
      if (!m) continue;
      const speaker = m[1]?.trim();
      const content = (m[2]||"").trim();
      if (!speaker || !content) continue;
      if (!/[?？]/.test(content)) continue; // 只取問句

      // 完全比對姓名
      let matchedName = names.find(n => n === speaker);

      // 不行就 fuzzy
      if (!matchedName) {
        let bestScore = 0; let bestName = "";
        for (const n of names) {
          const score = compareTwoStrings(speaker, n);
          if (score > bestScore) { bestScore = score; bestName = n; }
        }
        if (bestScore >= 0.85) matchedName = bestName;
      }

      if (matchedName && !got.has(matchedName)) {
        got.set(matchedName, content);
      }
    }

    const rows: MergedRow[] = roster.map(r => ({
      name: r.name,
      title: r.title,
      seniority: r.seniority,
      question: got.get(r.name) || "",
      matchScore: got.has(r.name) ? 1 : 0
    }));

    return NextResponse.json({ rows }, {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("合併錯誤:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? `合併失敗: ${error.message}` 
          : "未知錯誤" 
      },
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

