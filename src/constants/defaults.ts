// Default site names untuk monitoring
export const DEFAULT_SITE_NAMES = [
  "Internet backbone Data Center Polda Bali",
  "Integration network ATCS Denpasar",
  "Integration network ATCS Gianyar",
  "Integration network ATCS Tabanan",
  "Integration network Pelabuhan Padangbay",
  "Integration network Pelabuhan Sanur",
  "Integration network terminal Mengwi",
  "Integration network Toll Balimandara",
  "cctv simpang DIPONEGORO",
  "cctv PUPUTAN BADUNG",
  "cctv simpang PIDADA",
  "cctv simpang TRENGGULI",
  "cctv simpang NOJA",
  "cctv simpang KENYERI",
  "cctv simpang TOHPATI",
  "cctv simpang PADANG GALAK",
  "cctv simpang GBB SANUR",
  "cctv BUNDARAN RENON",
  "cctv KONJEN JEPANG",
  "cctv KANTOR GUBENUR",
  "cctv LAPANGAN RENON",
  "cctv PARKIR TIMUR RENON",
  "cctv BAJRASANDI RENON",
  "cctv simpang SUDIRMAN",
  "cctv KONJEN AUSTRALIA",
  "cctv PEREMPATAN JL DIPONEGORO-LV21",
  "cctv HASANUDIN DEPAN MASJID",
  "cctv KAMPUS UNUD SUDIRMAN",
  "cctv simpang GATSU DALUNG",
  "cctv simpang KEBO IWA",
  "cctv simpang BULUH INDAH",
  "cctv simpang COKRO UBUNG",
  "cctv simpang A YANI",
  "cctv simpang NANGKA",
  "cctv simpang TITI BANDA",
  "cctv simpang 6 TEUKU UMAR",
  "cctv simpang SIMPANG BUAGAN",
  "cctv kantor KPU PROVINSI BALI",
  "cctv PUJA MANDALA",
  "cctv simpang GLAEL",
  "cctv simpang SUNSET ROAD IMAM BONJOL",
  "cctv simpang NAKULA",
  "cctv simpang SPKUNTI",
];

// Warna palette untuk interface Traffic
export const INTERFACE_COLORS = [
  { in: "#BCE249", out: "#CA89CB" }, // ether1
  { in: "#A7D63A", out: "#A96DB0" }, // ether2
  { in: "#93CA2D", out: "#8E5296" }, // ether3
  { in: "#76BD22", out: "#703878" }, // ether4
  { in: "#53A41B", out: "#511C54" }, // ether5
  { in: "#128B15", out: "#350035" }, // LAN
];

// Warna palette untuk Latency (RTT/Loss)
export const LATENCY_COLORS = {
  in: "#CECECE", // RTT
  out: "#FF0000", // Loss
};

// Time range presets
export const TIME_PRESETS = [
  { label: "6H", hours: 6 },
  { label: "24H", hours: 24 },
  { label: "3D", hours: 72 },
  { label: "7D", hours: 168 },
  { label: "30D", hours: 720 },
];

// Graph type tabs
export const GRAPH_TYPES = ["All", "Load", "Ping"];
