// @ts-ignore
import PizZip from "pizzip";
// @ts-ignore
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import { saveAs } from "file-saver";

// Helper mengubah string Base64 dari canvas menjadi buffer biner
function base64Parser(dataURL: string) {
  const base64Regex = /^data:image\/(png|jpg|jpeg|svg|svg\+xml);base64,/;
  if (!base64Regex.test(dataURL)) return false;

  const stringBase64 = dataURL.replace(base64Regex, "");
  const binaryString = window.atob(stringBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate Word document untuk Bali (dengan template)
 */
export async function generateWeeklyReportDocx(
  startDate: Date,
  endDate: Date,
  imageMap: Record<string, string>,
) {
  // Format Tanggal: "1 - 7 Februari 2026"
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
  let stringPeriode = "";
  if (startDate.getMonth() === endDate.getMonth()) {
    stringPeriode = `${startDate.getDate()} - ${endDate.getDate()} ${bulan[endDate.getMonth()]} ${endDate.getFullYear()}`;
  } else {
    stringPeriode = `${startDate.getDate()} ${bulan[startDate.getMonth()]} - ${endDate.getDate()} ${bulan[endDate.getMonth()]} ${endDate.getFullYear()}`;
  }

  // Nama bulan untuk placeholder {BULAN}
  const namaBulan = bulan[endDate.getMonth()];
  
  // Tanggal pembuatan laporan untuk placeholder {tanggal_buat}
  const sekarang = new Date();
  const tanggalBuat = `${sekarang.getDate()} ${bulan[sekarang.getMonth()]} ${sekarang.getFullYear()}, ${sekarang.getHours().toString().padStart(2, '0')}:${sekarang.getMinutes().toString().padStart(2, '0')}:${sekarang.getSeconds().toString().padStart(2, '0')}`;

  try {
    const response = await fetch("/template-laporan.docx");

    // TAMBAHAN: Cek apakah file benar-benar ditemukan
    if (!response.ok) {
      throw new Error(
        `File template gagal diakses. Status HTTP: ${response.status}`,
      );
    }

    // TAMBAHAN: Cek apakah yang didownload benar-benar file Word, bukan HTML
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      throw new Error(
        "Yang terdownload adalah halaman HTML, bukan file Word. Pastikan file ada di folder public.",
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = new PizZip(arrayBuffer);

    const imageOptions = {
      centered: true, // Gambar otomatis di-center di Word
      getImage: (tagValue: string) => base64Parser(tagValue),
      getSize: () => [350, 200], // Ukuran resolusi gambar di dalam Word (Width x Height)
    };

    const imageModule = new ImageModule(imageOptions);

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });

    // Suntikkan semua data gambar dan teks placeholder
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

    saveAs(out, `Laporan_Mingguan_${stringPeriode.replace(/\s/g, "_")}.docx`);
    return true;
  } catch (error) {
    console.error("Gagal men-generate laporan Word:", error);
    alert(
      "Terjadi kesalahan saat memproses template Word. Pastikan file 'template-laporan.docx' ada di folder public.",
    );
    return false;
  }
}

/**
 * Generate Word document untuk Banten (TANPA template - manual dari screenshot)
 * Membuat file Word baru dari nol dengan semua screenshot
 */
export async function generateBantenReportDocx(
  startDate: Date,
  endDate: Date,
  imageMap: Record<string, string>,
) {
  console.log("generateBantenReportDocx called with:", {
    startDate,
    endDate,
    imageCount: Object.keys(imageMap).length,
  });

  // Format Tanggal: "Februari 2026"
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const namaBulan = bulan[startDate.getMonth()];
  const tahun = startDate.getFullYear();
  const stringPeriode = `${namaBulan} ${tahun}`;

  try {
    // Create blank DOCX from scratch using PizZip
    const zip = new PizZip();

    // 1. [Content_Types].xml
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/_rels/document.xml.rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
</Types>`);

    // 2. _rels/.rels
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // 3. docProps/app.xml
    zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Words>100</Words>
  <Application>NetMon Dashboard</Application>
</Properties>`);

    // 4. docProps/core.xml
    zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">
  <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Laporan Monitoring Network - Banten</dc:title>
  <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">NetMon Dashboard</dc:creator>
</cp:coreProperties>`);

    // 5. word/document.xml - dengan semua screenshot
    let imagesXml = '';
    let imageIndex = 1;
    
    Object.entries(imageMap).forEach(([siteName, imageData]) => {
      const cleanName = siteName.replace(/img_/g, '').replace(/_/g, ' ');
      
      imagesXml += `
      <w:p>
        <w:pPr>
          <w:spacing w:after="200"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:sz w:val="28"/>
          </w:rPr>
          <w:t>${cleanName}</w:t>
        </w:r>
      </w:p>
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
              <wp:extent cx="5486400" cy="2057400"/>
              <wp:docPr id="${imageIndex}" name="Image${imageIndex}"/>
              <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:nvPicPr>
                      <pic:cNvPr id="${imageIndex}" name="Image${imageIndex}"/>
                      <pic:cNvPicPr/>
                    </pic:nvPicPr>
                    <pic:blipFill>
                      <a:blip r:embed="rId${imageIndex + 1}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                      <a:stretch>
                        <a:fillRect/>
                      </a:stretch>
                    </pic:blipFill>
                    <pic:spPr>
                      <a:xfrm>
                        <a:off x="0" y="0"/>
                        <a:ext cx="5486400" cy="2057400"/>
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
      </w:p>
      <w:p>
        <w:r>
          <w:t></w:t>
        </w:r>
      </w:p>`;
      
      imageIndex++;
    });

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="48"/>
          <w:szCs w:val="48"/>
        </w:rPr>
        <w:t>Laporan Monitoring Network - Banten</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="32"/>
          <w:szCs w:val="32"/>
        </w:rPr>
        <w:t>Periode: ${stringPeriode}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:sz w:val="24"/>
          <w:szCs w:val="24"/>
        </w:rPr>
        <w:t>Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t></w:t>
      </w:r>
    </w:p>
    ${imagesXml}
  </w:body>
</w:document>`;

    zip.file("word/document.xml", documentXml);

    // 6. word/_rels/document.xml.rels (dengan rels untuk images)
    let imageRels = '';
    for (let i = 1; i <= Object.keys(imageMap).length; i++) {
      imageRels += `  <Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i}.png"/>\n`;
    }

    zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
${imageRels}</Relationships>`);

    // 7. Add images to zip
    let imgIndex = 1;
    Object.entries(imageMap).forEach(([siteName, imageData]) => {
      const binaryData = base64Parser(imageData);
      if (binaryData) {
        zip.file(`word/media/image${imgIndex}.png`, binaryData);
        imgIndex++;
      }
    });

    // Generate dan download
    const out = zip.generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const fileName = `Laporan_Banten_${stringPeriode.replace(/\s/g, "_")}.docx`;
    console.log("Saving file:", fileName);
    saveAs(out, fileName);
    return true;
  } catch (error) {
    console.error("Gagal men-generate laporan Word Banten:", error);
    alert("Terjadi kesalahan saat memproses laporan Word Banten: " + (error as Error).message);
    return false;
  }
}
