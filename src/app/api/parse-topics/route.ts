import { NextResponse } from "next/server";
import "server-only";
import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TopicRow = { date: string; topic: string; };

function normDate(s: string) {
  const m = s.trim().replace(/-/g,"/").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  const y = m[1], mo = m[2].padStart(2,"0"), d = m[3].padStart(2,"0");
  return `${y}/${mo}/${d}`;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "缺少檔案" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  let rows: TopicRow[] = [];

  if (name.endsWith(".csv") || name.endsWith(".xlsx")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    for (const r of json) {
      const date = normDate(String(r.date || r.日期 || r["時間"] || r["Date"] || ""));
      const topic = String(r.topic || r.主題 || r["Topic"] || "").trim();
      if (date && topic) rows.push({ date, topic });
    }
  } else if (name.endsWith(".pdf")) {
    const pdf = await pdfParse(buf);
    const lines = pdf.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    for (const ln of lines) {
      const dm = ln.match(/(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
      if (!dm) continue;
      const date = normDate(dm[1]);
      const after = ln.slice(dm.index! + dm[0].length).trim();
      const tm = after.match(/^(\d{1,2}:\d{2})\s+([^\s]+)\s/);
      if (tm) {
        const topic = tm[2].trim();
        if (date && topic) rows.push({ date, topic });
      }
    }
  } else {
    return NextResponse.json({ error: "不支援的格式，請上傳 CSV / XLSX / PDF" }, { status: 422 });
  }

  const seen = new Set<string>();
  const unique = rows.filter(r => {
    const key = `${r.date}__${r.topic}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  if (unique.length === 0) {
    return NextResponse.json({ error: "未解析到主題資料，請檢查檔案欄位（需有 日期、主題）" }, { status: 422 });
  }

  return NextResponse.json({ rows: unique });
}

