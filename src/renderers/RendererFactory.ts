import { IChartRenderer } from "./ChartRenderer";
import { BaliRenderer } from "./BaliRenderer";
import { BantenRenderer } from "./BantenRenderer";
import { ETLERenderer } from "./ETLERenderer";

/**
 * Renderer Factory
 * Mengembalikan renderer yang sesuai berdasarkan region
 */
export class RendererFactory {
  private static baliRenderer: BaliRenderer | null = null;
  private static bantenRenderer: BantenRenderer | null = null;
  private static etleRenderer: ETLERenderer | null = null;

  static getRenderer(
    region: "bali" | "banten" | "etle" | undefined,
  ): IChartRenderer {
    if (region === "banten") {
      if (!this.bantenRenderer) {
        this.bantenRenderer = new BantenRenderer();
      }
      return this.bantenRenderer;
    }

    if (region === "etle") {
      if (!this.etleRenderer) {
        this.etleRenderer = new ETLERenderer();
      }
      return this.etleRenderer;
    }

    // Default ke Bali
    if (!this.baliRenderer) {
      this.baliRenderer = new BaliRenderer();
    }
    return this.baliRenderer;
  }

  static getBaliRenderer(): BaliRenderer {
    if (!this.baliRenderer) {
      this.baliRenderer = new BaliRenderer();
    }
    return this.baliRenderer;
  }

  static getBantenRenderer(): BantenRenderer {
    if (!this.bantenRenderer) {
      this.bantenRenderer = new BantenRenderer();
    }
    return this.bantenRenderer;
  }
}

/**
 * Helper function untuk mendapatkan renderer
 */
export function getRenderer(
  region?: "bali" | "banten" | "etle",
): IChartRenderer {
  return RendererFactory.getRenderer(region);
}
