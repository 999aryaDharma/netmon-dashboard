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
    });

    const out = doc.getZip().generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    saveAs(
      out,
      `Laporan_NOC_Mingguan_${stringPeriode.replace(/\s/g, "_")}.docx`,
    );
    return true;
  } catch (error) {
    console.error("Gagal men-generate laporan Word:", error);
    alert(
      "Terjadi kesalahan saat memproses template Word. Pastikan file 'template-laporan.docx' ada di folder public.",
    );
    return false;
  }
}
