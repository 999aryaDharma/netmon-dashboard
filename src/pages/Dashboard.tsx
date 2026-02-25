import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../store/AppContext";
import { Chart } from "../components/charts/Chart";
import { PingChart } from "../components/charts/PingChart";
import { SiteEditor } from "../components/editor/SiteEditor";
import { Settings } from "../components/common/Settings";
import { clearSession } from "../utils/auth";
import type { Site, TimeRange } from "../types";

interface DashboardProps {
  onLogout: () => void;
}

const PRESETS = [
  { label: "6H", hours: 6 },
  { label: "24H", hours: 24 },
  { label: "3D", hours: 72 },
  { label: "7D", hours: 168 },
  { label: "30D", hours: 720 },
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

  // 1. STATE FILTER BARU (4 Tipe)
  const [graphFilter, setGraphFilter] = useState<
    "all" | "traffic" | "load" | "ping"
  >("all");

  const [showAllSites, setShowAllSites] = useState(false);
  // 2. STATE MODAL DIPERMUDAH (Hanya butuh data site)
  const [detailChart, setDetailChart] = useState<Site | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

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

  // Format functions for legend
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

  // 3. LOGIKA FILTER GRAFIK DIPERBAIKI
  const filteredSites = (() => {
    let result = sites;

    if (searchQuery.trim() !== "") {
      result = result.filter((site) =>
        site.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (graphFilter === "traffic") {
      result = result.filter((site) => site.type === "traffic");
    } else if (graphFilter === "load") {
      result = result.filter((site) => site.type === "latency"); // latency = load upward di data Anda
    } else if (graphFilter === "ping") {
      result = result.filter((site) => site.type === "ping");
    }

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
      ) {
        setShowDropdown(false);
      }
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

        {/* Search */}
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
              cursor: "pointer",
            }}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#666"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
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
                width: "200px",
                fontFamily: "JetBrains Mono, monospace",
                cursor: "pointer",
              }}
            />
            {searchQuery && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery("");
                  setSelectedSite("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#666",
                  cursor: "pointer",
                  padding: "0",
                  fontSize: "16px",
                }}
              >
                ×
              </button>
            )}
          </div>

          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: "4px",
                marginTop: "4px",
                maxHeight: "300px",
                overflowY: "auto",
                zIndex: 1000,
                boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
              }}
            >
              {filteredSites.length === 0 ? (
                <div
                  style={{
                    padding: "12px 16px",
                    color: "#666",
                    fontSize: "12px",
                  }}
                >
                  {searchQuery
                    ? `No sites matching "${searchQuery}"`
                    : "No sites available"}
                </div>
              ) : (
                filteredSites.map((site) => (
                  <div
                    key={site.id}
                    onClick={() => {
                      setSelectedSite(site.id);
                      setSearchQuery(site.name);
                      setShowDropdown(false);
                    }}
                    style={{
                      padding: "10px 16px",
                      cursor: "pointer",
                      fontSize: "12px",
                      borderBottom: "1px solid #222",
                      background:
                        selectedSite === site.id ? "#0a2a1a" : "transparent",
                      color: selectedSite === site.id ? "#33cc00" : "#ccc",
                    }}
                  >
                    {site.name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Presets */}
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

        {/* Custom range */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <input
            type="datetime-local"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            style={miniInput}
          />
          <span style={{ color: "#333", fontSize: "11px" }}>—</span>
          <input
            type="datetime-local"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            style={miniInput}
          />
          <button
            onClick={applyCustom}
            style={{
              padding: "4px 9px",
              background: "none",
              border: "1px solid #2a2a2a",
              borderRadius: "2px",
              color: "#555",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
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

      {/* 4. TABS FILTER GRAFIK */}
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
        {!loading && sites.length === 0 && (
          <div
            style={{
              textAlign: "center",
              marginTop: "80px",
              color: "#333",
              fontSize: "12px",
            }}
          >
            No sites. Click <span style={{ color: "#33cc00" }}>+ Add</span> to
            create one.
          </div>
        )}
        {!loading && (
          <>
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

            {hasMoreSites && (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <button
                  onClick={() => setShowAllSites(true)}
                  style={{
                    background: "none",
                    border: "1px solid #33cc00",
                    color: "#33cc00",
                    padding: "10px 24px",
                    borderRadius: "4px",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Show {filteredSites.length - 12} more sites...
                </button>
              </div>
            )}

            {showAllSites && filteredSites.length > 12 && (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <button
                  onClick={() => setShowAllSites(false)}
                  style={{
                    background: "none",
                    border: "1px solid #555",
                    color: "#888",
                    padding: "10px 24px",
                    borderRadius: "4px",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Show less (showing {filteredSites.length} sites)
                </button>
              </div>
            )}
          </>
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
          formatRate={formatRate}
          formatRtt={formatRtt}
          formatLoss={formatLoss}
          stats={stats}
        />
      )}
    </div>
  );
}

// ============================================
// GridSiteCard & ResponsiveChart (Sederhana)
// ============================================

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

const miniInput: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #222",
  borderRadius: "2px",
  color: "#666",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "10px",
  padding: "4px 6px",
  outline: "none",
};

function topBtn(color: string, bg: string): React.CSSProperties {
  return {
    padding: "4px 11px",
    background: bg,
    border: `1px solid ${color}`,
    borderRadius: "2px",
    color,
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "10px",
    cursor: "pointer",
    letterSpacing: "1px",
  };
}

// ============================================
// DetailChartModal
// ============================================

function MiniSparkline() {
  return (
    <svg width="80" height="30" style={{ marginTop: "4px" }}>
      <path
        d="M 0 25 L 10 20 L 20 28 L 30 15 L 40 22 L 50 10 L 60 18 L 70 5 L 80 15 L 80 30 L 0 30 Z"
        fill="rgba(255,255,255,0.1)"
      />
      <polyline
        points="0,25 10,20 20,28 30,15 40,22 50,10 60,18 70,5 80,15"
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1"
      />
    </svg>
  );
}

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
  stats: (data: { timestamp: number; value: number }[]) => {
    cur: number | null;
    avg: number | null;
    max: number | null;
    min: number | null;
  };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);

  const [localStart, setLocalStart] = useState(timeRange.start);
  const [localEnd, setLocalEnd] = useState(timeRange.end);

  const handleUpdate = () => {
    const start = new Date(localStart).getTime();
    const end = new Date(localEnd).getTime();
    if (isNaN(start) || isNaN(end) || start >= end) {
      alert("Invalid date range");
      return;
    }
  };

  const formatDateTime = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PRESETS = [
    "6 Hours",
    "24 Hours",
    "48 Hours",
    "One Week",
    "Two Weeks",
    "One Month",
    "Two Months",
    "One Year",
    "Two Years",
  ];

  // Penentuan Label berdasarkan Site Type
  const siteTypeLabel =
    site.type === "ping"
      ? "Icmp Perf"
      : site.type === "traffic"
        ? "Traffic"
        : "CPU Load";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#2b3036",
          borderRadius: "4px",
          width: "95%",
          maxWidth: "1300px",
          maxHeight: "95vh",
          overflowY: "auto",
          boxShadow: "0 16px 64px rgba(0,0,0,0.9)",
          color: "#c8ced6",
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: "8px 16px",
            background: "#363c45",
            borderBottom: "1px solid #1a1e23",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{ fontSize: "13px", fontWeight: "bold", color: "#e4e8ec" }}
          >
            {site.name} :: {siteTypeLabel}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <select
              style={{
                background: "#2b3036",
                color: "#c8ced6",
                border: "1px solid #1a1e23",
                padding: "4px 8px",
                fontSize: "12px",
                borderRadius: "2px",
                outline: "none",
              }}
            >
              <option>{siteTypeLabel}</option>
            </select>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#c8ced6",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Sparklines */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "16px",
            borderBottom: "1px solid #444c56",
          }}
        >
          {PRESETS.map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                opacity: 0.7,
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "4px",
                  color: "#e4e8ec",
                }}
              >
                {label}
              </span>
              <MiniSparkline />
            </div>
          ))}
        </div>

        {/* Date Selector */}
        <div
          style={{
            padding: "12px",
            textAlign: "center",
            background: "#2b3036",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              fontSize: "12px",
            }}
          >
            <span>From</span>
            <input
              type="datetime-local"
              value={formatDateTime(localStart)}
              onChange={(e) =>
                setLocalStart(new Date(e.target.value).getTime())
              }
              style={{
                padding: "4px 8px",
                border: "1px solid #1a1e23",
                borderRadius: "3px",
                fontSize: "12px",
                background: "#fff",
                color: "#000",
              }}
            />
            <span>To</span>
            <input
              type="datetime-local"
              value={formatDateTime(localEnd)}
              onChange={(e) => setLocalEnd(new Date(e.target.value).getTime())}
              style={{
                padding: "4px 8px",
                border: "1px solid #1a1e23",
                borderRadius: "3px",
                fontSize: "12px",
                background: "#fff",
                color: "#000",
              }}
            />
            <button
              onClick={handleUpdate}
              style={{
                padding: "5px 16px",
                background: "#4a535e",
                border: "1px solid #1a1e23",
                color: "#fff",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Update
            </button>
          </div>
        </div>

        {/* Chart Area */}
        <div
          ref={ref}
          style={{
            padding: "0 16px 16px 16px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {site.type === "ping" ? (
            <PingChart
              site={site}
              startTs={localStart}
              endTs={localEnd}
              width={width}
              height={350}
            />
          ) : (
            <Chart
              site={site}
              startTs={localStart}
              endTs={localEnd}
              width={width}
              height={350}
            />
          )}
        </div>

        {/* Legend Table */}
        <div
          style={{
            padding: "0 16px 24px 76px",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
          }}
        >
          <div
            style={{ display: "flex", marginBottom: "4px", color: "#9fb3c8" }}
          >
            <div style={{ width: "140px" }}>
              {site.type === "ping"
                ? "Milliseconds"
                : site.type === "traffic"
                  ? "Traffic"
                  : "Load"}
            </div>
            <div style={{ width: "85px", textAlign: "left" }}>Cur</div>
            <div style={{ width: "85px", textAlign: "left" }}>Min</div>
            <div style={{ width: "85px", textAlign: "left" }}>Max</div>
            <div style={{ width: "85px", textAlign: "left" }}>Avg</div>
          </div>

          {site.type === "ping"
            ? site.interfaces.map((i) => {
                const sRtt = stats(i.dataRtt || []);
                const sLoss = stats(i.dataLoss || []);
                return (
                  <React.Fragment key={i.id}>
                    <div
                      style={{
                        display: "flex",
                        color: "#c8ced6",
                        marginBottom: "2px",
                      }}
                    >
                      <div
                        style={{
                          width: "140px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            background: "#ccc",
                          }}
                        />
                        RTT
                      </div>
                      <div style={{ width: "85px" }}>
                        {sRtt.cur !== null ? sRtt.cur.toFixed(2) : "0.00"}
                      </div>
                      <div style={{ width: "85px" }}>
                        {sRtt.min !== null ? sRtt.min.toFixed(2) : "0.00"}
                      </div>
                      <div style={{ width: "85px" }}>
                        {sRtt.max !== null ? sRtt.max.toFixed(2) : "0.00"}
                      </div>
                      <div style={{ width: "85px" }}>
                        {sRtt.avg !== null ? sRtt.avg.toFixed(2) : "0.00"}
                      </div>
                    </div>
                    <div style={{ display: "flex", color: "#c8ced6" }}>
                      <div
                        style={{
                          width: "140px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            background: "#ff4444",
                          }}
                        />
                        Loss
                      </div>
                      <div style={{ width: "85px" }}>
                        {sLoss.cur !== null ? sLoss.cur.toFixed(2) : "0.00"}
                      </div>
                      <div style={{ width: "85px" }}>
                        {sLoss.min !== null ? sLoss.min.toFixed(2) : "0.00"}
                      </div>
                      <div style={{ width: "85px" }}>
                        {sLoss.max !== null ? sLoss.max.toFixed(2) : "0.00"}
                      </div>
                      <div style={{ width: "85px" }}>
                        {sLoss.avg !== null ? sLoss.avg.toFixed(2) : "0.00"}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            : site.interfaces.map((i) => {
                const sIn = stats(i.dataIn || []);
                const sOut = stats(i.dataOut || []);
                return (
                  <React.Fragment key={i.id}>
                    <div
                      style={{
                        display: "flex",
                        color: "#c8ced6",
                        marginBottom: "2px",
                      }}
                    >
                      <div
                        style={{
                          width: "140px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            background: i.colorIn,
                          }}
                        />
                        {i.name} In
                      </div>
                      <div style={{ width: "85px" }}>
                        {formatRate(sIn.cur).trim()}
                      </div>
                      <div style={{ width: "85px" }}>
                        {formatRate(sIn.min).trim()}
                      </div>
                      <div style={{ width: "85px" }}>
                        {formatRate(sIn.max).trim()}
                      </div>
                      <div style={{ width: "85px" }}>
                        {formatRate(sIn.avg).trim()}
                      </div>
                    </div>
                    {site.type === "traffic" && (
                      <div style={{ display: "flex", color: "#c8ced6" }}>
                        <div
                          style={{
                            width: "140px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              background: i.colorOut,
                            }}
                          />
                          {i.name} Out
                        </div>
                        <div style={{ width: "85px" }}>
                          {formatRate(sOut.cur).trim()}
                        </div>
                        <div style={{ width: "85px" }}>
                          {formatRate(sOut.min).trim()}
                        </div>
                        <div style={{ width: "85px" }}>
                          {formatRate(sOut.max).trim()}
                        </div>
                        <div style={{ width: "85px" }}>
                          {formatRate(sOut.avg).trim()}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
        </div>
      </div>
    </div>
  );
}
