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
  // 按空格分割
  const parts = s.split(/\s+/).filter(Boolean);
  
  // 至少需要3個部分（編號、姓名、其他）
  if (parts.length < 3) return null;

  // 第一部分應該是編號（純數字）
  const numberPart = parts[0];
  if (!/^\d+$/.test(numberPart)) {
    return null;
  }

  // 從最後開始尋找年資（包含年資提示詞）
  let seniority = "";
  let seniorityIndex = -1;
  
  // 先檢查最後一部分
  for (const h of SENIORITY_HINTS) {
    if (parts[parts.length - 1].includes(h)) {
      seniority = h;
      seniorityIndex = parts.length - 1;
      break;
    }
  }
  
  // 如果最後一部分不是年資，從後往前找
  if (!seniority) {
    for (let i = parts.length - 1; i >= 1; i--) {
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
  if (seniority && seniorityIndex > 1) {
    // 編號在 parts[0]，年資在 parts[seniorityIndex]
    // 姓名和職位在 parts[1] 到 parts[seniorityIndex-1]
    const middleParts = parts.slice(1, seniorityIndex);
    
    if (middleParts.length === 0) return null;
    
    // 如果只有一個部分，當作姓名（沒有職位）
    if (middleParts.length === 1) {
      const name = middleParts[0];
      // 驗證姓名（可能包含英文或括號，所以更寬鬆）
      if (name.length >= 2 && name.length <= 50) {
        return {
          name: name.trim(),
          title: "",
          seniority: seniority
        };
      }
      return null;
    }
    
    // 多個部分：最後一個部分當作職位，前面合併為姓名
    // 但職位可能包含多個詞（如"物理治療師"），所以從後往前找職稱關鍵字
    let titleIndex = middleParts.length;
    let title = "";
    
    // 從後往前找職稱關鍵字
    const titleKeywords = /治療師|醫師|教練|學生|老師|師|員|者|長|主任|經理|專員|助理|訓練師|防護員|助理|助理/;
    for (let i = middleParts.length - 1; i >= 0; i--) {
      if (titleKeywords.test(middleParts[i])) {
        titleIndex = i;
        break;
      }
    }
    
    // 如果找到職稱關鍵字，從該位置開始到最後都是職位
    if (titleIndex < middleParts.length) {
      title = middleParts.slice(titleIndex).join(" ");
      const name = middleParts.slice(0, titleIndex).join("");
      
      if (name && name.length >= 2 && name.length <= 50) {
        return {
          name: name.trim(),
          title: title.trim(),
          seniority: seniority
        };
      }
    } else {
      // 如果沒找到職稱關鍵字，最後一個部分當職位
      title = middleParts[middleParts.length - 1];
      const name = middleParts.slice(0, middleParts.length - 1).join("");
      
      if (name && name.length >= 2 && name.length <= 50) {
        return {
          name: name.trim(),
          title: title.trim(),
          seniority: seniority
        };
      }
    }
    
    return null;
  }

  // 如果沒有找到年資提示詞，但格式看起來正確（至少有4部分）
  // 嘗試：編號(0) 姓名(1) 職位(2) 年資(3+)
  if (parts.length >= 4) {
    // 嘗試從最後開始找年資（可能沒有包含在提示詞列表中）
    let possibleSeniority = parts[parts.length - 1];
    
    // 如果最後一部分看起來像年資（包含"年"字或數字）
    if (/年|^\d+/.test(possibleSeniority)) {
      const name = parts[1];
      const title = parts.slice(2, parts.length - 1).join(" ");
      
      // 驗證姓名（可能包含英文或括號）
      if (name && name.length >= 2 && name.length <= 50) {
        return {
          name: name.trim(),
          title: title.trim(),
          seniority: possibleSeniority.trim()
        };
      }
    } else {
      // 如果最後一部分不是年資，嘗試前三部分
      const name = parts[1];
      const title = parts[2];
      const seniorityPart = parts.slice(3).join(" ");
      
      if (name && name.length >= 2 && name.length <= 50) {
        return {
          name: name.trim(),
          title: title.trim(),
          seniority: seniorityPart.trim()
        };
      }
    }
  }

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
                // 使用更大的容差（10像素）來處理表格行
                const lines: { [y: number]: Array<{x: number, text: string, w?: number}> } = {};
                
                // 收集所有文字區塊
                const textBlocks: Array<{x: number, y: number, text: string, w?: number}> = [];
                for (const textItem of page.Texts) {
                  if (textItem.R && textItem.R[0]) {
                    const decodedText = decodeURIComponent(textItem.R[0].T || "");
                    if (decodedText.trim()) {
                      const x = textItem.x || 0;
                      const y = textItem.y || 0;
                      const w = textItem.w || 0;
                      textBlocks.push({ x, y, text: decodedText, w });
                    }
                  }
                }
                
                // 按 Y 座標分組（容差10像素）
                for (const block of textBlocks) {
                  // 使用較大的容差，將相近Y座標的文字歸為同一行
                  const y = Math.round(block.y / 10) * 10;
                  if (!lines[y]) lines[y] = [];
                  lines[y].push({ x: block.x, text: block.text, w: block.w });
                }
                
                // 按 Y 座標排序（從上到下）
                const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);
                
                for (const y of sortedYs) {
                  const lineItems = lines[y].sort((a, b) => a.x - b.x); // 從左到右
                  
                  // 嘗試識別表格結構：如果X座標有明顯的間隔，可能是表格欄位
                  // 通常表格欄位之間會有較大的間距
                  const lineText = lineItems.map(item => item.text).join(" ");
                  
                  // 如果這一行看起來像表格行（有明顯的間隔），嘗試更智能的合併
                  if (lineItems.length > 2) {
                    // 檢查X座標間距，如果間距很大（可能是表格欄位分隔）
                    let prevX = 0;
                    let parts: string[] = [];
                    let currentPart = "";
                    
                    for (let i = 0; i < lineItems.length; i++) {
                      const item = lineItems[i];
                      const gap = item.x - prevX;
                      
                      // 如果間距很大（>100像素），可能是新欄位的開始
                      if (gap > 100 && currentPart) {
                        parts.push(currentPart.trim());
                        currentPart = item.text;
                      } else {
                        // 如果間距很小（<50像素），可能是同一欄位內的文字
                        if (currentPart) {
                          currentPart += " " + item.text;
                        } else {
                          currentPart = item.text;
                        }
                      }
                      prevX = item.x + (item.w || 0);
                    }
                    
                    if (currentPart) {
                      parts.push(currentPart.trim());
                    }
                    
                    // 如果成功識別出多個部分，用空格連接（保持表格格式）
                    if (parts.length >= 3) {
                      fullText += parts.join(" ") + "\n";
                    } else {
                      fullText += lineText + "\n";
                    }
                  } else {
                    fullText += lineText + "\n";
                  }
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


