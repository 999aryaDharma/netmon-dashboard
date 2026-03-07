// @ts-ignore
import PizZip from "pizzip";
// @ts-ignore
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";

/**
 * Web Worker untuk Report Generation
 * Menjalankan proses berat di background thread yang tidak terpengaruh tab visibility
 * Ini memungkinkan proses tetap berjalan bahkan ketika user pindah ke tab lain
 */

// Deklarasi Worker context untuk TypeScript
declare const self: Worker;

// Helper mengubah string Base64 dari canvas menjadi buffer biner
function base64Parser(dataURL: string) {
  const base64Regex = /^data:image\/(png|jpg|jpeg|svg|svg\+xml);base64,/;
  if (!base64Regex.test(dataURL)) return false;

  const stringBase64 = dataURL.replace(base64Regex, "");
  const binaryString = atob(stringBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Handle message dari main thread
self.onmessage = async (event) => {
  const { type, payload } = event.data;

  console.log(`[Web Worker] Received message: ${type}`);

  try {
    if (type === "GENERATE_WEEKLY_REPORT") {
      console.log("[Web Worker] Starting weekly report generation...");
      await handleGenerateWeeklyReport(payload);
      console.log("[Web Worker] Weekly report generation completed");
    } else if (type === "GENERATE_BANTEN_REPORT") {
      console.log("[Web Worker] Starting Banten report generation...");
      await handleGenerateBantenReport(payload);
      console.log("[Web Worker] Banten report generation completed");
    }
  } catch (error) {
    console.error("[Web Worker] Error during report generation:", error);
    self.postMessage({
      type: "ERROR",
      error: String(error),
    });
  }
};

async function handleGenerateWeeklyReport(payload: any) {
  const { startDate, endDate, imageMap, stringPeriode, namaBulan } = payload;

  console.log("[Web Worker] Weekly Report - Input:", {
    stringPeriode,
    imageCount: Object.keys(imageMap).length,
  });

  try {
    // Fetch template dari main thread context
    console.log("[Web Worker] Fetching template...");
    const response = await fetch("/template-laporan.docx");

    if (!response.ok) {
      throw new Error(
        `File template gagal diakses. Status HTTP: ${response.status}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      throw new Error(
        "Yang terdownload adalah halaman HTML, bukan file Word. Pastikan file ada di folder public.",
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = new PizZip(arrayBuffer);

    const imageOptions = {
      centered: true,
      getImage: (tagValue: string) => base64Parser(tagValue),
      getSize: () => [350, 200],
    };

    const imageModule = new ImageModule(imageOptions);

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });

    // Tanggal pembuatan laporan
    const sekarang = new Date();
    const bulan = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const tanggalBuat = `${sekarang.getDate()} ${bulan[sekarang.getMonth()]} ${sekarang.getFullYear()}, ${sekarang.getHours().toString().padStart(2, "0")}:${sekarang.getMinutes().toString().padStart(2, "0")}:${sekarang.getSeconds().toString().padStart(2, "0")}`;

    doc.render({
      ...imageMap,
      periode_laporan: stringPeriode,
      BULAN: namaBulan,
      tanggal_buat: tanggalBuat,
    });

    const out = doc.getZip().generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // Kirim blob back ke main thread
    console.log("[Web Worker] Generated blob, size:", out.size);
    const filename = `Laporan_Mingguan_${stringPeriode.replace(/\s/g, "_")}.docx`;
    console.log("[Web Worker] Sending REPORT_READY:", filename);
    self.postMessage({
      type: "REPORT_READY",
      data: {
        blob: out,
        filename,
      },
    });
  } catch (error) {
    throw new Error(`Gagal men-generate laporan Word: ${error}`);
  }
}

async function handleGenerateBantenReport(payload: any) {
  const { startDate, endDate, imageMap, stringPeriode } = payload;

  console.log("[Web Worker] Banten Report - Input:", {
    stringPeriode,
    imageCount: Object.keys(imageMap).length,
  });

  try {
    // Create blank DOCX from scratch using PizZip
    console.log("[Web Worker] Creating DOCX structure...");
    const zip = new PizZip();

    // 1. [Content_Types].xml
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    );

    // 2. _rels/.rels
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    );

    // 3. word/_rels/document.xml.rels - image relationships
    let imageRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;

    let imageCounter = 1;
    const imageRefs: Record<string, number> = {};

    for (const [key, dataUrl] of Object.entries(imageMap)) {
      imageRefs[key] = imageCounter;

      // Extract base64 data
      const match = (dataUrl as string).match(/base64,(.+)$/);
      if (match) {
        const base64Data = match[1];
        // Store image in media folder
        zip.file(`word/media/image${imageCounter}.png`, base64Data, {
          base64: true,
        });

        imageRelationships += `
  <Relationship Id="rId${imageCounter + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${imageCounter}.png"/>`;
      }
      imageCounter++;
    }

    imageRelationships += `
</Relationships>`;

    zip.file("word/_rels/document.xml.rels", imageRelationships);

    // 4. word/document.xml - main content
    let documentContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    <w:p>
      <w:pPr>
        <w:alignment w:val="center"/>
      </w:pPr>
      <w:r>
        <w:t>Laporan Banten ${stringPeriode}</w:t>
      </w:r>
    </w:p>`;

    // Add each image as a new paragraph
    for (const [key, rId] of Object.entries(imageRefs)) {
      documentContent += `
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="114300" distR="114300">
            <wp:extent cx="4876400" cy="1828800"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="${rId}" name="Image ${rId}"/>
            <wp:cNvGraphicFramePr/>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="${rId}" name="Image${rId}"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="rId${rId + 1}"/>
                    <a:stretch>
                      <a:fillRect/>
                    </a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="4876400" cy="1828800"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect">
                      <a:avLst/>
                    </a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>`;
    }

    documentContent += `
  </w:body>
</w:document>`;

    zip.file("word/document.xml", documentContent);

    const blob = zip.generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    console.log("[Web Worker] Generated blob, size:", blob.size);
    const filename = `Laporan_Banten_${stringPeriode.replace(/\s/g, "_")}.docx`;
    console.log("[Web Worker] Sending REPORT_READY:", filename);
    self.postMessage({
      type: "REPORT_READY",
      data: {
        blob: blob,
        filename,
      },
    });
  } catch (error) {
    throw new Error(`Gagal men-generate laporan Banten: ${error}`);
  }
}
