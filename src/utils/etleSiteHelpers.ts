import type { Site, SiteInterface } from "../types";
import { getRenderer } from "../renderers/RendererFactory";
import { mergeData } from "./siteHelpers";

/**
 * Create ETLE Bali Site - Load Average Monitoring
 * Each site has 3 interfaces: 1min, 5min, 15min load averages
 * Data is generated as stacked load metrics
 */
export function createETLEBaliSite(
  name: string,
  index: number,
  existingSites?: Site[],
  customStartTs?: number,
  customEndTs?: number,
): { loadSite: Site } {
  const region = "etle";
  const now = customEndTs ?? Date.now();
  // 1 Year of history
  const startTs = customStartTs ?? now - 365 * 24 * 3_600_000;
  // 1 hour interval for load data
  const interval = 60 * 60 * 1000;

  // ETLE sites are unidirectional (load average only, no bidirectional traffic)
  // Typical max load: 4.0 for quad-core, but we'll allow up to 8.0 for flexibility
  const axisMaxLoad = 8.0; // Load average max (in units, not bps)

  // Check existing site
  const existingLoadId = `load-etle-${index}-${name.toLowerCase().replace(/\s+/g, "-")}`;
  const existingLoad = existingSites?.find((s) => s.id === existingLoadId);

  // Get ETLE renderer for color palette and interface profiles
  const renderer = getRenderer("etle");
  const colorPalette = renderer.getColorPalette();
  const interfaceProfiles = renderer.getInterfaceProfiles(axisMaxLoad, name);

  // Generate interfaces (1min, 5min, 15min load averages)
  const interfaces: SiteInterface[] = interfaceProfiles.map((profile, i) => {
    // Unique seed for each site and interface
    const nameHash =
      name.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0) >>> 0;
    const inSeed = index * 7919 + i * 1337 + nameHash;

    // Generate interface data using ETLE renderer
    const generatedData = renderer.generateInterfaceData(
      profile,
      startTs,
      now,
      inSeed,
      interval,
      axisMaxLoad,
      name,
    );

    return {
      id: existingLoad?.interfaces[i]?.id || `iface-etle-${index}-${i}`,
      name: profile.name,
      colorIn: colorPalette.interfaces[i]?.in || "#F4E4A6",
      colorOut: colorPalette.interfaces[i]?.out || "#F4E4A6",
      dataIn: mergeData(
        existingLoad?.interfaces[i]?.dataIn || [],
        generatedData.dataIn,
      ),
      dataOut: mergeData(
        existingLoad?.interfaces[i]?.dataOut || [],
        generatedData.dataOut,
      ),
    };
  });

  // Create the load site
  const loadSite: Site = {
    id: existingLoadId,
    name: `${name} - Load Average`,
    type: "latency", // Use latency type for unidirectional data
    unit: "load",
    axisMax: axisMaxLoad,
    interfaces,
    region: "etle" as any, // Store as "etle" region
    graphType: "load", // Explicitly mark as load graph (unidirectional)
  };

  return { loadSite };
}
