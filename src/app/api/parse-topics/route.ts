import { NextResponse } from "next/server";
import "server-only";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TopicRow = { date: string; topic: string; };

function normDate(s: string) {
  const trimmed = s.trim().replace(/-/g,"/");
  
  // 嘗試匹配 YYYY/MM/DD 格式
  let m = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    const y = m[1], mo = m[2].padStart(2,"0"), d = m[3].padStart(2,"0");
    return `${y}/${mo}/${d}`;
  }
  
  // 嘗試匹配 MM/DD 格式（沒有年份，假設為 2025）
  m = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const mo = m[1].padStart(2,"0"), d = m[2].padStart(2,"0");
    // 假設年份為 2025（可以根據需要調整）
    return `2025/${mo}/${d}`;
  }
  
  return "";
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "缺少檔案" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  let rows: TopicRow[] = [];

  if (name.endsWith(".csv") || name.endsWith(".xlsx")) {
    try {
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      
      console.log(`CSV/XLSX 解析: 找到 ${json.length} 行原始資料`);
      
      for (const r of json) {
        // 嘗試多種欄位名稱
        const dateStr = String(r.date || r.日期 || r["時間"] || r["Date"] || r["日期"] || "").trim();
        const topicStr = String(r.topic || r.主題 || r["Topic"] || r["主題"] || "").trim();
        
        const date = normDate(dateStr);
        
        // 只有當日期有效時才加入（過濾掉空行和表頭）
        if (date) {
          rows.push({ 
            date: date, 
            topic: topicStr || "" // 允許主題為空
          });
        }
      }
      
      console.log(`CSV/XLSX 解析: 成功解析 ${rows.length} 筆有效資料`);
    } catch (error) {
      console.error("CSV/XLSX 解析錯誤:", error);
      return NextResponse.json({ 
        error: `CSV/XLSX 解析失敗: ${error instanceof Error ? error.message : "未知錯誤"}` 
      }, { status: 500 });
    }
  } else if (name.endsWith(".pdf")) {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const pdf = await pdfParse(buf);
    const lines = pdf.text.split(/\r?\n/).map((s: string)=>s.trim()).filter(Boolean);
    for (const ln of lines) {
      const dm = ln.match(/(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
      if (!dm) continue;
      const date = normDate(dm[1]);
      const after = ln.slice(dm.index! + dm[0].length).trim();
      const tm = after.match(/^(\d{1,2}:\d{2})\s+([^\s]+)\s/);
      if (tm) {
        const topic = tm[2].trim();
        rows.push({ 
          date: date || "無資料", 
          topic: topic || "無資料" 
        });
      } else {
        // 即使沒有找到主題，也加入日期（如果有的話）
        rows.push({ 
          date: date || "無資料", 
          topic: "無資料" 
        });
      }
    }
  } else {
    return NextResponse.json({ error: "不支援的格式，請上傳 CSV / XLSX / PDF" }, { status: 422 });
  }

  // 過濾和去重
  const seen = new Set<string>();
  const unique = rows.filter(r => {
    // 必須有日期
    if (!r.date || r.date === "無資料") return false;
    
    const key = `${r.date}__${r.topic || ""}`;
    if (seen.has(key)) return false;
    seen.add(key); 
    return true;
  });

  console.log(`最終結果: ${unique.length} 筆唯一資料`);
  if (unique.length > 0) {
    console.log(`前5筆範例:`, unique.slice(0, 5));
  }

  if (unique.length === 0) {
    return NextResponse.json({ 
      error: "未解析到主題資料，請檢查檔案欄位（需有 日期 欄位）。已解析的行數：" + rows.length 
    }, { status: 422 });
  }

  return NextResponse.json({ rows: unique });
}

