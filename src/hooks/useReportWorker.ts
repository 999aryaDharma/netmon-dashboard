import { saveAs } from "file-saver";

/**
 * Hook untuk menggunakan Report Worker
 * Menjalankan report generation di background thread
 * Tidak terpengaruh oleh tab visibility
 */
export function useReportWorker() {
  const generateReportAsync = (
    type: "weekly" | "banten",
    payload: any,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Buat worker instance baru dengan ?worker dan { type: "module" } untuk Vite ES6 import
        const worker = new Worker(
          new URL("../workers/reportWorker.ts?worker", import.meta.url),
          { type: "module" },
        );

        // Setup timeout untuk mencegah infinite hanging
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error("Worker timeout - report generation took too long"));
        }, 600000); // 10 menit timeout

        // Handle message dari worker
        const handleMessage = (event: MessageEvent) => {
          clearTimeout(timeout);
          const { type: msgType, data, error } = event.data;

          if (msgType === "REPORT_READY") {
            // Save file ke user
            const { blob, filename } = data;
            console.log(`[Worker] Report ready: ${filename}`);
            saveAs(blob, filename);
            worker.terminate();
            resolve();
          } else if (msgType === "ERROR") {
            console.error("[Worker] Error message:", error);
            worker.terminate();
            reject(new Error(`Worker error: ${error}`));
          }
        };

        const handleError = (error: ErrorEvent) => {
          clearTimeout(timeout);
          console.error("[Worker] Runtime error:", error.message);
          worker.terminate();
          reject(new Error(`Worker runtime error: ${error.message}`));
        };

        worker.onmessage = handleMessage;
        worker.onerror = handleError;

        console.log(`[Worker] Starting report generation: ${type}`);
        // Send task ke worker
        worker.postMessage({
          type:
            type === "weekly"
              ? "GENERATE_WEEKLY_REPORT"
              : "GENERATE_BANTEN_REPORT",
          payload,
        });
      } catch (error) {
        console.error("[Worker] Failed to create or start worker:", error);
        reject(new Error(`Failed to create worker: ${error}`));
      }
    });
  };

  return { generateReportAsync };
}
