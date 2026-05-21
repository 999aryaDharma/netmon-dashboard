import type { Site, SiteInterface } from "../types";
import { getRenderer } from "../renderers/RendererFactory";
import { mergeData } from "./siteHelpers";

export function createETLEBaliSite(
  name: string,
  index: number,
  existingSites?: Site[],
  customStartTs?: number,
  customEndTs?: number,
): { loadSite: Site } {
  const now = customEndTs ?? Date.now();
  const startTs = customStartTs ?? now - 365 * 24 * 3_600_000;
  const interval = 60 * 60 * 1000; // 1 jam
  const axisMax = 15.0; // Y axis: 0, 5, 10, 15

  const existingLoadId = `load-etle-${index}-${name
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
  const existingLoad = existingSites?.find((s) => s.id === existingLoadId);

  const nameHash =
    name.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0) >>> 0;

  // Gunakan ETLERenderer — SAMA seperti createBaliSites pakai BaliRenderer
  const renderer = getRenderer("etle");
  const colorPalette = renderer.getColorPalette();
  const interfaceProfiles = renderer.getInterfaceProfiles(axisMax, name);

  const interfaces: SiteInterface[] = interfaceProfiles.map((profile, i) => {
    const seed = index * 7919 + i * 1337 + nameHash;

    const generatedData = renderer.generateInterfaceData(
      profile,
      startTs,
      now,
      seed,
      interval,
      axisMax,
      name,
    );

    return {
      id: existingLoad?.interfaces[i]?.id || `iface-etle-${index}-${i}`,
      name: profile.name,
      colorIn: colorPalette.interfaces[i]?.in || "#EACC00",
      colorOut: colorPalette.interfaces[i]?.out || "#EACC00",
      dataIn: mergeData(
        existingLoad?.interfaces[i]?.dataIn || [],
        generatedData.dataIn,
      ),
      dataOut: [],
    };
  });

  const loadSite: Site = {
    id: existingLoadId,
    name: `${name} - Load Average`,
    type: "latency",
    unit: "load",
    axisMax,
    interfaces,
    region: "etle",
    graphType: "load",
  };

  return { loadSite };
}
