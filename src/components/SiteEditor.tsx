import React, { useState } from "react";
import type { Site, SiteInterface, SiteType } from "../types";
import { useApp } from "../store/AppContext";
import { generateSmoothData, generatePingData } from "../utils/dataGen";

interface SiteEditorProps {
  site?: Site;
  onClose: () => void;
}

// Warna Palette Traffic - Hijau (IN) dan Ungu (OUT)
const INTERFACE_PALETTE = [
  { in: "#B6FF00", out: "#CC77FF" }, // ether1
  { in: "#00FF00", out: "#9933FF" }, // ether2
  { in: "#00CC00", out: "#6600CC" }, // ether3
  { in: "#009900", out: "#330099" }, // ether4
  { in: "#005500", out: "#110055" }, // ether5
  { in: "#002200", out: "#000033" }, // LAN
];

// Warna Palette Latency - RTT (IN) dan Loss (OUT)
const LATENCY_PALETTE = {
  in: "#CECECE", // RTT - abu-abu terang
  out: "#FF0000", // Loss - merah
};

function newSite(): Site {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: "New Router",
    type: "traffic",
    unit: "bps",
    axisMax: 20000000,
    interfaces: [newInterface(0)],
  };
}

function newInterface(index: number, type: SiteType = "traffic"): SiteInterface {
  let colors: { in: string; out: string };

  if (type === "ping") {
    colors = LATENCY_PALETTE;
  } else {
    colors = INTERFACE_PALETTE[index % INTERFACE_PALETTE.length];
  }

  let defaultName = `ether${index + 1}`;
  if (index === 5) defaultName = "LAN";

  const base: SiteInterface = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: defaultName,
    colorIn: colors.in,
    colorOut: colors.out,
    dataIn: [],
    dataOut: [],
  };

  if (type === "ping") {
    base.dataRtt = [];
    base.dataLoss = [];
  }

  return base;
}

const inp: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#111",
  border: "1px solid #2a2a2a",
  borderRadius: "2px",
  color: "#ccc",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "12px",
  padding: "7px 10px",
  outline: "none",
};
const lbl: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  color: "#555",
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  marginBottom: "4px",
};
const primaryBtn: React.CSSProperties = {
  background: "#0a2a1a",
  border: "1px solid #33cc00",
  borderRadius: "2px",
  color: "#33cc00",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "11px",
  padding: "7px 14px",
  cursor: "pointer",
  letterSpacing: "1px",
};
const ghostBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid #2a2a2a",
  borderRadius: "2px",
  color: "#555",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "11px",
  padding: "6px 12px",
  cursor: "pointer",
};

