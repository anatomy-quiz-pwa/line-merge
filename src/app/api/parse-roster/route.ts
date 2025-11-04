import { NextResponse } from "next/server";
import "server-only";
import PDFParser from "pdf2json";

export const runtime = "nodejs"; // Vercel Node 函式
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel 最大執行時間（秒）

type RosterRow = { name: string; title: string; seniority: string; };

const SENIORITY_HINTS = [
  "0~2年","1~3年","2~5年","3~5年","5~10年","10年以上","一年以內","學生","在學學生","未職業","目前為學生","Entry-Level","20"
];

function tryRow(line: string): RosterRow | null {
  const s = line.replace(/\s+/g," ").trim();
  // 粗略濾掉表頭
  if (/^編號\s*姓名\s*背景\s*年資$/.test(s)) return null;

  const hint = SENIORITY_HINTS.find(h => s.endsWith(h));
  if (!hint) return null;

  const left = s.slice(0, s.lastIndexOf(hint)).trim();
  const parts = left.split(" ").filter(Boolean);
  if (parts.length < 2) return null;

  // 去掉前導編號
  if (/^\d+$/.test(parts[0])) parts.shift();

  // 估計最後一段為「背景/職稱」，前面合併為姓名
  const title = parts.pop()!;
  const name = parts.join(" ").trim();
  if (!name || !title) return null;

  return { name, title, seniority: hint };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "缺少檔案" }, { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    try {
      // 使用 pdf2json 解析 PDF（純 Node.js，適合 serverless）
      const pdfParser = new PDFParser();
      
      const text = await new Promise<string>((resolve, reject) => {
        pdfParser.on("pdfParser_dataError", (errData: any) => {
          reject(new Error(errData.parserError));
        });
        
        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
          // 提取所有頁面的文字
          let fullText = "";
          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  if (textItem.R && textItem.R[0]) {
                    // 解碼文字（可能是 URI 編碼）
                    const decodedText = decodeURIComponent(textItem.R[0].T || "");
                    fullText += decodedText + " ";
                  }
                }
                fullText += "\n";
              }
            }
          }
          resolve(fullText);
        });
        
        pdfParser.parseBuffer(buffer);
      });
      
      const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

      const rows: RosterRow[] = [];
      const seen = new Set<string>();
      for (const line of lines) {
        const r = tryRow(line);
        if (r && !seen.has(r.name)) { rows.push(r); seen.add(r.name); }
      }
      if (rows.length === 0) {
        return NextResponse.json({ error: "未解析到資料，請檢查 PDF 排版" }, { 
          status: 422,
          headers: { "Content-Type": "application/json" }
        });
      }
      return NextResponse.json({ rows }, {
        headers: { "Content-Type": "application/json" }
      });
    } catch (pdfError) {
      console.error("PDF 解析錯誤:", pdfError);
      return NextResponse.json(
        { 
          error: pdfError instanceof Error 
            ? `PDF 解析失敗: ${pdfError.message}` 
            : "PDF 解析失敗，請檢查檔案格式" 
        },
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  } catch (error) {
    console.error("API 錯誤:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? `伺服器錯誤: ${error.message}` 
          : "未知錯誤" 
      },
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

