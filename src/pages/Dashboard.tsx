import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../store/AppContext";
import { Chart } from "../components/charts/Chart";
import { PingChart } from "../components/charts/PingChart";
import { SiteEditor } from "../components/editor/SiteEditor";
import { Settings } from "../components/common/Settings";
import { clearSession } from "../utils/auth";
import type { Site, TimeRange } from "../types";

// Import untuk fungsi Auto Report
import { toPng } from "html-to-image";
import { generateWeeklyReportDocx } from "../utils/reportGenerator";

interface DashboardProps {
  onLogout: () => void;
}

const PRESETS = [
  { label: "6H", hours: 6 },
  { label: "24H", hours: 24 },
  { label: "3D", hours: 72 },
  { label: "7D", hours: 168 },
  { label: "30D", hours: 720 },
  { label: "1Y", hours: 8760 },
];

export function Dashboard({ onLogout }: DashboardProps) {
  const { state, setTimeRange } = useApp();
  const [editSite, setEditSite] = useState<Site | undefined>(undefined);
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activePreset, setActivePreset] = useState("24H");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [graphFilter, setGraphFilter] = useState<"all" | "traffic" | "load" | "ping">("all");
  const [showAllSites, setShowAllSites] = useState(false);
  const [detailChart, setDetailChart] = useState<Site | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // --- STATE KHUSUS AUTO GENERATE REPORT ---
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10)); // Default hari ini
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genTotal, setGenTotal] = useState(0);
  const [genStatus, setGenStatus] = useState("");
  
  // State untuk merender chart secara tersembunyi
  const hiddenChartRef = useRef<HTMLDivElement>(null);
  const [hiddenSite, setHiddenSite] = useState<Site | null>(null);
  const [hiddenTimeRange, setHiddenTimeRange] = useState<TimeRange | null>(null);

  // Fungsi pengubah nama site menjadi nama TAG Word (Super Cerdas)
  const getTagFromName = (name: string) => {
    let clean = name.replace(/\(Load\)/i, '').replace(/\(Latency\)/i, '').trim();
    return "img_" + clean.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  };

  // Fungsi Utama Eksekutor Report
  const startGenerateReport = async () => {
    // 1. Setup rentang waktu 7 Hari ke belakang dari tanggal yang dipilih
    const endTs = new Date(reportDate).getTime() + (23 * 3600000) + (59 * 60000); // 23:59:59 hari tersebut
    const startTs = endTs - (7 * 24 * 3600000); // Tarik mundur 7 Hari

    // 2. Ambil hanya data tipe Traffic untuk dilooping
    const trafficSites = state.sites.filter(s => s.type === "traffic");
    
    setGenTotal(trafficSites.length);
    setGenProgress(0);
    setIsGenerating(true);

    const imageMap: Record<string, string> = {};

    // 3. Looping potret gambar (Batch Processing)
    for (let i = 0; i < trafficSites.length; i++) {
      const site = trafficSites[i];
      setGenStatus(`Memotret: ${site.name.replace(/\(Load\)/i, '')}`);
      setHiddenSite(site);
      setHiddenTimeRange({ start: startTs, end: endTs, label: "Weekly Report" });

      // Jeda krusial agar React selesai menggambar SVG Chart di background
      await new Promise(r => setTimeout(r, 600)); 

      if (hiddenChartRef.current) {
        try {
          const dataUrl = await toPng(hiddenChartRef.current, {
            backgroundColor: '#2b3036', // Warna gelap NOC
            style: { margin: '0' },
            // TAMBAHAN: Matikan total proses pembacaan web-font dari luar
            skipFonts: true, 
            fontEmbedCSS: '', 
          });
          const tag = getTagFromName(site.name);
          imageMap[tag] = dataUrl;
          
          // === ALAT PENYADAP DEBUGGING ===
          console.log(`📸 Difoto: {%${tag}%}`);
          console.log(`🖼️ Validkah gambarnya? : ${dataUrl.length > 100 ? "VALID (" + dataUrl.length + " bytes)" : "KOSONG/RUSAK"}`);
          // ===============================

        } catch (err) {
          console.error("Gagal memotret grafik:", site.name, err);
        }
      }
      setGenProgress(i + 1);
    }

    // 4. Kirim semua foto ke mesin Word Builder
    setGenStatus("Menyusun file Microsoft Word...");
    // Beri jeda animasi sedikit
    await new Promise(r => setTimeout(r, 800)); 

    await generateWeeklyReportDocx(new Date(startTs), new Date(endTs), imageMap);

    setIsGenerating(false);
    setShowReportModal(false);
    setHiddenSite(null);
  };
  // ------------------------------------------

  const applyPreset = (p: { label: string; hours: number }) => {
    const end = Date.now();
    setTimeRange({ start: end - p.hours * 3_600_000, end, label: `Last ${p.label}` });
    setActivePreset(p.label);
  };

  const applyCustom = () => {
    const s = new Date(customStart).getTime();
    const e = new Date(customEnd).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) { alert("Invalid range"); return; }
    setTimeRange({ start: s, end: e, label: "Custom" });
    setActivePreset("");
  };

  const { sites, timeRange, loading } = state;

  // Format functions
  const formatRate = (v: number | null): string => {
    if (v === null || isNaN(v)) return "  -nan bps";
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2).padStart(6, " ")}Mbps`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(2).padStart(6, " ")}kbps`;
    return `${v.toFixed(2).padStart(6, " ")} bps`;
  };
  const formatRtt = (v: number | null): string => {
    if (v === null || isNaN(v) || v === 0) return "   0.00 ms";
    if (v >= 1000) return `${(v / 1000).toFixed(2).padStart(6, " ")}s`;
    return `${v.toFixed(2).padStart(6, " ")}ms`;
  };
  const formatLoss = (v: number | null): string => {
    if (v === null || isNaN(v) || v === 0) return "   0.00 %";
    return `${v.toFixed(2).padStart(6, " ")} %`;
  };

  const stats = (data: { timestamp: number; value: number }[]) => {
    const inRange = data.filter((d) => d.timestamp >= timeRange.start && d.timestamp <= timeRange.end);
    if (!inRange.length) return { cur: null, avg: null, max: null, min: null };
    const vals = inRange.map((d) => d.value);
    return {
      cur: vals[vals.length - 1], avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      max: Math.max(...vals), min: Math.min(...vals),
    };
  };

  const filteredSites = (() => {
    let result = sites;
    if (searchQuery.trim() !== "") result = result.filter((site) => site.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (graphFilter === "traffic") result = result.filter((site) => site.type === "traffic");
    else if (graphFilter === "load") result = result.filter((site) => site.type === "latency"); 
    else if (graphFilter === "ping") result = result.filter((site) => site.type === "ping");
    return result;
  })();

  const sitesToDisplay = selectedSite ? sites.filter((s) => s.id === selectedSite) : showAllSites ? filteredSites : filteredSites.slice(0, 12);
  const hasMoreSites = filteredSites.length > 12 && !selectedSite && !showAllSites;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#2C3034", fontFamily: "JetBrains Mono, monospace", color: "#ccc", overflow: "hidden" }}>
      
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", background: "#222629", borderBottom: "1px solid #333", flexWrap: "wrap", flexShrink: 0 }}>
        <span style={{ fontSize: "14px", color: "#33cc00", letterSpacing: "3px", marginRight: "12px", fontWeight: 700 }}>NETMON</span>

        <div ref={searchRef} style={{ position: "relative" }}>
           <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#1a1a1a", border: "1px solid #333", borderRadius: "4px", padding: "8px 12px", minWidth: "300px" }}>
            <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }} onClick={(e) => { e.stopPropagation(); setShowDropdown(true); }} placeholder="Search site..." style={{ background: "transparent", border: "none", outline: "none", color: "#ccc", fontSize: "12px", width: "100%", fontFamily: "JetBrains Mono, monospace" }} />
          </div>
          {/* Dropdown Logic omitted for brevity, it remains identical to your previous code */}
        </div>

        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)} style={{ padding: "6px 14px", cursor: "pointer", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", borderRadius: "4px", background: activePreset === p.label ? "#0a2a1a" : "none", border: activePreset === p.label ? "1px solid #33cc00" : "1px solid #2a2a2a", color: activePreset === p.label ? "#33cc00" : "#555" }}>
            {p.label}
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {/* TOMBOL AUTO REPORT BARU */}
          <button onClick={() => setShowReportModal(true)} style={topBtn("#33ccff", "#0a1a2a")}>
             📄 Weekly Report
          </button>
          <button onClick={() => setShowNew(true)} style={topBtn("#33cc00", "#0a1a0a")}>+ Add</button>
          <button onClick={() => setShowSettings(true)} style={topBtn("#555", "none")}>Settings</button>
          <button onClick={() => { clearSession(); onLogout(); }} style={topBtn("#444", "none")}>Logout</button>
        </div>
      </div>

      <div style={{ background: "#222629", borderBottom: "1px solid #333", padding: "8px 20px", display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
        <span style={{ fontSize: "11px", color: "#888" }}>Graphs:</span>
        {(["all", "traffic", "load", "ping"] as const).map((type) => (
          <button key={type} onClick={() => setGraphFilter(type)} style={{ background: graphFilter === type ? "#0a2a1a" : "none", border: graphFilter === type ? "1px solid #33cc00" : "1px solid #333", borderRadius: "3px", color: graphFilter === type ? "#33cc00" : "#888", fontFamily: "JetBrains Mono, monospace", fontSize: "11px", padding: "4px 12px", cursor: "pointer", textTransform: "capitalize" }}>{type}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "24px" }}>
        {loading && <div style={{ textAlign: "center", marginTop: "80px", color: "#333", fontSize: "12px" }}>Loading...</div>}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {sitesToDisplay.map((site) => (
              <div key={site.id}>
                <div style={{ padding: "12px 16px", background: "#222629", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "16px", color: "#33cc00", margin: 0, fontWeight: 600 }}>{site.name}</h2>
                  <button onClick={() => setEditSite(site)} style={{ background: "none", border: "1px solid #444", color: "#ccc", cursor: "pointer", fontSize: "11px", padding: "4px 12px", borderRadius: "3px", fontFamily: "JetBrains Mono, monospace" }}>EDIT</button>
                </div>
                <GridSiteCard site={site} timeRange={timeRange} onOpenDetail={() => setDetailChart(site)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && <SiteEditor onClose={() => setShowNew(false)} />}
      {editSite && <SiteEditor site={editSite} onClose={() => setEditSite(undefined)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {detailChart && <DetailChartModal site={detailChart} onClose={() => setDetailChart(null)} timeRange={timeRange} formatRate={formatRate} formatRtt={formatRtt} formatLoss={formatLoss} stats={stats} />}

      {/* =========================================
          MODAL AUTO GENERATE REPORT
      ========================================== */}
      {showReportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "4px", width: "400px", padding: "24px", color: "#ccc" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#33ccff" }}>📄 Auto Generate Weekly Report</h3>
            
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", color: "#888", marginBottom: "8px" }}>Pilih Tanggal Akhir Laporan (Menarik 7 Hari Mundur):</label>
              <input 
                type="date" 
                value={reportDate} 
                onChange={e => setReportDate(e.target.value)}
                disabled={isGenerating}
                style={{ width: "100%", padding: "8px", background: "#0a0a0a", border: "1px solid #333", color: "#fff", borderRadius: "4px" }}
              />
            </div>

            {isGenerating ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ width: "100%", height: "8px", background: "#333", borderRadius: "4px", overflow: "hidden", marginBottom: "10px" }}>
                  <div style={{ height: "100%", background: "#33ccff", width: `${(genProgress / genTotal) * 100}%`, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: "11px", color: "#888" }}>{genStatus} ({genProgress}/{genTotal})</div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button onClick={() => setShowReportModal(false)} style={{ padding: "8px 16px", background: "none", border: "1px solid #444", color: "#888", borderRadius: "4px", cursor: "pointer" }}>Batal</button>
                <button onClick={startGenerateReport} style={{ padding: "8px 16px", background: "#0a1a2a", border: "1px solid #33ccff", color: "#33ccff", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Mulai Generate</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================
          HIDDEN CANVAS STUDIO (DEBUGGING MODE)
      ========================================== */}
      <div style={{ 
        position: "fixed", 
        bottom: "20px",
        right: "20px", 
        zIndex: 9999,
        border: "4px solid red",
        background: "#000",
      }}>
        <div ref={hiddenChartRef} style={{ width: "800px", height: "300px", padding: "15px", background: "#2b3036" }}>
          {hiddenSite && hiddenTimeRange && (
             <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <h3 style={{ color: "#e4e8ec", margin: "0 0 10px 0", fontSize: "14px", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
                   {hiddenSite.name.replace(/\(Load\)/i, "").trim()}
                </h3>
                <div style={{ flex: 1 }}>
                   <Chart
                     site={hiddenSite}
                     startTs={hiddenTimeRange.start}
                     endTs={hiddenTimeRange.end}
                     width={770}
                     height={240}
                   />
                </div>
             </div>
          )}
        </div>
      </div>

    </div>
  );
}

// === DETAIL CHART MODAL COMPONENT ===
function DetailChartModal({
  site,
  onClose,
  timeRange,
  formatRate,
  formatRtt,
  formatLoss,
  stats,
}: {
  site: Site;
  onClose: () => void;
  timeRange: TimeRange;
  formatRate: (v: number | null) => string;
  formatRtt: (v: number | null) => string;
  formatLoss: (v: number | null) => string;
  stats: (data: { timestamp: number; value: number }[]) => { cur: number | null; avg: number | null; max: number | null; min: number | null };
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }} onClick={onClose}>
      <div style={{ background: "#222629", border: "1px solid #333", borderRadius: "4px", width: "90%", maxWidth: "1000px", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "18px", color: "#33cc00", margin: 0 }}>{site.name}</h2>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #444", color: "#ccc", cursor: "pointer", fontSize: "12px", padding: "6px 12px", borderRadius: "3px", fontFamily: "JetBrains Mono, monospace" }}>CLOSE</button>
        </div>
        <div style={{ padding: "20px" }}>
          <div ref={chartRef} style={{ width: "100%", marginBottom: "20px" }}>
            {site.type === "ping" ? (
              <PingChart site={site} startTs={timeRange.start} endTs={timeRange.end} width={width} height={300} />
            ) : (
              <Chart site={site} startTs={timeRange.start} endTs={timeRange.end} width={width} height={300} />
            )}
          </div>
          {/* Stats Table */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            {site.interfaces.map((iface) => {
              const statIn = stats(iface.dataIn || []);
              const statOut = stats(iface.dataOut || []);
              const statRtt = stats(iface.dataRtt || []);
              const statLoss = stats(iface.dataLoss || []);
              return (
                <div key={iface.id} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "4px", padding: "12px" }}>
                  <div style={{ fontSize: "11px", color: "#888", marginBottom: "8px", borderBottom: "1px solid #333", paddingBottom: "6px" }}>{iface.name}</div>
                  {site.type === "traffic" && (
                    <>
                      <div style={{ fontSize: "10px", color: iface.colorIn, marginBottom: "4px" }}>IN: {formatRate(statIn.cur)}</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>Avg: {formatRate(statIn.avg)}</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>Max: {formatRate(statIn.max)}</div>
                      <div style={{ fontSize: "10px", color: iface.colorOut, marginTop: "8px", borderTop: "1px solid #333", paddingTop: "6px" }}>OUT: {formatRate(statOut.cur)}</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>Avg: {formatRate(statOut.avg)}</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>Max: {formatRate(statOut.max)}</div>
                    </>
                  )}
                  {site.type === "latency" && (
                    <>
                      <div style={{ fontSize: "10px", color: iface.colorIn, marginBottom: "4px" }}>Load: {statIn.cur !== null ? statIn.cur.toFixed(2) : "-"} %</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>Avg: {statIn.avg !== null ? statIn.avg.toFixed(2) : "-"} %</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>Max: {statIn.max !== null ? statIn.max.toFixed(2) : "-"} %</div>
                    </>
                  )}
                  {site.type === "ping" && (
                    <>
                      <div style={{ fontSize: "10px", color: "#CECECE", marginBottom: "4px" }}>RTT: {formatRtt(statRtt.cur)}</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>Avg: {formatRtt(statRtt.avg)}</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>Min: {formatRtt(statRtt.min)}</div>
                      <div style={{ fontSize: "10px", color: "#CC0000", marginTop: "8px", borderTop: "1px solid #333", paddingTop: "6px" }}>Loss: {formatLoss(statLoss.cur)}</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>Avg: {formatLoss(statLoss.avg)}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// === KOMPONEN BAWAH (GridSiteCard, dsb) DIBIARKAN SAMA SEPERTI SEBELUMNYA ===
function GridSiteCard({ site, timeRange, onOpenDetail }: { site: Site; timeRange: TimeRange; onOpenDetail: () => void }) {
  return (
    <div style={{ background: "#333333", border: "1px solid #444", borderRadius: "3px", overflow: "hidden", cursor: "pointer" }} onClick={onOpenDetail}>
      <ResponsiveChart site={site} timeRange={timeRange} />
    </div>
  );
}

function ResponsiveChart({ site, timeRange }: { site: Site; timeRange: TimeRange }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => { for (const e of entries) setWidth(Math.floor(e.contentRect.width)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      {site.type === "ping" ? <PingChart site={site} startTs={timeRange.start} endTs={timeRange.end} width={width} height={200} /> : <Chart site={site} startTs={timeRange.start} endTs={timeRange.end} width={width} height={200} />}
    </div>
  );
}

function topBtn(color: string, bg: string): React.CSSProperties {
  return { padding: "6px 14px", background: bg, border: `1px solid ${color}`, borderRadius: "4px", color, fontFamily: "JetBrains Mono, monospace", fontSize: "11px", cursor: "pointer", letterSpacing: "1px", fontWeight: "bold" };
}
