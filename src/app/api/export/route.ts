import { NextResponse } from "next/server";
import "server-only";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MergedRow = { name: string; title: string; seniority: string; question: string };

export async function POST(req: Request) {
  const body = await req.json().catch(()=>null);
  if (!body?.rows) return NextResponse.json({ error: "缺少 rows" }, { status: 400 });

  const rows: MergedRow[] = body.rows;
  const aoa = [["工作職稱","工作年資","提問內容","姓名"]];
  for (const r of rows) {
    aoa.push([r.title, r.seniority, r.question, r.name]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "整合結果");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="merge.xlsx"'
    }
  });
}

