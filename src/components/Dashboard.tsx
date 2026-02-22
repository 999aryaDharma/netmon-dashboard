import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../store/AppContext";
import { Chart } from "./Chart";
import { PingChart } from "./PingChart";
import { SiteEditor } from "./SiteEditor";
import { Settings } from "./Settings";
import { clearSession } from "../utils/auth";
import type { Site, SiteInterface, TimeRange } from "../types";

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
  const [graphFilter, setGraphFilter] = useState<"all" | "load" | "latency">("all");
  const [showAllSites, setShowAllSites] = useState(false);
  const [detailChart, setDetailChart] = useState<{ site: Site; chartType: "load" | "latency" } | null>(null);
  const [showLegend, setShowLegend] = useState(true);
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

  const openDetailChart = (site: Site, chartType: "load" | "latency") => {
    setDetailChart({ site, chartType });
  };

  const closeDetailChart = () => {
    setDetailChart(null);
  };

  const { sites, timeRange, loading } = state;

  // Format functions for legend
  const formatRate = (v: number | null): string => {
    if (v === null || isNaN(v)) return "  -nan bps";
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2).padStart(6, " ")}Mbps`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(2).padStart(6, " ")}kbps`;
    return `${v.toFixed(2).padStart(6, " ")} bps`;
  };

  const formatVol = (avgBps: number | null): string => {
    if (avgBps === null || isNaN(avgBps)) return "  -nan B";
    const durationSeconds = (timeRange.end - timeRange.start) / 1000;
    const totalBytes = (avgBps * durationSeconds) / 8;
    if (totalBytes >= 1_099_511_627_776) return `${(totalBytes / 1_099_511_627_776).toFixed(2).padStart(6, " ")}TB`;
    if (totalBytes >= 1_073_741_824) return `${(totalBytes / 1_073_741_824).toFixed(2).padStart(6, " ")}GB`;
    if (totalBytes >= 1_048_576) return `${(totalBytes / 1_048_576).toFixed(2).padStart(6, " ")}MB`;
    if (totalBytes >= 1_024) return `${(totalBytes / 1_024).toFixed(2).padStart(6, " ")}KB`;
    return `${totalBytes.toFixed(2).padStart(6, " ")}B`;
  };

  const formatRtt = (v: number | null): string => {
    if (v === null || isNaN(v) || v === 0) return "  -nan ms";
    if (v >= 1000) return `${(v / 1000).toFixed(2).padStart(6, " ")}s`;
    return `${v.toFixed(2).padStart(6, " ")}ms`;
  };

  const formatLoss = (v: number | null): string => {
    if (v === null || isNaN(v) || v === 0) return "  -nan %";
    return `${v.toFixed(2).padStart(6, " ")} %`;
  };

  const stats = (data: { timestamp: number; value: number }[]) => {
    const inRange = data.filter((d) => d.timestamp >= timeRange.start && d.timestamp <= timeRange.end);
    if (!inRange.length) return { cur: null, avg: null, max: null };
    const vals = inRange.map((d) => d.value);
    return {
      cur: vals[vals.length - 1],
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      max: Math.max(...vals),
    };
  };

  // Filter sites based on search query AND graph filter
  const filteredSites = (() => {
    let result = sites;

    // Apply search filter
    if (searchQuery.trim() !== "") {
      result = result.filter((site) =>
        site.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply graph type filter
    if (graphFilter === "load") {
      // Only show traffic/load sites
      result = result.filter((site) => site.type !== "ping");
    } else if (graphFilter === "latency") {
      // Only show ping/latency sites
      result = result.filter((site) => site.type === "ping");
    }

    return result;
  })();

  // Get sites to display (selected, all, or first 12 for grid)
  const sitesToDisplay = selectedSite
    ? sites.filter((s) => s.id === selectedSite)
    : showAllSites
    ? filteredSites
    : filteredSites.slice(0, 12);

  const hasMoreSites = filteredSites.length > 12 && !selectedSite && !showAllSites;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
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
      {/* Top bar - Original Header */}
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

        {/* Site Search Dropdown */}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
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
            {searchQuery ? (
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
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </div>

          {/* Dropdown results */}
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
                  {searchQuery ? `No sites matching "${searchQuery}"` : "No sites available"}
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
                      background: selectedSite === site.id ? "#0a2a1a" : "transparent",
                      color: selectedSite === site.id ? "#33cc00" : "#ccc",
                      fontSize: "12px",
                      borderBottom: "1px solid #222",
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

      {/* Graph Filter Tabs - Below Header */}
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
        <button
          onClick={() => setGraphFilter("all")}
          style={{
            background: graphFilter === "all" ? "#0a2a1a" : "none",
            border: graphFilter === "all" ? "1px solid #33cc00" : "1px solid #333",
            borderRadius: "3px",
            color: graphFilter === "all" ? "#33cc00" : "#888",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          All
        </button>
        <button
          onClick={() => setGraphFilter("load")}
          style={{
            background: graphFilter === "load" ? "#0a2a1a" : "none",
            border: graphFilter === "load" ? "1px solid #33cc00" : "1px solid #333",
            borderRadius: "3px",
            color: graphFilter === "load" ? "#33cc00" : "#888",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          Load
        </button>
        <button
          onClick={() => setGraphFilter("latency")}
          style={{
            background: graphFilter === "latency" ? "#0a2a1a" : "none",
            border: graphFilter === "latency" ? "1px solid #33cc00" : "1px solid #333",
            borderRadius: "3px",
            color: graphFilter === "latency" ? "#33cc00" : "#888",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          Ping
        </button>
      </div>

      {/* ============================================
          MAIN CONTENT - CSS Grid 3 Columns
      ============================================= */}
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
            {/* Graph Grid - 3 Columns */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "24px",
              }}
            >
              {sitesToDisplay.map((site) => (
                <div key={site.id}>
                  {/* Site Header */}
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

                  {/* Chart - Load atau Latency tergantung type site */}
                  <GridSiteCard
                    site={site}
                    timeRange={timeRange}
                    onEdit={() => setEditSite(site)}
                    chartType={site.type === "ping" ? "latency" : "load"}
                    onOpenDetail={() => openDetailChart(site, site.type === "ping" ? "latency" : "load")}
                  />
                </div>
              ))}
            </div>

            {/* Show more button */}
            {hasMoreSites && (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                }}
              >
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

            {/* Show less button (when all sites shown) */}
            {showAllSites && filteredSites.length > 12 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                }}
              >
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
          site={detailChart.site}
          chartType={detailChart.chartType}
          onClose={closeDetailChart}
          timeRange={timeRange}
          formatRate={formatRate}
          formatVol={formatVol}
          formatRtt={formatRtt}
          formatLoss={formatLoss}
          stats={stats}
        />
      )}
    </div>
  );
}

// ============================================
// GridSiteCard - Compact card for grid view
// ============================================

function GridSiteCard({
  site,
  timeRange,
  onEdit,
  chartType = "load",
  onOpenDetail,
}: {
  site: Site;
  timeRange: TimeRange;
  onEdit: () => void;
  chartType?: "load" | "latency";
  onOpenDetail?: () => void;
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
      <ResponsiveChart site={site} timeRange={timeRange} chartType={chartType} />
    </div>
  );
}

// ============================================
// ResponsiveChart wrapper
// ============================================

function ResponsiveChart({
  site,
  timeRange,
  chartType = "load",
}: {
  site: Site;
  timeRange: TimeRange;
  chartType?: "load" | "latency";
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
      {chartType === "latency" ? (
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
// DetailChartModal - Full detail view
// ============================================

function DetailChartModal({
  site,
  chartType,
  onClose,
  timeRange,
  formatRate,
  formatVol,
  formatRtt,
  formatLoss,
  stats,
}: {
  site: Site;
  chartType: "load" | "latency";
  onClose: () => void;
  timeRange: TimeRange;
  formatRate: (v: number | null) => string;
  formatVol: (v: number | null) => string;
  formatRtt: (v: number | null) => string;
  formatLoss: (v: number | null) => string;
  stats: (data: { timestamp: number; value: number }[]) => { cur: number | null; avg: number | null; max: number | null };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Calculate stats for legend
  const iface = site.interfaces[0];
  const loadStats = {
    in: stats(chartType === "load" ? iface.dataIn : []),
    out: stats(chartType === "load" ? iface.dataOut : []),
  };
  const pingStats = {
    rtt: stats(chartType === "latency" ? (iface.dataRtt || []) : []),
    loss: stats(chartType === "latency" ? (iface.dataLoss || []) : []),
  };

  // Calculate totals
  let totalInAvg = 0, totalInMax = 0, totalOutAvg = 0, totalOutMax = 0;
  let totalRttAvg = 0, totalRttMax = 0, totalLossAvg = 0, totalLossMax = 0;

  if (chartType === "load") {
    site.interfaces.forEach((i) => {
      const si = stats(i.dataIn);
      const so = stats(i.dataOut);
      totalInAvg += si.avg || 0;
      totalInMax += si.max || 0;
      totalOutAvg += so.avg || 0;
      totalOutMax += so.max || 0;
    });
  } else {
    site.interfaces.forEach((i) => {
      const sRtt = stats(i.dataRtt || []);
      const sLoss = stats(i.dataLoss || []);
      totalRttAvg += sRtt.avg || 0;
      totalRttMax += sRtt.max || 0;
      totalLossAvg += sLoss.avg || 0;
      totalLossMax += sLoss.max || 0;
    });
  }

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
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#141414",
          border: "1px solid #333",
          borderRadius: "4px",
          width: "95%",
          maxWidth: "1200px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 16px 64px rgba(0,0,0,0.9)",
        }}
      >
        {/* Chart Header */}
        <div
          style={{
            padding: "16px 24px",
            background: "#1e1e1e",
            borderBottom: "1px solid #333",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontSize: "14px",
              color: "#33cc00",
              margin: 0,
              fontWeight: 600,
            }}
          >
            {site.name} - {chartType === "load" ? "LOAD" : "LATENCY"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid #444",
              borderRadius: "3px",
              color: "#888",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {/* Chart Area */}
        <div ref={ref} style={{ padding: "24px", background: "#0b0f14" }}>
          {chartType === "latency" ? (
            <PingChart
              site={site}
              startTs={timeRange.start}
              endTs={timeRange.end}
              width={width}
              height={300}
            />
          ) : (
            <Chart
              site={site}
              startTs={timeRange.start}
              endTs={timeRange.end}
              width={width}
              height={300}
            />
          )}
        </div>

        {/* Legend Table */}
        <div
          style={{
            padding: "16px 24px",
            background: "#141414",
            borderTop: "1px solid #222",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              color: "#AAAAAA",
              marginBottom: "12px",
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            <div style={{ width: "120px" }}></div>
            <div style={{ width: "40px" }}></div>
            <div style={{ width: "100px", textAlign: "right" }}>Current</div>
            <div style={{ width: "100px", textAlign: "right" }}>Average</div>
            <div style={{ width: "100px", textAlign: "right" }}>Maximum</div>
            <div style={{ width: "100px", textAlign: "right" }}>Total</div>
          </div>

          {/* Interface Rows */}
          {chartType === "load" ? (
            site.interfaces.map((iface) => {
              const si = stats(iface.dataIn);
              const so = stats(iface.dataOut);
              return (
                <React.Fragment key={iface.id}>
                  {/* IN Row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "4px",
                      fontSize: "11px",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    <div
                      style={{
                        width: "120px",
                        color: "#AAAAAA",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          background: iface.colorIn,
                        }}
                      />
                      {iface.name}
                    </div>
                    <div style={{ width: "40px", color: "#AAAAAA" }}>In</div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatRate(si.cur)}
                    </div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatRate(si.avg)}
                    </div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatRate(si.max)}
                    </div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatVol(si.avg)}
                    </div>
                  </div>

                  {/* OUT Row */}
                  {site.type === "traffic" && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "8px",
                        fontSize: "11px",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      <div
                        style={{
                          width: "120px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            background: iface.colorOut,
                          }}
                        />
                      </div>
                      <div style={{ width: "40px", color: "#AAAAAA" }}>Out</div>
                      <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                        {formatRate(so.cur)}
                      </div>
                      <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                        {formatRate(so.avg)}
                      </div>
                      <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                        {formatRate(so.max)}
                      </div>
                      <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                        {formatVol(so.avg)}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            site.interfaces.map((iface) => {
              const sRtt = stats(iface.dataRtt || []);
              const sLoss = stats(iface.dataLoss || []);
              return (
                <React.Fragment key={iface.id}>
                  {/* RTT Row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "4px",
                      fontSize: "11px",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    <div
                      style={{
                        width: "120px",
                        color: "#AAAAAA",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          background: "#00ff88",
                        }}
                      />
                      {iface.name}
                    </div>
                    <div style={{ width: "40px", color: "#00ff88" }}>RTT</div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatRtt(sRtt.cur)}
                    </div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatRtt(sRtt.avg)}
                    </div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatRtt(sRtt.max)}
                    </div>
                  </div>

                  {/* Loss Row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "8px",
                      fontSize: "11px",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    <div
                      style={{
                        width: "120px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          background: "#ff4444",
                        }}
                      />
                    </div>
                    <div style={{ width: "40px", color: "#ff4444" }}>Loss</div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatLoss(sLoss.cur)}
                    </div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatLoss(sLoss.avg)}
                    </div>
                    <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                      {formatLoss(sLoss.max)}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}

          {/* Total Section */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px dashed #333",
            }}
          >
            {chartType === "load" ? (
              <>
                {/* Total IN */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "4px",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  <div
                    style={{
                      width: "120px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#AAAAAA",
                    }}
                  >
                    <div style={{ width: "12px", height: "12px", background: "#FFFFFF" }} />
                    Total
                  </div>
                  <div style={{ width: "40px", color: "#AAAAAA" }}>In</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>-</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatRate(totalInAvg)}
                  </div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatRate(totalInMax)}
                  </div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatVol(totalInAvg)}
                  </div>
                </div>

                {/* Total OUT */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "4px",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  <div
                    style={{
                      width: "120px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div style={{ width: "12px", height: "12px", background: "#AAAAAA" }} />
                  </div>
                  <div style={{ width: "40px", color: "#AAAAAA" }}>Out</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>-</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatRate(totalOutAvg)}
                  </div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatRate(totalOutMax)}
                  </div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatVol(totalOutAvg)}
                  </div>
                </div>

                {/* Total Agg */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "4px",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  <div
                    style={{
                      width: "120px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div style={{ width: "12px", height: "12px", background: "#FFFFFF" }} />
                  </div>
                  <div style={{ width: "40px", color: "#AAAAAA" }}>Agg</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>-</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatRate(totalInAvg + totalOutAvg)}
                  </div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatRate(totalInMax + totalOutMax)}
                  </div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatVol(totalInAvg + totalOutAvg)}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Total RTT */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "4px",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  <div
                    style={{
                      width: "120px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#AAAAAA",
                    }}
                  >
                    <div style={{ width: "12px", height: "12px", background: "#FFFFFF" }} />
                    Total
                  </div>
                  <div style={{ width: "40px", color: "#00ff88" }}>RTT</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>-</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatRtt(totalRttAvg)}
                  </div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatRtt(totalRttMax)}
                  </div>
                </div>

                {/* Total Loss */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "4px",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  <div
                    style={{
                      width: "120px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div style={{ width: "12px", height: "12px", background: "#AAAAAA" }} />
                  </div>
                  <div style={{ width: "40px", color: "#ff4444" }}>Loss</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>-</div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatLoss(totalLossAvg)}
                  </div>
                  <div style={{ width: "100px", textAlign: "right", color: "#AAAAAA" }}>
                    {formatLoss(totalLossMax)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
