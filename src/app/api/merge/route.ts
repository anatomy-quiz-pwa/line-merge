import { NextResponse } from "next/server";
import "server-only";
import { compareTwoStrings } from "string-similarity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RosterRow = { name: string; title: string; seniority: string; };
type TopicRow  = { date: string; topic: string; };
type MergedRow = {
  name: string;
  title: string;
  seniority: string;
  question: string;
  date: string;
  topic: string;
  matchScore: number;
};

function normalize(s: string) {
  return s.replace(/\s+/g," ").trim();
}

function parseDate(line: string): string {
  const m = line.match(/(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\s+\d{1,2}:\d{2}/);
  if (!m) return "";
  const d = m[1].replace(/-/g,"/");
  const parts = d.split("/");
  const y = parts[0], mo = parts[1].padStart(2,"0"), da = parts[2].padStart(2,"0");
  return `${y}/${mo}/${da}`;
}

function fromParensIdentity(s: string): { title: string; seniority: string } | null {
  const mm = s.match(/([^\s\(\)（）]{2,10})[（(]([^()（）]{1,12})[)）]/);
  if (!mm) return null;
  const title = mm[1].trim();
  const seniority = mm[2].trim();
  if (!/年|^\d+\s*~\s*\d+/.test(seniority)) return { title, seniority: "" };
  return { title, seniority };
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file   = form.get("file") as File | null;       // LINE .txt
  const roster = JSON.parse(String(form.get("roster") || "[]")) as RosterRow[];
  const topics = JSON.parse(String(form.get("topics") || "[]")) as TopicRow[];

  if (!file)   return NextResponse.json({ error: "缺少 LINE 對話 .txt" }, { status: 400 });
  if (!roster || roster.length===0) return NextResponse.json({ error: "缺少名單" }, { status: 400 });
  if (!topics || topics.length===0) return NextResponse.json({ error: "缺少主題對照表" }, { status: 400 });

  const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
  const lines = text.split(/\r?\n/).map(normalize).filter(Boolean);

  const dateToTopic = new Map<string,string>();
  for (const t of topics) if (!dateToTopic.has(t.date)) dateToTopic.set(t.date, t.topic);

  const names = roster.map(r=>r.name);
  const got = new Map<string, { question: string; date: string; score: number }>();

  for (const line of lines) {
    if (/(加入聊天|已收回訊息|變更了聊天室圖片|歡迎您參加|請您將顯示名稱|記事本|直播|Zoom|https?:\/\/)/i.test(line)) continue;

    const m = line.match(/^(.{1,30}?)[：:]\s*(.*)$/) || line.match(/^(.{1,30})\s+(.*)$/);
    if (!m) continue;
    const speaker = m[1]?.trim();
    const content = (m[2]||"").trim();
    if (!speaker || !content) continue;
    if (!/[?？]/.test(content)) continue;

    const date = parseDate(line); // 可能為空
    let matchedName = names.find(n => n === speaker);
    let score = 1;
    if (!matchedName) {
      let bestScore = 0; let bestName = "";
      for (const n of names) {
        const s = compareTwoStrings(speaker, n);
        if (s > bestScore) { bestScore = s; bestName = n; }
      }
      if (bestScore >= 0.86) { matchedName = bestName; score = bestScore; }
    }
    if (matchedName && !got.has(matchedName)) {
      got.set(matchedName, { question: content, date, score });
    }
  }

  const out: MergedRow[] = roster.map(r => {
    const found = got.get(r.name);
    const date  = found?.date || "";
    const topic = date ? (dateToTopic.get(date) || "") : "";
    return {
      name: r.name,
      title: r.title,
      seniority: r.seniority,
      question: found?.question || "",
      date, topic,
      matchScore: found?.score ?? 0
    };
  });

  const missingNames = new Set(out.filter(x=>!x.question).map(x=>x.name));
  if (missingNames.size > 0) {
    for (const line of lines) {
      const m = line.match(/^(.{1,30}?)[：:]\s*(.*)$/) || line.match(/^(.{1,30})\s+(.*)$/);
      if (!m) continue;
      const speaker = m[1]?.trim();
      const content = (m[2]||"").trim();
      if (!/[?？]/.test(content)) continue;

      let bestName = "", best = 0;
      for (const nm of missingNames) {
        const s = compareTwoStrings(speaker, nm);
        if (s > best) { best = s; bestName = nm; }
      }
      if (best >= 0.86) {
        const idx = out.findIndex(x=>x.name===bestName && !x.question);
        if (idx>=0) {
          const date = parseDate(line);
          const topic = date ? (dateToTopic.get(date) || "") : "";
          out[idx].question = content;
          out[idx].date = date;
          out[idx].topic = topic;
          out[idx].matchScore = best;
        }
      }
    }
  }

  for (const row of out) {
    if ((!row.title || !row.seniority) && row.question) {
      const guess = fromParensIdentity(row.question);
      if (guess) {
        row.title = row.title || guess.title;
        row.seniority = row.seniority || guess.seniority;
      }
    }
  }

  return NextResponse.json({ rows: out });
}
