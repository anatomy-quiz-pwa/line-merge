"use client";
import { useState, useMemo } from "react";

type RosterRow = { name: string; title: string; seniority: string; };
type MergedRow = { name: string; title: string; seniority: string; question: string; matchScore: number };

export default function Home() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [txtFile, setTxtFile] = useState<File | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [merged, setMerged] = useState<MergedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const readyToExport = useMemo(()=> merged.length>0, [merged]);

  async function parseRoster() {
    if (!pdfFile) return alert("請先選擇學員名單 PDF");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", pdfFile);
      const res = await fetch("/api/parse-roster", { method: "POST", body: fd });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        alert(data.error || "解析名單失敗");
        return;
      }
      setRoster(data.rows);
      alert(`名單解析成功：${data.rows.length} 筆`);
    } catch (error) {
      setLoading(false);
      alert("解析失敗：" + (error instanceof Error ? error.message : "未知錯誤"));
    }
  }

  async function mergeNow() {
    if (!txtFile) return alert("請先選擇 LINE 對話 txt");
    if (roster.length === 0) return alert("請先解析名單");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", txtFile);
      fd.append("roster", JSON.stringify(roster));
      const res = await fetch("/api/merge", { method: "POST", body: fd });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        alert(data.error || "合併失敗");
        return;
      }
      setMerged(data.rows);
    } catch (error) {
      setLoading(false);
      alert("合併失敗：" + (error instanceof Error ? error.message : "未知錯誤"));
    }
  }

  function onCellEdit(idx: number, key: keyof MergedRow, value: string) {
    const copy = [...merged];
    (copy[idx] as any)[key] = value;
    setMerged(copy);
  }

  async function exportXlsx() {
    setLoading(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ rows: merged })
      });
      setLoading(false);
      if (!res.ok) {
        const data = await res.json().catch(()=> ({}));
        alert(data.error || "匯出失敗");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "整合結果.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setLoading(false);
      alert("匯出失敗：" + (error instanceof Error ? error.message : "未知錯誤"));
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">LINE 提問 × 學員名單 整合器</h1>

        <section className="bg-white p-4 rounded-xl shadow">
          <h2 className="font-medium mb-2">1) 上傳檔案</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">學員名單 PDF</label>
              <input type="file" accept="application/pdf" onChange={e=>setPdfFile(e.target.files?.[0]||null)} />
              <button onClick={parseRoster} className="mt-2 px-3 py-1.5 rounded bg-black text-white">
                解析名單
              </button>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">LINE 對話 .txt</label>
              <input type="file" accept=".txt" onChange={e=>setTxtFile(e.target.files?.[0]||null)} />
              <button onClick={mergeNow} className="mt-2 px-3 py-1.5 rounded bg-black text-white">
                合併資料
              </button>
            </div>
          </div>
          {loading && <p className="text-sm text-neutral-500 mt-3">處理中…</p>}
        </section>

        {roster.length>0 && (
          <section className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-medium mb-2">名單摘要</h2>
            <p className="text-sm text-neutral-600">共 {roster.length} 人</p>
          </section>
        )}

        {merged.length>0 && (
          <section className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-medium mb-3">結果（可直接編修）</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left bg-neutral-100">
                    <th className="p-2">姓名</th>
                    <th className="p-2">工作職稱</th>
                    <th className="p-2">工作年資</th>
                    <th className="p-2">提問內容</th>
                    <th className="p-2">相似度</th>
                  </tr>
                </thead>
                <tbody>
                  {merged.map((r,i)=>(
                    <tr key={i} className="border-b">
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">
                        <input className="border rounded p-1 w-56" value={r.title}
                               onChange={e=>onCellEdit(i,"title",e.target.value)} />
                      </td>
                      <td className="p-2">
                        <input className="border rounded p-1 w-28" value={r.seniority}
                               onChange={e=>onCellEdit(i,"seniority",e.target.value)} />
                      </td>
                      <td className="p-2">
                        <textarea className="border rounded p-1 w-[36rem] h-20"
                                  value={r.question}
                                  onChange={e=>onCellEdit(i,"question",e.target.value)} />
                      </td>
                      <td className="p-2 text-neutral-500">{(r.matchScore*100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              disabled={!readyToExport}
              onClick={exportXlsx}
              className="mt-3 px-3 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-50">
              匯出 Excel
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
