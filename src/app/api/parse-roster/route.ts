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
  
  // 過濾表頭和無效行
  if (/^編號\s*姓名\s*背景\s*年資$/.test(s)) return null;
  if (/^編號/.test(s) && /姓名/.test(s) && s.length < 30) return null; // 表頭
  if (s.length < 2) return null;
  if (/^第\d+頁/.test(s) || /^頁碼/.test(s)) return null;
  if (/^共\d+/.test(s) || /^總計/.test(s)) return null;
  
  // 如果整行都是數字或特殊符號，跳過
  if (/^[\d\s\-\.]+$/.test(s)) return null;

  // 固定格式：編號 姓名 職位 年資
  // 按空格分割，應該至少有4個部分
  const parts = s.split(/\s+/).filter(Boolean);
  
  // 至少需要4個部分（編號、姓名、職位、年資）
  if (parts.length < 3) return null;

  // 第一部分應該是編號（純數字）
  const numberPart = parts[0];
  if (!/^\d+$/.test(numberPart)) {
    // 如果第一部分不是數字，可能沒有編號，嘗試從第二部分開始
    // 但這種情況不符合固定格式，跳過
    return null;
  }

  // 最後一部分應該是年資（包含年資提示詞）
  let seniority = "";
  let seniorityIndex = -1;
  
  for (const h of SENIORITY_HINTS) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes(h)) {
      seniority = h;
      seniorityIndex = parts.length - 1;
      break;
    }
  }
  
  // 如果最後一部分不是年資，嘗試在整行中尋找
  if (!seniority) {
    for (let i = parts.length - 1; i >= 0; i--) {
      for (const h of SENIORITY_HINTS) {
        if (parts[i].includes(h)) {
          seniority = h;
          seniorityIndex = i;
          break;
        }
      }
      if (seniority) break;
    }
  }

  // 如果找到年資，提取姓名和職位
  if (seniority && seniorityIndex > 0) {
    // 編號在 parts[0]，年資在 parts[seniorityIndex]
    // 姓名和職位在 parts[1] 到 parts[seniorityIndex-1]
    const middleParts = parts.slice(1, seniorityIndex);
    
    if (middleParts.length === 0) return null;
    
    // 如果只有一個部分，當作姓名（沒有職位）
    if (middleParts.length === 1) {
      return {
        name: middleParts[0],
        title: "",
        seniority: seniority
      };
    }
    
    // 最後一個部分當作職位，前面合併為姓名
    const title = middleParts.pop()!;
    const name = middleParts.join("");
    
    if (!name || name.length < 2) return null;
    
    return {
      name: name.trim(),
      title: title.trim(),
      seniority: seniority
    };
  }

  // 如果沒有找到年資提示詞，但格式看起來正確（至少有4部分）
  // 嘗試：編號(0) 姓名(1) 職位(2) 年資(3+)
  if (parts.length >= 4) {
    const name = parts[1];
    const title = parts[2];
    const seniorityPart = parts.slice(3).join(" ");
    
    // 驗證姓名（應該是中文字）
    if (/^[一-龥]{2,10}$/.test(name)) {
      return {
        name: name.trim(),
        title: title.trim(),
        seniority: seniorityPart.trim()
      };
    }
  }

  // 如果格式不符合，返回 null
  return null;
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
                      // 增加容差到5像素，更好地處理同一行的文字
                      const y = Math.round((textItem.y || 0) / 5) * 5;
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
      const rowMap = new Map<number, RosterRow>(); // 用編號作為key，避免重複
      
      // 解析所有行
      for (const line of lines) {
        const r = tryRow(line);
        if (r && r.name && r.name.length >= 2) {
          // 從原始行中提取編號（如果有的話）
          const parts = line.replace(/\s+/g," ").trim().split(/\s+/);
          if (parts.length > 0 && /^\d+$/.test(parts[0])) {
            const number = parseInt(parts[0], 10);
            // 如果這個編號已經存在，跳過（可能是重複解析）
            if (!rowMap.has(number)) {
              rowMap.set(number, r);
              rows.push(r);
            }
          } else {
            // 如果無法提取編號，直接加入（但可能會有重複）
            rows.push(r);
          }
        }
      }
      
      // 按編號排序（如果有的話）
      const rowsWithNumbers = rows.map((r, idx) => {
        const line = lines.find(l => {
          const parts = l.replace(/\s+/g," ").trim().split(/\s+/);
          if (parts.length > 0 && /^\d+$/.test(parts[0])) {
            const parsed = tryRow(l);
            return parsed && parsed.name === r.name && parsed.title === r.title;
          }
          return false;
        });
        if (line) {
          const parts = line.replace(/\s+/g," ").trim().split(/\s+/);
          const number = /^\d+$/.test(parts[0]) ? parseInt(parts[0], 10) : idx + 1;
          return { row: r, number };
        }
        return { row: r, number: idx + 1 };
      });
      
      rowsWithNumbers.sort((a, b) => a.number - b.number);
      const sortedRows = rowsWithNumbers.map(item => item.row);
      
      const maxNumber = Math.max(...rowsWithNumbers.map(item => item.number), 0);
      
      console.log(`解析結果: ${sortedRows.length} 筆 (最大編號: ${maxNumber})`);
      
      // 如果解析結果太少，輸出一些範例行以供調試
      if (sortedRows.length < maxNumber * 0.5) {
        console.log(`⚠️ 警告: 解析結果 (${sortedRows.length}) 遠少於最大編號 (${maxNumber})`);
        console.log(`前50行原始內容:`);
        lines.slice(0, 50).forEach((line, idx) => {
          console.log(`${idx + 1}: ${line.substring(0, 150)}`);
        });
        console.log(`成功解析的範例 (前10筆):`);
        sortedRows.slice(0, 10).forEach((r, idx) => {
          console.log(`${idx + 1}: ${r.name} | ${r.title} | ${r.seniority}`);
        });
      }
      if (sortedRows.length === 0) {
        return NextResponse.json({ error: "未解析到資料，請檢查 PDF 排版" }, { 
          status: 422,
          headers: { "Content-Type": "application/json" }
        });
      }
      return NextResponse.json({ 
        rows: sortedRows,
        maxNumber: maxNumber,
        totalFound: sortedRows.length
      }, {
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

