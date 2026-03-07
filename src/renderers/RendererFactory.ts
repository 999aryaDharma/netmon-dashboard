import { IChartRenderer } from "./ChartRenderer";
import { BaliRenderer } from "./BaliRenderer";
import { BantenRenderer } from "./BantenRenderer";

/**
 * Renderer Factory
 * Mengembalikan renderer yang sesuai berdasarkan region
 */
export class RendererFactory {
  private static baliRenderer: BaliRenderer | null = null;
  private static bantenRenderer: BantenRenderer | null = null;

  static getRenderer(region: 'bali' | 'banten' | undefined): IChartRenderer {
    if (region === 'banten') {
      if (!this.bantenRenderer) {
        this.bantenRenderer = new BantenRenderer();
      }
      return this.bantenRenderer;
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
export function getRenderer(region?: 'bali' | 'banten'): IChartRenderer {
  return RendererFactory.getRenderer(region);
}