export function SiteEditor({ site, onClose }: SiteEditorProps) {
  const { addSite, updateSite, deleteSite } = useApp();
  const isNew = !site;
  const [form, setForm] = useState<Site>(site ?? newSite());
  const [tab, setTab] = useState<"config" | "interfaces">("config");
  const [selectedIfaceId, setSelectedIfaceId] = useState<string>(
    (site?.interfaces[0] ?? newInterface(0)).id,
  );
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [genStart, setGenStart] = useState(weekAgo.toISOString().slice(0, 16));
  const [genEnd, setGenEnd] = useState(now.toISOString().slice(0, 16));

  // State untuk Input Manual Data Point
  const [manualTime, setManualTime] = useState(now.toISOString().slice(0, 16));
  const [manualValIn, setManualValIn] = useState<number>(0);
  const [manualValOut, setManualValOut] = useState<number>(0);
  const [manualRtt, setManualRtt] = useState<number>(0);
  const [manualLoss, setManualLoss] = useState<number>(0);

  const setField = (k: keyof Site, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const selectedIface =
    form.interfaces.find((i) => i.id === selectedIfaceId) ?? form.interfaces[0];

  const updateIface = (updated: SiteInterface) => {
    setForm((f) => ({
      ...f,
      interfaces: f.interfaces.map((i) => (i.id === updated.id ? updated : i)),
    }));
  };

  const addIface = () => {
    const nextIndex = form.interfaces.length;
    const iface = newInterface(nextIndex);
    setForm((f) => ({ ...f, interfaces: [...f.interfaces, iface] }));
    setSelectedIfaceId(iface.id);
  };

  const removeIface = (id: string) => {
    if (form.interfaces.length <= 1)
      return alert("At least one interface is required.");
    setForm((f) => ({
      ...f,
      interfaces: f.interfaces.filter((i) => i.id !== id),
    }));
    setSelectedIfaceId(form.interfaces.find((i) => i.id !== id)?.id ?? "");
  };

  const generateData = (ifaceId: string, series: "in" | "out" | "both" | "rtt_loss") => {
    const s = new Date(genStart).getTime();
    const e = new Date(genEnd).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) return alert("Invalid date range");

    const iface = form.interfaces.find((i) => i.id === ifaceId);
    if (!iface) return;
    const max = form.axisMax;
    const updated = { ...iface };

    if (form.type === "ping") {
      const { rtt, loss } = generatePingData(s, e, {
        baseRtt: max * 0.2,
        variance: max * 0.1,
        seed: iface.name.length * 1000,
      });
      updated.dataRtt = rtt;
      updated.dataLoss = loss;
    } else {
      if (series === "in" || series === "both")
        updated.dataIn = generateSmoothData(s, e, max * 0.1, max * 0.4);
      if (series === "out" || series === "both")
        updated.dataOut = generateSmoothData(s, e, max * 0.05, max * 0.2);
    }

    updateIface(updated);
    alert("Data generated! Please Save the site.");
  };

  const generateAllInterfaces = () => {
    const s = new Date(genStart).getTime();
    const e = new Date(genEnd).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) return alert("Invalid date range");

    const max = form.axisMax;
    const count = form.interfaces.length;

    if (form.type === "ping") {
      setForm((f) => ({
        ...f,
        interfaces: f.interfaces.map((iface, idx) => {
          const { rtt, loss } = generatePingData(s, e, {
            baseRtt: max * 0.2 * (1 + idx * 0.1),
            variance: max * 0.1,
            seed: idx * 1000,
          });
          return {
            ...iface,
            dataRtt: rtt,
            dataLoss: loss,
          };
        }),
      }));
    } else {
      setForm((f) => ({
        ...f,
        interfaces: f.interfaces.map((iface, idx) => {
          const share = max / count;
          const inMin = share * (0.3 + idx * 0.05);
          const inMax = share * (0.7 + idx * 0.05);
          return {
            ...iface,
            dataIn: generateSmoothData(s, e, inMin, Math.min(inMax, share)),
            dataOut: generateSmoothData(s, e, share * 0.02, share * 0.15),
          };
        }),
      }));
    }
    alert("Data for all interfaces generated! Remember to click 'Save'.");
  };

  // Fungsi untuk menambahkan manual data point
  const addManualData = () => {
    if (!selectedIface) return;
    const ts = new Date(manualTime).getTime();
    if (isNaN(ts)) return alert("Invalid time format");

    const updated = { ...selectedIface };

    if (form.type === "ping") {
      updated.dataRtt = [...(updated.dataRtt || []), { timestamp: ts, value: manualRtt }]
        .sort((a, b) => a.timestamp - b.timestamp);
      updated.dataLoss = [...(updated.dataLoss || []), { timestamp: ts, value: manualLoss }]
        .sort((a, b) => a.timestamp - b.timestamp);
    } else {
      updated.dataIn = [...(updated.dataIn || []), { timestamp: ts, value: manualValIn }]
        .sort((a, b) => a.timestamp - b.timestamp);
      if (form.type === "traffic") {
        updated.dataOut = [...(updated.dataOut || []), { timestamp: ts, value: manualValOut }]
          .sort((a, b) => a.timestamp - b.timestamp);
      }
    }

    updateIface(updated);
    alert("Data point added! Remember to click 'Save' below.");
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Site name required.");
    setSaving(true);
    isNew ? await addSite(form) : await updateSite(form);
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!site) return;
    if (!confirm(`Delete "${site.name}"?`)) return;
    await deleteSite(site.id);
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      <div
        style={{
          width: "540px",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#0e0e0e",
          border: "1px solid #222",
          borderRadius: "3px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.95)",
        }}
      >
        <div
          style={{
            padding: "13px 18px",
            borderBottom: "1px solid #1e1e1e",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "#33cc00",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            {isNew ? "Add Site" : "Edit Site"}
          </span>
          <button
            onClick={onClose}
            style={{ ...ghostBtn, padding: "2px 8px", fontSize: "13px" }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #1e1e1e" }}>
          {(["config", "interfaces"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "9px",
                background: "none",
                border: "none",
                borderBottom:
                  tab === t ? "2px solid #33cc00" : "2px solid transparent",
                color: tab === t ? "#33cc00" : "#444",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "10px",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {t === "config"
                ? "Site Config"
                : `Interfaces (${form.interfaces.length})`}
            </button>
          ))}
        </div>

        <div
          style={{
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {tab === "config" && (
            <>
              <div>
                <span style={lbl}>Site Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  style={inp}
                />
              </div>
              <div>
                <span style={lbl}>Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setField("type", e.target.value as SiteType)}
                  style={inp}
                >
                  <option value="traffic">Traffic (Bidirectional)</option>
                  <option value="latency">Load Single Metric</option>
                  <option value="ping">Ping (RTT + Loss)</option>
                </select>
              </div>
              <div>
                <span style={lbl}>Unit</span>
                <select
                  value={form.unit}
                  onChange={(e) => setField("unit", e.target.value)}
                  style={inp}
                >
                  <option value="bps">bps (bits per second)</option>
                  <option value="Mbps">Mbps (Megabits)</option>
                  <option value="ms">ms</option>
                  <option value="%">%</option>
                </select>
              </div>
              <div>
                <span style={lbl}>
                  Y Axis Max — total stacked ({form.unit})
                </span>
                <input
                  type="number"
                  value={form.axisMax}
                  onChange={(e) => setField("axisMax", +e.target.value)}
                  style={inp}
                />
              </div>

              <div
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #1e1e1e",
                  borderRadius: "2px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <span style={{ ...lbl, marginBottom: 0 }}>
                  Bulk Generate — All Interfaces
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <input
                    type="datetime-local"
                    value={genStart}
                    onChange={(e) => setGenStart(e.target.value)}
                    style={inp}
                  />
                  <input
                    type="datetime-local"
                    value={genEnd}
                    onChange={(e) => setGenEnd(e.target.value)}
                    style={inp}
                  />
                </div>
                <button onClick={generateAllInterfaces} style={primaryBtn}>
                  Generate All Interfaces
                </button>
              </div>
            </>
          )}

          {tab === "interfaces" && (
            <>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {form.interfaces.map((iface) => (
                  <button
                    key={iface.id}
                    onClick={() => setSelectedIfaceId(iface.id)}
                    style={{
                      padding: "5px 12px",
                      cursor: "pointer",
                      borderRadius: "2px",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "11px",
                      background:
                        selectedIfaceId === iface.id ? "#1a1a1a" : "none",
                      border:
                        selectedIfaceId === iface.id
                          ? `1px solid ${iface.colorIn}`
                          : "1px solid #2a2a2a",
                      color:
                        selectedIfaceId === iface.id ? iface.colorIn : "#555",
                    }}
                  >
                    {iface.name}
                  </button>
                ))}
                <button
                  onClick={addIface}
                  style={{
                    ...ghostBtn,
                    padding: "4px 10px",
                    color: "#33cc00",
                    borderColor: "#33cc0066",
                  }}
                >
                  + Add
                </button>
              </div>

              {selectedIface && (
                <div
                  style={{
                    border: "1px solid #1e1e1e",
                    borderRadius: "2px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div>
                    <span style={lbl}>Interface Name</span>
                    <input
                      value={selectedIface.name}
                      onChange={(e) =>
                        updateIface({ ...selectedIface, name: e.target.value })
                      }
                      style={inp}
                    />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <span style={lbl}>Color IN</span>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="color"
                          value={selectedIface.colorIn}
                          onChange={(e) =>
                            updateIface({
                              ...selectedIface,
                              colorIn: e.target.value,
                            })
                          }
                          style={{
                            width: "34px",
                            height: "30px",
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "11px",
                            color: selectedIface.colorIn,
                          }}
                        >
                          {selectedIface.colorIn}
                        </span>
                      </div>
                    </div>
                    {form.type === "traffic" && (
                      <div>
                        <span style={lbl}>Color OUT</span>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="color"
                            value={selectedIface.colorOut}
                            onChange={(e) =>
                              updateIface({
                                ...selectedIface,
                                colorOut: e.target.value,
                              })
                            }
                            style={{
                              width: "34px",
                              height: "30px",
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                            }}
                          />
                          <span
                            style={{
                              fontSize: "11px",
                              color: selectedIface.colorOut,
                            }}
                          >
                            {selectedIface.colorOut}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      background: "#0a0a0a",
                      border: "1px solid #1a1a1a",
                      borderRadius: "2px",
                      fontSize: "11px",
                      color: "#444",
                    }}
                  >
                    {form.type === "ping" ? (
                      <>
                        <span style={{ color: "#00ff88" }}>
                          RTT: {selectedIface.dataRtt?.length.toLocaleString()} pts
                        </span>
                        <span
                          style={{
                            color: "#ff4444",
                            marginLeft: "16px",
                          }}
                        >
                          Loss: {selectedIface.dataLoss?.length.toLocaleString()} pts
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: selectedIface.colorIn }}>
                          IN: {selectedIface.dataIn.length.toLocaleString()} pts
                        </span>
                        {form.type === "traffic" && (
                          <span
                            style={{
                              color: selectedIface.colorOut,
                              marginLeft: "16px",
                            }}
                          >
                            OUT: {selectedIface.dataOut.length.toLocaleString()} pts
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <span style={lbl}>Generate Range</span>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                      }}
                    >
                      <input
                        type="datetime-local"
                        value={genStart}
                        onChange={(e) => setGenStart(e.target.value)}
                        style={inp}
                      />
                      <input
                        type="datetime-local"
                        value={genEnd}
                        onChange={(e) => setGenEnd(e.target.value)}
                        style={inp}
                      />
                    </div>
                    {form.type === "ping" ? (
                      <button
                        onClick={() => generateData(selectedIface.id, "rtt_loss")}
                        style={primaryBtn}
                      >
                        Generate RTT + Loss
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => generateData(selectedIface.id, "both")}
                          style={primaryBtn}
                        >
                          Generate In + Out
                        </button>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "8px",
                          }}
                        >
                          <button
                            onClick={() => generateData(selectedIface.id, "in")}
                            style={{
                              ...ghostBtn,
                              color: selectedIface.colorIn,
                              borderColor: selectedIface.colorIn + "55",
                            }}
                          >
                            Regen IN
                          </button>
                          <button
                            onClick={() => generateData(selectedIface.id, "out")}
                            style={{
                              ...ghostBtn,
                              color: selectedIface.colorOut,
                              borderColor: selectedIface.colorOut + "55",
                            }}
                          >
                            Regen OUT
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* --- BLOK MANUAL INPUT --- */}
                  <div
                    style={{
                      marginTop: "16px",
                      paddingTop: "12px",
                      borderTop: "1px dashed #333",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <span style={{ ...lbl, color: "#33cc00", textTransform: "none", fontWeight: 600 }}>
                      ⚡ Insert Single Data Point (Manual)
                    </span>
                    <input
                      type="datetime-local"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      style={inp}
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {form.type === "ping" ? (
                        <>
                          <div>
                            <span style={lbl}>RTT (ms)</span>
                            <input
                              type="number"
                              value={manualRtt}
                              onChange={(e) => setManualRtt(+e.target.value)}
                              style={{ ...inp, color: "#00ff88" }}
                            />
                          </div>
                          <div>
                            <span style={lbl}>Loss (%)</span>
                            <input
                              type="number"
                              value={manualLoss}
                              onChange={(e) => setManualLoss(+e.target.value)}
                              style={{ ...inp, color: "#ff4444" }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span style={lbl}>IN Value ({form.unit})</span>
                            <input
                              type="number"
                              value={manualValIn}
                              onChange={(e) => setManualValIn(+e.target.value)}
                              style={{ ...inp, color: selectedIface.colorIn }}
                            />
                          </div>
                          {form.type === "traffic" && (
                            <div>
                              <span style={lbl}>OUT Value ({form.unit})</span>
                              <input
                                type="number"
                                value={manualValOut}
                                onChange={(e) => setManualValOut(+e.target.value)}
                                style={{ ...inp, color: selectedIface.colorOut }}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <button
                      onClick={addManualData}
                      style={{
                        ...ghostBtn,
                        color: "#33cc00",
                        borderColor: "#004400",
                        background: "#051105",
                        marginTop: "4px",
                      }}
                    >
                      + Add Manual Point
                    </button>
                  </div>
                  {/* --- AKHIR BLOK MANUAL INPUT --- */}

                  {form.interfaces.length > 1 && (
                    <button
                      onClick={() => removeIface(selectedIface.id)}
                      style={{
                        ...ghostBtn,
                        color: "#993333",
                        borderColor: "#330000",
                        marginTop: "4px",
                      }}
                    >
                      Remove Interface
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: "13px 18px",
            borderTop: "1px solid #1e1e1e",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            {!isNew && (
              <button
                onClick={handleDelete}
                style={{ ...ghostBtn, color: "#993333" }}
              >
                Delete Site
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={onClose} style={ghostBtn}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={primaryBtn}>
              {saving ? "Saving..." : isNew ? "Create" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
