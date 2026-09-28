// The zone/alert copy below is the business's own "coaching message" script
// for this outlet's product line (Kebab/Shawarma) — tiers are 10-point
// buckets of month-to-date achievement % against month-to-date accrued
// target, floored, with a dedicated zero-sales tier below all of them.

export type AchievementZone = "HIJAU" | "KUNING" | "JINGGA" | "MERAH" | "HITAM";

export type AchievementTier = {
  threshold: number;
  zone: AchievementZone;
  rangeLabel: string;
  alertLabel: string;
  statusLabel: string;
  message: string;
};

export const ACHIEVEMENT_TIERS: AchievementTier[] = [
  {
    threshold: 100,
    zone: "HIJAU",
    rangeLabel: "100%++",
    alertLabel: "🤝 ALHAMDULILLAH, TARGET PECAH!",
    statusLabel: "SANGAT AMAN",
    message:
      "Luar biasa tim! Kebab kita laris manis tanjung kimpul hari ini! Terima kasih buat gulungan kebabnya yang rapi, dagingnya yang pas, dan upselling Topping-nya yang gacor. Malam ini tidur nyenyak, besok kita gempur lagi!",
  },
  {
    threshold: 90,
    zone: "HIJAU",
    rangeLabel: "90-99%",
    alertLabel: "⚡ DIKIT LAGI GOAL!",
    statusLabel: "AMAN",
    message:
      "Keren! Tipis banget menuju 100%. Sedikit evaluasi untuk besok: di jam-jam sibuk (peak hours jam 5 sore - 8 malam), pastikan kecepatan bungkus ditingkatkan supaya antrean nggak bubar. Besok kita genjot biar tembus 100%!",
  },
  {
    threshold: 80,
    zone: "KUNING",
    rangeLabel: "80-89%",
    alertLabel: "⚠️ YUK BISA YUK!",
    statusLabel: "PERLU PENINGKATAN",
    message:
      "Omset hari ini lumayan, tapi belum mencapai standar aman bulanan kita. Tolong setiap ada yang beli kebab ukuran Medium, wajib tawarkan Upsize ke ukuran Jumbo atau tambah add-on topping. Rp7.000 - Rp9.000 tambahan dari tiap pembeli itu berharga banget!",
  },
  {
    threshold: 70,
    zone: "KUNING",
    rangeLabel: "70-79%",
    alertLabel: "🔔 LAMPU KUNING!",
    statusLabel: "SEGERA EVALUASI",
    message:
      "Hari ini kita finish di angka pas-pasan. Coba dicek, apakah aplikasi online (GoFood/GrabFood/ShopeeFood) tadi sempat dimatikan atau set menu ada yang habis? Besok pastikan semua bahan baku siap dari awal buka agar tidak ada potensi omset yang hilang.",
  },
  {
    threshold: 60,
    zone: "JINGGA",
    rangeLabel: "60-69%",
    alertLabel: "📉 OUTLET LESU!",
    statusLabel: "DI BAWAH STANDAR",
    message:
      "Angka ini mulai berbahaya karena pas-pasan banget buat nutup HPP bahan baku. Tolong kru outlet lebih aktif. Pasang banner di depan outlet dengan jelas. Standar Grooming dan kebersihan outlet dijaga. Jangan pasif nunggu pembeli datang, tawarkan menu dengan ramah ke setiap orang yang lewat depan gerobak!",
  },
  {
    threshold: 50,
    zone: "JINGGA",
    rangeLabel: "50-59%",
    alertLabel: "⭕ DROP PARAH!",
    statusLabel: "TIDAK SEHAT",
    message:
      "Hari ini kita cuma dapat SETENGAH dari target. Tolong jujur, apa kendalanya hari ini? Apakah hujan deras, ada kompetitor bikin promo potong harga, atau pelayanan kita yang lambat? Tulis evaluasinya di grup ini sekarang, kita cari solusinya bareng-bareng untuk besok!",
  },
  {
    threshold: 40,
    zone: "MERAH",
    rangeLabel: "40-49%",
    alertLabel: "🚩 ZONA MERAH!",
    statusLabel: "MERUGI OPERASIONAL",
    message:
      "Penjualan hancur hari ini. Angka segini nggak bakal cukup buat bayar gaji harian dan sewa tempat. Besok pagi, Supervisor wajib turun ke outlet sebelum buka untuk cek masalahnya secara langsung.",
  },
  {
    threshold: 30,
    zone: "MERAH",
    rangeLabel: "30-39%",
    alertLabel: "❗ OUTLET SEPI NYES!",
    statusLabel: "SANGAT BURUK",
    message:
      "Tolong kru outlet yang bertugas hari ini, periksa kembali kualitas produk kita. Apakah rasa daging kebabnya berubah? Atau saus dan mayonaisenya kurang segar? Jangan sampai konsumen kapok beli di sini karena kualitas kita menurun!",
  },
  {
    threshold: 20,
    zone: "MERAH",
    rangeLabel: "20-29%",
    alertLabel: "🚨 AMBANG KEBAKARAN!",
    statusLabel: "KRITIS",
    message:
      "Penjualan sangat mengenaskan. Hanya beberapa porsi kebab yang terjual seharian ini. Besok tidak ada alasan santai. Semua kru wajib on-fire, lakukan Local Area Marketing, sebar brosur ke area sekitar pemukiman/sekolah dekat outlet!",
  },
  {
    threshold: 10,
    zone: "MERAH",
    rangeLabel: "10-19%",
    alertLabel: "⏰ OUTLET MATI SURI!",
    statusLabel: "DARURAT UTAMA",
    message:
      "Angka 10% ini tidak masuk akal untuk outlet yang buka normal. Apakah ada kendala operasional berat (misal: burner rusak atau gas habis)? Berikan laporan kronologisnya malam ini juga ke manajemen!",
  },
  {
    threshold: 0,
    zone: "HITAM",
    rangeLabel: "0%",
    alertLabel: "⬛ SYSTEM ALERT: ZERO SALES",
    statusLabel: "OUTLET TUTUP / FORCE MAJEURE",
    message:
      "Hari ini outlet mencatat omset kosong (Rp 0). Keterangan diisi oleh Supervisor (misal: outlet terpaksa tutup karena banjir / perbaikan jalan / pramuniaga kurang / sakit). Semoga besok kendala teknis ini bisa selesai dan kita bisa beroperasi normal kembali.",
  },
];

