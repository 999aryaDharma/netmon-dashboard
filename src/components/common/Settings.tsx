import React, { useState, useRef } from "react";
import { changePassword } from "../../utils/auth";
import { useApp } from "../../store/AppContext";

export function Settings({ onClose }: { onClose: () => void }) {
  const { clearAllData, regenerateRegionData, exportData, importData } =
    useApp();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [regenLoading, setRegenLoading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const changePw = async () => {
    setMsg("");
    setErr("");
    if (newPw.length < 6) {
      setErr("Min 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setErr("Passwords do not match.");
      return;
    }
    await changePassword(newPw);
    setNewPw("");
    setConfirmPw("");
    setMsg("Password updated.");
  };

  const doRegenRegion = async (region: "bali" | "banten" | "etle" | "all") => {
    const labels: Record<string, string> = {
      bali: "Bali (MRTG)",
      banten: "Banten (Zabbix)",
      etle: "ETLE Load Average",
      all: "Semua Region",
    };
    if (
      !confirm(
        `Regenerate data untuk ${labels[region]}?\nData region lain tidak terpengaruh.`,
      )
    )
      return;
    setMsg("");
    setErr("");
    setRegenLoading(region);
    try {
      const success = await regenerateRegionData(region);
      if (success) setMsg(`✓ Berhasil regenerate ${labels[region]}!`);
      else setErr(`Gagal regenerate ${labels[region]}.`);
    } finally {
      setRegenLoading(null);
    }
  };

  const doExport = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `netmon-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await importData(await f.text());
      alert("Imported.");
    } catch {
      alert("Invalid file.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const inp: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: "#0e0e0e",
    border: "1px solid #2a2a2a",
    borderRadius: "2px",
    color: "#ccc",
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "12px",
    padding: "7px 10px",
    outline: "none",
  };

  const regionBtns: {
    region: "bali" | "banten" | "etle" | "all";
    label: string;
    color: string;
  }[] = [
    { region: "bali", label: "🌴 Bali (MRTG)", color: "#33cc00" },
    { region: "banten", label: "🏭 Banten (Zabbix)", color: "#33ccff" },
    { region: "etle", label: "📡 ETLE (Load Average)", color: "#ffaa00" },
    { region: "all", label: "📦 Semua Region", color: "#cc66ff" },
  ];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      <div
        style={{
          width: "440px",
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "3px",
        }}
      >
        <div
          style={{
            padding: "13px 18px",
            borderBottom: "1px solid #222",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "#33cc00",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#555",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "13px",
            }}
          >
            x
          </button>
        </div>

        <div
          style={{
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Feedback messages */}
          {msg && (
            <div
              style={{
                fontSize: "11px",
                color: "#33cc00",
                padding: "6px 10px",
                background: "#0a1a0a",
                border: "1px solid #1a3a1a",
                borderRadius: "2px",
              }}
            >
              {msg}
            </div>
          )}
          {err && (
            <div
              style={{
                fontSize: "11px",
                color: "#cc3333",
                padding: "6px 10px",
                background: "#1a0a0a",
                border: "1px solid #3a1a1a",
                borderRadius: "2px",
              }}
            >
              {err}
            </div>
          )}

          {/* Change Password */}
          <section>
            <div style={sL}>Change Password</div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <input
                type="password"
                placeholder="New password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                style={inp}
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                style={inp}
              />
              <button onClick={changePw} style={aBtn("#33cc00")}>
                Update Password
              </button>
            </div>
          </section>

          <div style={{ height: "1px", background: "#1e1e1e" }} />

          {/* Backup / Restore */}
          <section>
            <div style={sL}>Backup / Restore</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={doExport} style={aBtn("#33cc00")}>
                Export JSON
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  ...aBtn("#33cc00"),
                  background: "none",
                  borderColor: "#333",
                  color: "#666",
                }}
              >
                Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                onChange={doImport}
                style={{ display: "none" }}
              />
            </div>
          </section>

          <div style={{ height: "1px", background: "#1e1e1e" }} />

          {/* Regenerate per Region */}
          <section>
            <div style={sL}>Regenerate Full Year Data</div>
            <div
              style={{
                fontSize: "10px",
                color: "#555",
                marginBottom: "12px",
                lineHeight: "1.6",
              }}
            >
              Pilih region yang ingin di-regenerate. <br />
              Data region lain{" "}
              <span style={{ color: "#888" }}>tidak akan terpengaruh</span>.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              {regionBtns.map(({ region, label, color }) => {
                const isLoading = regenLoading === region;
                const isDisabled = regenLoading !== null;
                return (
                  <button
                    key={region}
                    onClick={() => doRegenRegion(region)}
                    disabled={isDisabled}
                    style={{
                      padding: "10px 12px",
                      background: isLoading ? color + "11" : "none",
                      border: `1px solid ${isDisabled ? "#333" : color + "99"}`,
                      borderRadius: "2px",
                      color: isDisabled ? "#444" : color,
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "11px",
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    {isLoading ? `⟳ Generating...` : label}
                  </button>
                );
              })}
            </div>
            {regenLoading && (
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "10px",
                  color: "#555",
                  textAlign: "center",
                }}
              >
                Sedang memproses data, harap tunggu...
              </div>
            )}
          </section>

          <div style={{ height: "1px", background: "#1e1e1e" }} />

          {/* Danger Zone */}
          <section>
            <div style={{ ...sL, color: "#773333" }}>Danger Zone</div>
            <button
              onClick={async () => {
                if (confirm("Delete ALL data? Semua site akan hilang."))
                  await clearAllData();
              }}
              style={{
                ...aBtn("#aa3333"),
                background: "none",
                borderColor: "#441111",
              }}
            >
              Reset All Data
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

const sL: React.CSSProperties = {
  fontSize: "10px",
  color: "#555",
  letterSpacing: "2px",
  textTransform: "uppercase",
  marginBottom: "10px",
};

function aBtn(color: string): React.CSSProperties {
  return {
    padding: "7px 14px",
    background: "#0a1a0a",
    border: `1px solid ${color}`,
    borderRadius: "2px",
    color,
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "11px",
    cursor: "pointer",
  };
}
  