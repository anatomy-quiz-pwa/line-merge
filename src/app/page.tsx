"use client";
import { useMemo, useState } from "react";

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

export default function Home() {
  const [pdfFile, setPdfFile]     = useState<File | null>(null);   // 名單 PDF
  const [txtFile, setTxtFile]     = useState<File | null>(null);   // LINE .txt
  const [topicFile, setTopicFile] = useState<File | null>(null);   // 主題 CSV/XLSX/PDF

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [merged, setMerged] = useState<MergedRow[]>([]);
  const [loading, setLoading] = useState(false);

  const readyToExport = useMemo(()=> merged.length>0, [merged]);

  async function parseRoster() {
    if (!pdfFile) return alert("請先選擇學員名單 PDF");
    setLoading(true);
    const fd = new FormData();
    fd.append("file", pdfFile);
    const res = await fetch("/api/parse-roster", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return alert(data.error || "解析名單失敗");
    setRoster(data.rows);
    alert(`名單解析成功：${data.rows.length} 筆`);
  }

  async function parseTopics() {
    if (!topicFile) return alert("請先選擇主題檔（CSV/XLSX/PDF）");
    setLoading(true);
    const fd = new FormData();
    fd.append("file", topicFile);
    const res = await fetch("/api/parse-topics", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return alert(data.error || "解析主題失敗");
    setTopics(data.rows);
    alert(`主題解析成功：${data.rows.length} 個日期→主題`);
  }

  async function mergeNow() {
    if (!txtFile) return alert("請先選擇 LINE 對話 .txt");
    if (roster.length === 0) return alert("請先解析名單");
    if (topics.length === 0) return alert("請先解析主題對照表");

    setLoading(true);
    const fd = new FormData();
    fd.append("file", txtFile);
    fd.append("roster", JSON.stringify(roster));
    fd.append("topics", JSON.stringify(topics));
    const res = await fetch("/api/merge", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return alert(data.error || "合併失敗");
    setMerged(data.rows);
  }

  function onCellEdit(i: number, key: keyof MergedRow, val: string) {
    const cp = [...merged];
    (cp[i] as any)[key] = val;
    setMerged(cp);
  }

  async function exportXlsx() {
    setLoading(true);
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ rows: merged })
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(()=> ({}));
      return alert(data.error || "匯出失敗");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "整合結果.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">LINE × 學員名單整合（含日期主題）</h1>

        <section className="bg-white p-4 rounded-xl shadow space-y-3">
          <h2 className="font-medium">1) 上傳檔案</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">學員名單 PDF</label>
              <input type="file" accept="application/pdf" onChange={e=>setPdfFile(e.target.files?.[0]||null)} />
              <button onClick={parseRoster} className="mt-2 px-3 py-1.5 rounded bg-black text-white">解析名單</button>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">LINE 對話 .txt</label>
              <input type="file" accept=".txt" onChange={e=>setTxtFile(e.target.files?.[0]||null)} />
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">主題檔（CSV/XLSX/PDF）</label>
              <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf" onChange={e=>setTopicFile(e.target.files?.[0]||null)} />
              <button onClick={parseTopics} className="mt-2 px-3 py-1.5 rounded bg-black text-white">解析主題</button>
            </div>
          </div>

          <button onClick={mergeNow} className="mt-3 px-3 py-1.5 rounded bg-emerald-600 text-white">
            2) 合併資料
          </button>
          {loading && <p className="text-sm text-neutral-500">處理中…</p>}
        </section>

        {merged.length>0 && (
          <section className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-medium mb-3">結果（可編修）</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-neutral-100 text-left">
                    <th className="p-2">姓名</th>
                    <th className="p-2">工作職稱</th>
                    <th className="p-2">工作年資</th>
                    <th className="p-2">提問內容</th>
                    <th className="p-2">日期</th>
                    <th className="p-2">主題</th>
                    <th className="p-2">相似度</th>
                  </tr>
                </thead>
                <tbody>
                  {merged.map((r,i)=>(
                    <tr key={i} className="border-b">
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">
                        <input className="border rounded p-1 w-48" value={r.title} onChange={e=>onCellEdit(i,"title",e.target.value)} />
                      </td>
                      <td className="p-2">
                        <input className="border rounded p-1 w-28" value={r.seniority} onChange={e=>onCellEdit(i,"seniority",e.target.value)} />
                      </td>
                      <td className="p-2">
                        <textarea className="border rounded p-1 w-[36rem] h-20" value={r.question} onChange={e=>onCellEdit(i,"question",e.target.value)} />
                      </td>
                      <td className="p-2">
                        <input className="border rounded p-1 w-28" value={r.date} onChange={e=>onCellEdit(i,"date",e.target.value)} />
                      </td>
                      <td className="p-2">
                        <input className="border rounded p-1 w-40" value={r.topic} onChange={e=>onCellEdit(i,"topic",e.target.value)} />
                      </td>
                      <td className="p-2 text-neutral-500">{(r.matchScore*100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button disabled={!readyToExport} onClick={exportXlsx}
                    className="mt-3 px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50">
              匯出 Excel
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
