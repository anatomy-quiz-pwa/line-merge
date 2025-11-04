import { NextResponse } from "next/server";
import "server-only";
import PDFParser from "pdf2json";

export const runtime = "nodejs"; // Vercel Node 函式
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel 最大執行時間（秒）

type RosterRow = { name: string; title: string; seniority: string; };

const SENIORITY_HINTS = [
  "0~2年","1~3年","2~5年","3~5年","5~10年","10年以上","一年以內","學生","在學學生","未職業","目前為學生","Entry-Level","20","在學","未就業"
];

function tryRow(line: string): RosterRow | null {
  const s = line.replace(/\s+/g," ").trim();
  // 粗略濾掉表頭
  if (/^編號\s*姓名\s*背景\s*年資$/.test(s)) return null;
  if (/^編號/.test(s) && /姓名/.test(s)) return null; // 更寬鬆的表頭過濾
  if (s.length < 2) return null; // 太短的行跳過
  if (/^第\d+頁/.test(s) || /^頁碼/.test(s)) return null; // 跳過頁碼

  // 嘗試找到年資提示詞（可能在結尾或中間）
  let hint: string | null = null;
  let hintIndex = -1;
  
  for (const h of SENIORITY_HINTS) {
    const idx = s.lastIndexOf(h);
    if (idx > -1) {
      hint = h;
      hintIndex = idx;
      break;
    }
  }

  // 如果有年資提示詞，用原邏輯
  if (hint && hintIndex > -1) {
    const left = s.slice(0, hintIndex).trim();
    const parts = left.split(/\s+/).filter(Boolean);
    if (parts.length < 1) return null;

    // 去掉前導編號
    if (/^\d+$/.test(parts[0])) parts.shift();

    // 如果只有一個部分，可能是姓名（沒有職稱）
    if (parts.length === 1) {
      return { name: parts[0], title: "", seniority: hint };
    }

    // 估計最後一段為「背景/職稱」，前面合併為姓名
    const title = parts.pop()!;
    const name = parts.join(" ").trim();
    if (!name) return null;

    return { name, title: title || "", seniority: hint };
  }

  // 如果沒有年資提示詞，嘗試更寬鬆的解析
  // 格式可能是：編號 姓名 職稱 或 姓名 職稱
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  let startIdx = 0;
  // 去掉前導編號
  if (/^\d+$/.test(parts[0])) startIdx = 1;

  if (parts.length <= startIdx) return null;

  // 嘗試識別姓名（通常是2-4個中文字）
  // 姓名通常在開頭，職稱在後面
  const namePattern = /^[一-龥]{2,4}$/;
  
  // 從startIdx開始，找到第一個看起來像姓名的部分
  let nameIdx = startIdx;
  let name = "";
  let title = "";
  
  // 如果第一個部分看起來像姓名
  if (namePattern.test(parts[startIdx])) {
    name = parts[startIdx];
    // 剩餘部分可能是職稱
    if (parts.length > startIdx + 1) {
      title = parts.slice(startIdx + 1).join(" ");
    }
  } else {
    // 嘗試合併前幾個字作為姓名
    let nameParts: string[] = [];
    for (let i = startIdx; i < parts.length; i++) {
      if (namePattern.test(parts[i])) {
        nameParts.push(parts[i]);
      } else {
        break;
      }
    }
    if (nameParts.length > 0) {
      name = nameParts.join("");
      if (parts.length > startIdx + nameParts.length) {
        title = parts.slice(startIdx + nameParts.length).join(" ");
      }
    }
  }

  if (!name || name.length < 2) return null;

  return { name, title: title || "", seniority: "" };
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
          // 提取所有頁面的文字，按行排列
          let fullText = "";
          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts && page.Texts.length > 0) {
                // 按 Y 座標分組（同一行的文字）
                // 使用更細緻的Y座標分組（容差2像素）
                const lines: { [y: number]: Array<{x: number, text: string}> } = {};
                
                for (const textItem of page.Texts) {
                  if (textItem.R && textItem.R[0]) {
                    const decodedText = decodeURIComponent(textItem.R[0].T || "");
                    if (decodedText.trim()) {
                      const y = Math.round((textItem.y || 0) / 2) * 2; // 容差2像素
                      const x = textItem.x || 0;
                      if (!lines[y]) lines[y] = [];
                      lines[y].push({ x, text: decodedText });
                    }
                  }
                }
                
                // 按 Y 座標排序（從上到下），然後每行內按 X 座標排序（從左到右）
                const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a); // 從上到下
                for (const y of sortedYs) {
                  const lineItems = lines[y].sort((a, b) => a.x - b.x); // 從左到右
                  const lineText = lineItems.map(item => item.text).join(" ");
                  fullText += lineText + "\n";
                }
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
      
      // 第一輪：嘗試解析所有行
      for (const line of lines) {
        const r = tryRow(line);
        if (r && r.name && !seen.has(r.name)) { 
          rows.push(r); 
          seen.add(r.name); 
        }
      }
      
      console.log(`第一輪解析結果: ${rows.length} 筆`);
      
      // 如果解析結果太少，輸出一些範例行以供調試
      if (rows.length < 100) {
        console.log(`解析結果較少，前20行範例:`);
        lines.slice(0, 20).forEach((line, idx) => {
          console.log(`${idx + 1}: ${line.substring(0, 100)}`);
        });
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

