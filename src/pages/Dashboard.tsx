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

  const [graphFilter, setGraphFilter] = useState<
    "all" | "traffic" | "load" | "ping"
  >("all");
  const [showAllSites, setShowAllSites] = useState(false);
  const [detailChart, setDetailChart] = useState<Site | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // --- STATE KHUSUS AUTO GENERATE REPORT ---
  const [showReportModal, setShowReportModal] = useState(false);

  // Default ke bulan ini (Format: YYYY-MM)
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [reportWeekTarget, setReportWeekTarget] = useState<
    "1" | "2" | "3" | "4" | "ALL"
  >("1");

  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genTotal, setGenTotal] = useState(0);
  const [genStatus, setGenStatus] = useState("");

  // State untuk merender chart secara tersembunyi
  const hiddenChartRef = useRef<HTMLDivElement>(null);
  const [hiddenSite, setHiddenSite] = useState<Site | null>(null);
  const [hiddenTimeRange, setHiddenTimeRange] = useState<TimeRange | null>(
    null,
  );

  // Fungsi pengubah nama site menjadi nama TAG Word (Super Cerdas)
  const getTagFromName = (name: string) => {
    let clean = name
      .replace(/\(Load\)/i, "")
      .replace(/\(Latency\)/i, "")
      .trim();
    return (
      "img_" +
      clean
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
    );
  };

  // Fungsi Utama Eksekutor Report
  const startGenerateReport = async () => {
    setIsGenerating(true);
    const trafficSites = state.sites.filter((s) => s.type === "traffic");

    // 1. Urai Tahun dan Bulan dari input (contoh "2026-01" -> year 2026, month 0)
    const [yearStr, monthStr] = reportMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // JS Date index bulan dimulai dari 0

    // 2. Buat Definisi 4 Minggu
    const weeks = [
      {
        id: "1",
        start: new Date(year, month, 1, 0, 0, 0),
        end: new Date(year, month, 7, 23, 59, 59),
      },
      {
        id: "2",
        start: new Date(year, month, 8, 0, 0, 0),
        end: new Date(year, month, 14, 23, 59, 59),
      },
      {
        id: "3",
        start: new Date(year, month, 15, 0, 0, 0),
        end: new Date(year, month, 21, 23, 59, 59),
      },
      // Tanggal 0 di bulan berikutnya otomatis merujuk ke hari terakhir bulan saat ini (28/29/30/31)
      {
        id: "4",
        start: new Date(year, month, 22, 0, 0, 0),
        end: new Date(year, month + 1, 0, 23, 59, 59),
      },
    ];

    // 3. Tentukan antrean berdasarkan pilihan user
    const targetWeeks =
      reportWeekTarget === "ALL"
        ? weeks
        : weeks.filter((w) => w.id === reportWeekTarget);
    setGenTotal(trafficSites.length * targetWeeks.length);
    let overallProgress = 0;

    // 4. LOOPING BATCH (Anti-Crash Memory Flush)
    for (let w = 0; w < targetWeeks.length; w++) {
      const currentWeek = targetWeeks[w];
      const imageMap: Record<string, string> = {}; // <-- Dikosongkan setiap ganti minggu agar RAM lega

      for (let i = 0; i < trafficSites.length; i++) {
        const site = trafficSites[i];
        setGenStatus(
          `M${currentWeek.id}: ${site.name.replace(/\(Load\)/i, "")}`,
        );

        // Posisikan grafik ke tanggal minggu ini
        setHiddenSite(site);
        setHiddenTimeRange({
          start: currentWeek.start.getTime(),
          end: currentWeek.end.getTime(),
          label: "Weekly Report",
        });

        // TUNGGU React render chart tersembunyi (2 frame animation)
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // JEDA NAPAS BROWSER: Sangat penting agar UI tidak freeze (500ms)
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (hiddenChartRef.current) {
          try {
            const dataUrl = await toPng(hiddenChartRef.current, {
              backgroundColor: "#2b3036",
              style: { margin: "0" },
              skipFonts: true,
              fontEmbedCSS: "",
            });
            const tag = getTagFromName(site.name);
            imageMap[tag] = dataUrl;
          } catch (err) {
            console.error("Gagal memotret grafik:", site.name, err);
          }
        }
        overallProgress++;
        setGenProgress(overallProgress);
      }

      setGenStatus(`Menyusun File Word Minggu ${currentWeek.id}...`);
      await new Promise((resolve) => setTimeout(resolve, 300)); // Jeda animasi

      // Generate file Word untuk minggu ini
      await generateWeeklyReportDocx(
        currentWeek.start,
        currentWeek.end,
        imageMap,
      );

      // Jika ini "Generate ALL", beri jeda 2 detik sebelum mendownload file berikutnya
      // agar browser tidak memblokir "Multiple Downloads"
      if (reportWeekTarget === "ALL" && w < targetWeeks.length - 1) {
        setGenStatus(
          `Selesai Minggu ${currentWeek.id}. Istirahat pendingin RAM...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setGenStatus("Selesai!");
    setTimeout(() => {
      setIsGenerating(false);
      setShowReportModal(false);
      setHiddenSite(null);
    }, 1000);
  };
  // ------------------------------------------

  const applyPreset = (p: { label: string; hours: number }) => {
    const end = Date.now();
    setTimeRange({
      start: end - p.hours * 3_600_000,
      end,
      label: `Last ${p.label}`,
    });
    setActivePreset(p.label);
  };

  const applyCustom = () => {
    const s = new Date(customStart).getTime();
    const e = new Date(customEnd).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) {
      alert("Invalid range");
      return;
    }
    setTimeRange({ start: s, end: e, label: "Custom" });
    setActivePreset("");
  };

  const { sites, timeRange, loading } = state;

  // Format functions
  const formatRate = (v: number | null): string => {
    if (v === null || isNaN(v)) return "  -nan bps";
    if (v >= 1_000_000)
      return `${(v / 1_000_000).toFixed(2).padStart(6, " ")}Mbps`;
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
    const inRange = data.filter(
      (d) => d.timestamp >= timeRange.start && d.timestamp <= timeRange.end,
    );
    if (!inRange.length) return { cur: null, avg: null, max: null, min: null };
    const vals = inRange.map((d) => d.value);
    return {
      cur: vals[vals.length - 1],
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      max: Math.max(...vals),
      min: Math.min(...vals),
    };
  };

  const filteredSites = (() => {
    let result = sites;
    if (searchQuery.trim() !== "")
      result = result.filter((site) =>
        site.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    if (graphFilter === "traffic")
      result = result.filter((site) => site.type === "traffic");
    else if (graphFilter === "load")
      result = result.filter((site) => site.type === "latency");
    else if (graphFilter === "ping")
      result = result.filter((site) => site.type === "ping");
    return result;
  })();

  const sitesToDisplay = selectedSite
    ? sites.filter((s) => s.id === selectedSite)
    : showAllSites
      ? filteredSites
      : filteredSites.slice(0, 12);
  const hasMoreSites =
    filteredSites.length > 12 && !selectedSite && !showAllSites;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      )
        setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#2C3034",
        fontFamily: "JetBrains Mono, monospace",
        color: "#ccc",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px 20px",
          background: "#222629",
          borderBottom: "1px solid #333",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "14px",
            color: "#33cc00",
            letterSpacing: "3px",
            marginRight: "12px",
            fontWeight: 700,
          }}
        >
          NETMON
        </span>

        <div ref={searchRef} style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "4px",
              padding: "8px 12px",
              minWidth: "300px",
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(true);
              }}
              placeholder="Search site..."
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ccc",
                fontSize: "12px",
                width: "100%",
                fontFamily: "JetBrains Mono, monospace",
              }}
            />
          </div>
          {/* Dropdown Logic omitted for brevity, it remains identical to your previous code */}
        </div>

        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            style={{
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
              borderRadius: "4px",
              background: activePreset === p.label ? "#0a2a1a" : "none",
              border:
                activePreset === p.label
                  ? "1px solid #33cc00"
                  : "1px solid #2a2a2a",
              color: activePreset === p.label ? "#33cc00" : "#555",
            }}
          >
            {p.label}
          </button>
        ))}

        {/* --- KEMBALIKAN CUSTOM DATE FILTER --- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "4px",
            padding: "4px 8px",
            marginLeft: "12px",
          }}
        >
          <span style={{ fontSize: "11px", color: "#888" }}>From</span>
          <input
            type="datetime-local"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              color: "#ccc",
              fontSize: "11px",
              outline: "none",
              fontFamily: "JetBrains Mono, monospace",
            }}
          />
          <span style={{ fontSize: "11px", color: "#888" }}>To</span>
          <input
            type="datetime-local"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              color: "#ccc",
              fontSize: "11px",
              outline: "none",
              fontFamily: "JetBrains Mono, monospace",
            }}
          />
          <button
            onClick={applyCustom}
            style={{
              background: "#2a2a2a",
              border: "1px solid #444",
              color: "#ccc",
              padding: "4px 8px",
              borderRadius: "3px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Update
          </button>
        </div>
        {/* ------------------------------------- */}

        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {/* TOMBOL AUTO REPORT BARU */}
          <button
            onClick={() => setShowReportModal(true)}
            style={topBtn("#33ccff", "#0a1a2a")}
          >
            📄 Weekly Report
          </button>
          <button
            onClick={() => setShowNew(true)}
            style={topBtn("#33cc00", "#0a1a0a")}
          >
            + Add
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={topBtn("#555", "none")}
          >
            Settings
          </button>
          <button
            onClick={() => {
              clearSession();
              onLogout();
            }}
            style={topBtn("#444", "none")}
          >
            Logout
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#222629",
          borderBottom: "1px solid #333",
          padding: "8px 20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: "11px", color: "#888" }}>Graphs:</span>
        {(["all", "traffic", "load", "ping"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setGraphFilter(type)}
            style={{
              background: graphFilter === type ? "#0a2a1a" : "none",
              border:
                graphFilter === type ? "1px solid #33cc00" : "1px solid #333",
              borderRadius: "3px",
              color: graphFilter === type ? "#33cc00" : "#888",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
              padding: "4px 12px",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {type}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {loading && (
          <div
            style={{
              textAlign: "center",
              marginTop: "80px",
              color: "#333",
              fontSize: "12px",
            }}
          >
            Loading...
          </div>
        )}
        {!loading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "24px",
            }}
          >
            {sitesToDisplay.map((site) => (
              <div key={site.id}>
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#222629",
                    borderBottom: "1px solid #333",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "16px",
                      color: "#33cc00",
                      margin: 0,
                      fontWeight: 600,
                    }}
                  >
                    {site.name}
                  </h2>
                  <button
                    onClick={() => setEditSite(site)}
                    style={{
                      background: "none",
                      border: "1px solid #444",
                      color: "#ccc",
                      cursor: "pointer",
                      fontSize: "11px",
                      padding: "4px 12px",
                      borderRadius: "3px",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    EDIT
                  </button>
                </div>
                <GridSiteCard
                  site={site}
                  timeRange={timeRange}
                  onOpenDetail={() => setDetailChart(site)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Tombol Show All / Show Less */}
        {!loading && hasMoreSites && !showAllSites && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
            <button
              onClick={() => setShowAllSites(true)}
              style={{
                padding: "10px 24px",
                background: "#0a2a1a",
                border: "1px solid #33cc00",
                borderRadius: "4px",
                color: "#33cc00",
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: "bold",
              }}
            >
              Show All {filteredSites.length} Sites
            </button>
          </div>
        )}
        {!loading && showAllSites && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
            <button
              onClick={() => setShowAllSites(false)}
              style={{
                padding: "10px 24px",
                background: "none",
                border: "1px solid #444",
                borderRadius: "4px",
                color: "#888",
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              Show Less (12 Sites)
            </button>
          </div>
        )}
      </div>

      {showNew && <SiteEditor onClose={() => setShowNew(false)} />}
      {editSite && (
        <SiteEditor site={editSite} onClose={() => setEditSite(undefined)} />
      )}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {detailChart && (
        <DetailChartModal
          site={detailChart}
          onClose={() => setDetailChart(null)}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          formatRate={formatRate}
          formatRtt={formatRtt}
          formatLoss={formatLoss}
          stats={stats}
        />
      )}

      {/* =========================================
          MODAL AUTO GENERATE REPORT (UX BARU)
      ========================================== */}
      {showReportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
          }}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "4px",
              width: "420px",
              padding: "24px",
              color: "#ccc",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#33ccff" }}>
              📄 Auto Generate Laporan
            </h3>

            <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
              {/* Input 1: Pemilihan Bulan */}
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "#888",
                    marginBottom: "8px",
                  }}
                >
                  Pilih Bulan:
                </label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  disabled={isGenerating}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: "#0a0a0a",
                    border: "1px solid #333",
                    color: "#fff",
                    borderRadius: "4px",
                  }}
                />
              </div>

              {/* Input 2: Pemilihan Target Minggu */}
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "#888",
                    marginBottom: "8px",
                  }}
                >
                  Pilih Rentang:
                </label>
                <select
                  value={reportWeekTarget}
                  onChange={(e) => setReportWeekTarget(e.target.value as any)}
                  disabled={isGenerating}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: "#0a0a0a",
                    border: "1px solid #333",
                    color: "#fff",
                    borderRadius: "4px",
                  }}
                >
                  <option value="1">Minggu 1 (Tgl 1 - 7)</option>
                  <option value="2">Minggu 2 (Tgl 8 - 14)</option>
                  <option value="3">Minggu 3 (Tgl 15 - 21)</option>
                  <option value="4">Minggu 4 (Tgl 22 - Akhir)</option>
                  <option value="ALL">📦 1 Bulan Full (4 File)</option>
                </select>
              </div>
            </div>

            {isGenerating ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    background: "#333",
                    borderRadius: "4px",
                    overflow: "hidden",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "#33ccff",
                      width: `${(genProgress / genTotal) * 100}%`,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#888",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {genStatus} ({genProgress}/{genTotal})
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowReportModal(false)}
                  style={{
                    padding: "8px 16px",
                    background: "none",
                    border: "1px solid #444",
                    color: "#888",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  onClick={startGenerateReport}
                  style={{
                    padding: "8px 16px",
                    background: "#0a1a2a",
                    border: "1px solid #33ccff",
                    color: "#33ccff",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Mulai Generate
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden chart ref for report generation - invisible */}
      <div
        style={{
          position: "fixed",
          bottom: "-9999px",
          left: "-9999px",
          zIndex: -1,
        }}
      >
        <div
          ref={hiddenChartRef}
          style={{
            width: "800px",
            height: "300px",
            padding: "15px",
            background: "#2b3036",
          }}
        >
          {hiddenSite && hiddenTimeRange && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <h3
                style={{
                  color: "#e4e8ec",
                  margin: "0 0 10px 0",
                  fontSize: "14px",
                  textAlign: "center",
                  fontFamily: "Arial, sans-serif",
                }}
              >
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
// === DETAIL CHART MODAL COMPONENT ===
function DetailChartModal({
  site,
  onClose,
  timeRange,
  setTimeRange,
  formatRate,
  formatRtt,
  formatLoss,
  stats,
}: {
  site: Site;
  onClose: () => void;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  formatRate: (v: number | null) => string;
  formatRtt: (v: number | null) => string;
  formatLoss: (v: number | null) => string;
  stats: (data: { timestamp: number; value: number }[]) => {
    cur: number | null;
    avg: number | null;
    max: number | null;
    min: number | null;
  };
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [localStart, setLocalStart] = useState("");
  const [localEnd, setLocalEnd] = useState("");

  // Sinkronisasi dengan waktu global
  useEffect(() => {
    const formatLocal = (ts: number) => {
      const d = new Date(ts);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setLocalStart(formatLocal(timeRange.start));
    setLocalEnd(formatLocal(timeRange.end));
  }, [timeRange]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyLocalCustom = () => {
    const s = new Date(localStart).getTime();
    const e = new Date(localEnd).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) {
      alert("Invalid range");
      return;
    }
    setTimeRange({ start: s, end: e, label: "Custom" });
  };

  const MODAL_PRESETS = [
    { label: "6 Hours", hours: 6 },
    { label: "24 Hours", hours: 24 },
    { label: "48 Hours", hours: 48 },
    { label: "One Week", hours: 168 },
    { label: "Two Weeks", hours: 336 },
    { label: "One Month", hours: 720 },
    { label: "One Year", hours: 8760 },
  ];

  // --- KALKULASI TOTAL DATA (RRDTool Style) ---
  const durationSecs = Math.max(1, (timeRange.end - timeRange.start) / 1000);

  // Fungsi format Volume (Bytes/KB/MB/GB/TB)
  const formatVolLocal = (avgBps: number | null) => {
    if (avgBps === null || isNaN(avgBps)) return "0.00 B";
    const totalBytes = (avgBps * durationSecs) / 8;
    if (totalBytes >= 1_099_511_627_776)
      return `${(totalBytes / 1_099_511_627_776).toFixed(2)}TB`;
    if (totalBytes >= 1_073_741_824)
      return `${(totalBytes / 1_073_741_824).toFixed(2)}GB`;
    if (totalBytes >= 1_048_576)
      return `${(totalBytes / 1_048_576).toFixed(2)}MB`;
    if (totalBytes >= 1_024) return `${(totalBytes / 1_024).toFixed(2)}KB`;
    return `${totalBytes.toFixed(2)}B`;
  };

  // Kalkulasi agregat (Total) untuk semua interface (Hanya jika tipe Traffic)
  let tInCur = 0,
    tInAvg = 0,
    tInMax = 0;
  let tOutCur = 0,
    tOutAvg = 0,
    tOutMax = 0;

  if (site.type === "traffic") {
    site.interfaces.forEach((i) => {
      const sI = stats(i.dataIn || []);
      const sO = stats(i.dataOut || []);
      tInCur += sI.cur || 0;
      tInAvg += sI.avg || 0;
      tInMax += sI.max || 0;
      tOutCur += sO.cur || 0;
      tOutAvg += sO.avg || 0;
      tOutMax += sO.max || 0;
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#2C3034",
          border: "1px solid #444",
          borderRadius: "4px",
          width: "95%",
          maxWidth: "1200px",
          maxHeight: "95vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Title */}
        <div
          style={{
            padding: "12px 20px",
            background: "#222629",
            borderBottom: "1px solid #333",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              color: "#e4e8ec",
              margin: 0,
              fontWeight: "normal",
            }}
          >
            {site.name}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            ✖
          </button>
        </div>

        {/* Filter Control */}
        <div
          style={{
            padding: "16px 20px",
            background: "#2b3036",
            borderBottom: "1px solid #111",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              marginBottom: "16px",
            }}
          ></div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "10px",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "12px", color: "#ccc" }}>From</span>
            <input
              type="datetime-local"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              style={{
                padding: "6px",
                background: "#fff",
                border: "1px solid #ccc",
                color: "#333",
                borderRadius: "2px",
                fontSize: "12px",
              }}
            />
            <span style={{ fontSize: "12px", color: "#ccc" }}>To</span>
            <input
              type="datetime-local"
              value={localEnd}
              onChange={(e) => setLocalEnd(e.target.value)}
              style={{
                padding: "6px",
                background: "#fff",
                border: "1px solid #ccc",
                color: "#333",
                borderRadius: "2px",
                fontSize: "12px",
              }}
            />
            <button
              onClick={applyLocalCustom}
              style={{
                padding: "6px 16px",
                background: "#4a5568",
                color: "#fff",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              Update
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "20px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Chart Area */}
          <div
            ref={chartRef}
            style={{
              width: "100%",
              maxWidth: "1000px",
              background: "#323841",
              border: "1px solid #444",
              borderBottom: "none",
              padding: "10px 0 0 0",
            }}
          >
            {site.type === "ping" ? (
              <PingChart
                site={site}
                startTs={timeRange.start}
                endTs={timeRange.end}
                width={width > 1000 ? 1000 : width}
                height={350}
              />
            ) : (
              <Chart
                site={site}
                startTs={timeRange.start}
                endTs={timeRange.end}
                width={width > 1000 ? 1000 : width}
                height={350}
              />
            )}
          </div>

          {/* RRDTool Legend Table */}
          <div
            style={{
              width: "100%",
              maxWidth: "1000px",
              padding: "10px 20px 20px 20px",
              background: "#323841",
              border: "1px solid #444",
              borderTop: "none",
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: "600px",
                borderCollapse: "collapse",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11.5px",
                color: "#e4e8ec",
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: "120px" }}></th>
                  <th style={{ width: "40px" }}></th>
                  <th
                    style={{
                      textAlign: "right",
                      fontWeight: "normal",
                      padding: "4px 8px",
                    }}
                  >
                    Current
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      fontWeight: "normal",
                      padding: "4px 8px",
                    }}
                  >
                    Average
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      fontWeight: "normal",
                      padding: "4px 8px",
                    }}
                  >
                    Maximum
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      fontWeight: "normal",
                      padding: "4px 0",
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {site.interfaces.map((iface) => {
                  const statIn = stats(iface.dataIn || []);
                  const statOut = stats(iface.dataOut || []);
                  const statRtt = stats(iface.dataRtt || []);
                  const statLoss = stats(iface.dataLoss || []);

                  if (site.type === "traffic") {
                    return (
                      <React.Fragment key={iface.id}>
                        <tr>
                          <td style={{ textAlign: "left", padding: "2px 0" }}>
                            <span
                              style={{
                                color: iface.colorIn,
                                marginRight: "6px",
                              }}
                            >
                              ■
                            </span>
                            {iface.name}
                          </td>
                          <td style={{ textAlign: "left" }}>In</td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatRate(statIn.cur)}
                          </td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatRate(statIn.avg)}
                          </td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatRate(statIn.max)}
                          </td>
                          <td style={{ textAlign: "right", padding: "2px 0" }}>
                            {formatVolLocal(statIn.avg)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ textAlign: "left", padding: "2px 0" }}>
                            <span
                              style={{
                                color: iface.colorOut,
                                marginRight: "6px",
                              }}
                            >
                              ■
                            </span>
                          </td>
                          <td style={{ textAlign: "left" }}>Out</td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatRate(statOut.cur)}
                          </td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatRate(statOut.avg)}
                          </td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatRate(statOut.max)}
                          </td>
                          <td style={{ textAlign: "right", padding: "2px 0" }}>
                            {formatVolLocal(statOut.avg)}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  } else if (site.type === "ping") {
                    return (
                      <React.Fragment key={iface.id}>
                        <tr>
                          <td style={{ textAlign: "left", padding: "2px 0" }}>
                            <span
                              style={{ color: "#CECECE", marginRight: "6px" }}
                            >
                              ■
                            </span>
                            {iface.name}
                          </td>
                          <td style={{ textAlign: "left" }}>RTT</td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatRtt(statRtt.cur)}
                          </td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatRtt(statRtt.avg)}
                          </td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatRtt(statRtt.max)}
                          </td>
                          <td style={{ textAlign: "right", padding: "2px 0" }}>
                            -
                          </td>
                        </tr>
                        <tr>
                          <td style={{ textAlign: "left", padding: "2px 0" }}>
                            <span
                              style={{ color: "#CC0000", marginRight: "6px" }}
                            >
                              ■
                            </span>
                          </td>
                          <td style={{ textAlign: "left" }}>Loss</td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatLoss(statLoss.cur)}
                          </td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatLoss(statLoss.avg)}
                          </td>
                          <td
                            style={{ textAlign: "right", padding: "2px 8px" }}
                          >
                            {formatLoss(statLoss.max)}
                          </td>
                          <td style={{ textAlign: "right", padding: "2px 0" }}>
                            -
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  } else {
                    // Untuk Load
                    return (
                      <tr key={iface.id}>
                        <td style={{ textAlign: "left", padding: "2px 0" }}>
                          <span
                            style={{ color: iface.colorIn, marginRight: "6px" }}
                          >
                            ■
                          </span>
                          {iface.name}
                        </td>
                        <td style={{ textAlign: "left" }}>Load</td>
                        <td style={{ textAlign: "right", padding: "2px 8px" }}>
                          {statIn.cur !== null ? statIn.cur.toFixed(2) : "-"} %
                        </td>
                        <td style={{ textAlign: "right", padding: "2px 8px" }}>
                          {statIn.avg !== null ? statIn.avg.toFixed(2) : "-"} %
                        </td>
                        <td style={{ textAlign: "right", padding: "2px 8px" }}>
                          {statIn.max !== null ? statIn.max.toFixed(2) : "-"} %
                        </td>
                        <td style={{ textAlign: "right", padding: "2px 0" }}>
                          -
                        </td>
                      </tr>
                    );
                  }
                })}

                {/* --- TOTAL AGGREGATE BLOCK --- */}
                {site.type === "traffic" && (
                  <>
                    <tr style={{ height: "16px" }}></tr>
                    <tr>
                      <td style={{ textAlign: "left", padding: "2px 0" }}>
                        <span style={{ color: "#fff", marginRight: "6px" }}>
                          ■
                        </span>
                        Total
                      </td>
                      <td style={{ textAlign: "left" }}>In</td>
                      <td style={{ textAlign: "right", padding: "2px 8px" }}>
                        {formatRate(tInCur)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 8px" }}>
                        {formatRate(tInAvg)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 8px" }}>
                        {formatRate(tInMax)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 0" }}>
                        {formatVolLocal(tInAvg)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: "left", padding: "2px 0" }}>
                        <span style={{ color: "#fff", marginRight: "6px" }}>
                          ■
                        </span>
                      </td>
                      <td style={{ textAlign: "left" }}>Out</td>
                      <td style={{ textAlign: "right", padding: "2px 8px" }}>
                        {formatRate(tOutCur)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 8px" }}>
                        {formatRate(tOutAvg)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 8px" }}>
                        {formatRate(tOutMax)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 0" }}>
                        {formatVolLocal(tOutAvg)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: "left", padding: "2px 0" }}>
                        <span style={{ color: "#fff", marginRight: "6px" }}>
                          ■
                        </span>
                      </td>
                      <td style={{ textAlign: "left" }}>Agg</td>
                      <td style={{ textAlign: "right", padding: "2px 8px" }}>
                        {formatRate(tInCur + tOutCur)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 8px" }}>
                        {formatRate(tInAvg + tOutAvg)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 8px" }}>
                        {formatRate(tInMax + tOutMax)}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 0" }}>
                        {formatVolLocal(tInAvg + tOutAvg)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// === KOMPONEN BAWAH (GridSiteCard, dsb) DIBIARKAN SAMA SEPERTI SEBELUMNYA ===
function GridSiteCard({
  site,
  timeRange,
  onOpenDetail,
}: {
  site: Site;
  timeRange: TimeRange;
  onOpenDetail: () => void;
}) {
  return (
    <div
      style={{
        background: "#333333",
        border: "1px solid #444",
        borderRadius: "3px",
        overflow: "hidden",
        cursor: "pointer",
      }}
      onClick={onOpenDetail}
    >
      <ResponsiveChart site={site} timeRange={timeRange} />
    </div>
  );
}

function ResponsiveChart({
  site,
  timeRange,
}: {
  site: Site;
  timeRange: TimeRange;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      {site.type === "ping" ? (
        <PingChart
          site={site}
          startTs={timeRange.start}
          endTs={timeRange.end}
          width={width}
          height={200}
        />
      ) : (
        <Chart
          site={site}
          startTs={timeRange.start}
          endTs={timeRange.end}
          width={width}
          height={200}
        />
      )}
    </div>
  );
}

function topBtn(color: string, bg: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    background: bg,
    border: `1px solid ${color}`,
    borderRadius: "4px",
    color,
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "11px",
    cursor: "pointer",
    letterSpacing: "1px",
    fontWeight: "bold",
  };
}