const ZERO_SALES_TIER = ACHIEVEMENT_TIERS[ACHIEVEMENT_TIERS.length - 1];

export function getAchievementTier(persentase: number, cumulativeAmount: number): AchievementTier {
  if (cumulativeAmount <= 0) return ZERO_SALES_TIER;
  const bucket = Math.min(100, Math.max(10, Math.floor(persentase / 10) * 10));
  return ACHIEVEMENT_TIERS.find((t) => t.threshold === bucket) ?? ZERO_SALES_TIER;
}

export type DailyAchievementRow = {
  day: number;
  date: Date;
  targetBerjalan: number;
  achievementBerjalan: number;
  persentase: number;
  tier: AchievementTier;
};

/** Month-to-date accrued target/achievement per day, day 1 through `daysElapsed`. */
export function computeMonthlyAchievementSeries({
  year,
  month,
  dailyTarget,
  dailyActualByDay,
  daysElapsed,
}: {
  year: number;
  month: number; // 1-12
  dailyTarget: number;
  dailyActualByDay: Map<number, number>;
  daysElapsed: number;
}): DailyAchievementRow[] {
  const rows: DailyAchievementRow[] = [];
  let cumulativeAchievement = 0;
  for (let day = 1; day <= daysElapsed; day++) {
    cumulativeAchievement += dailyActualByDay.get(day) ?? 0;
    const targetBerjalan = dailyTarget * day;
    const persentase = targetBerjalan > 0 ? (cumulativeAchievement / targetBerjalan) * 100 : 0;
    rows.push({
      day,
      date: new Date(year, month - 1, day),
      targetBerjalan,
      achievementBerjalan: cumulativeAchievement,
      persentase,
      tier: getAchievementTier(persentase, cumulativeAchievement),
    });
  }
  return rows;
}

export type DailyOnlyRow = {
  day: number;
  date: Date;
  targetHarian: number;
  achievementHarian: number;
  persentase: number;
  tier: AchievementTier;
};

/**
 * Each day's OWN achievement against that day's OWN flat target — not
 * accrued/cumulative like computeMonthlyAchievementSeries above. Used to
 * compare a single day's Omset against a fixed daily standard (Fullshift
 * target, or the plain daily Omset target) rather than month-to-date pace.
 */
export function computeDailyOnlySeries({
  year,
  month,
  dailyTarget,
  dailyActualByDay,
  daysElapsed,
}: {
  year: number;
  month: number; // 1-12
  dailyTarget: number;
  dailyActualByDay: Map<number, number>;
  daysElapsed: number;
}): DailyOnlyRow[] {
  const rows: DailyOnlyRow[] = [];
  for (let day = 1; day <= daysElapsed; day++) {
    const achievementHarian = dailyActualByDay.get(day) ?? 0;
    const persentase = dailyTarget > 0 ? (achievementHarian / dailyTarget) * 100 : 0;
    rows.push({
      day,
      date: new Date(year, month - 1, day),
      targetHarian: dailyTarget,
      achievementHarian,
      persentase,
      tier: getAchievementTier(persentase, achievementHarian),
    });
  }
  return rows;
}
