/**
 * Comprehensive list of Turkish universities and their departments.
 * Data structured for searchable dropdown integration.
 */

export interface University {
  name: string;
  city: string;
  type: "devlet" | "vakıf";
  popular?: boolean;
  emailDomain?: string; // e.g. "ege.edu.tr"
}

/**
 * Map of email domains to university names.
 * Format: "domain.edu.tr" -> "Üniversite Adı"
 */
const EMAIL_DOMAIN_MAP: Record<string, string> = {
  // Popular State Universities
  "istanbul.edu.tr": "İstanbul Üniversitesi",
  "itu.edu.tr": "İstanbul Teknik Üniversitesi",
  "boun.edu.tr": "Boğaziçi Üniversitesi",
  "metu.edu.tr": "Orta Doğu Teknik Üniversitesi",
  "odtu.edu.tr": "Orta Doğu Teknik Üniversitesi",
  "hacettepe.edu.tr": "Hacettepe Üniversitesi",
  "ankara.edu.tr": "Ankara Üniversitesi",
  "ege.edu.tr": "Ege Üniversitesi",
  "deu.edu.tr": "Dokuz Eylül Üniversitesi",
  "gazi.edu.tr": "Gazi Üniversitesi",
  "marmara.edu.tr": "Marmara Üniversitesi",
  "yildiz.edu.tr": "Yıldız Teknik Üniversitesi",
  "atauni.edu.tr": "Atatürk Üniversitesi",
  "cu.edu.tr": "Çukurova Üniversitesi",
  "erciyes.edu.tr": "Erciyes Üniversitesi",
  "anadolu.edu.tr": "Anadolu Üniversitesi",
  // Popular Foundation Universities
  "ku.edu.tr": "Koç Üniversitesi",
  "sabanciuniv.edu": "Sabancı Üniversitesi",
  "bilkent.edu.tr": "Bilkent Üniversitesi",
  "ozyegin.edu.tr": "Özyeğin Üniversitesi",
  // State Universities (alphabetical)
  "ibu.edu.tr": "Bolu Abant İzzet Baysal Üniversitesi",
  "atu.edu.tr": "Adana Alparslan Türkeş Bilim ve Teknoloji Üniversitesi",
  "agu.edu.tr": "Abdullah Gül Üniversitesi",
  "adiyaman.edu.tr": "Adıyaman Üniversitesi",
  "afsu.edu.tr": "Afyonkarahisar Sağlık Bilimleri Üniversitesi",
  "aku.edu.tr": "Afyon Kocatepe Üniversitesi",
  "agri.edu.tr": "Ağrı İbrahim Çeçen Üniversitesi",
  "akdeniz.edu.tr": "Akdeniz Üniversitesi",
  "aksaray.edu.tr": "Aksaray Üniversitesi",
  "alanya.edu.tr": "Alanya Alaaddin Keykubat Üniversitesi",
  "amasya.edu.tr": "Amasya Üniversitesi",
  "ahbv.edu.tr": "Ankara Hacı Bayram Veli Üniversitesi",
  "mgu.edu.tr": "Ankara Müzik ve Güzel Sanatlar Üniversitesi",
  "asbu.edu.tr": "Ankara Sosyal Bilimler Üniversitesi",
  "aybu.edu.tr": "Ankara Yıldırım Beyazıt Üniversitesi",
  "ardahan.edu.tr": "Ardahan Üniversitesi",
  "artvin.edu.tr": "Artvin Çoruh Üniversitesi",
  "adu.edu.tr": "Aydın Adnan Menderes Üniversitesi",
  "balikesir.edu.tr": "Balıkesir Üniversitesi",
  "bandirma.edu.tr": "Bandırma Onyedi Eylül Üniversitesi",
  "bartin.edu.tr": "Bartın Üniversitesi",
  "batman.edu.tr": "Batman Üniversitesi",
  "bayburt.edu.tr": "Bayburt Üniversitesi",
  "bilecik.edu.tr": "Bilecik Şeyh Edebali Üniversitesi",
  "bingol.edu.tr": "Bingöl Üniversitesi",
  "beu.edu.tr": "Bitlis Eren Üniversitesi",
  "mehmetakif.edu.tr": "Burdur Mehmet Akif Ersoy Üniversitesi",
  "btu.edu.tr": "Bursa Teknik Üniversitesi",
  "uludag.edu.tr": "Bursa Uludağ Üniversitesi",
  "comu.edu.tr": "Çanakkale Onsekiz Mart Üniversitesi",
  "karatekin.edu.tr": "Çankırı Karatekin Üniversitesi",
  "dicle.edu.tr": "Dicle Üniversitesi",
  "duzce.edu.tr": "Düzce Üniversitesi",
  "erzincan.edu.tr": "Erzincan Binali Yıldırım Üniversitesi",
  "erzurum.edu.tr": "Erzurum Teknik Üniversitesi",
  "ogu.edu.tr": "Eskişehir Osmangazi Üniversitesi",
  "eskisehir.edu.tr": "Eskişehir Teknik Üniversitesi",
  "firat.edu.tr": "Fırat Üniversitesi",
  "gsu.edu.tr": "Galatasaray Üniversitesi",
  "gantep.edu.tr": "Gaziantep Üniversitesi",
  "gibtu.edu.tr": "Gaziantep İslam Bilim ve Teknoloji Üniversitesi",
  "gop.edu.tr": "Tokat Gaziosmanpaşa Üniversitesi",
  "gtu.edu.tr": "Gebze Teknik Üniversitesi",
  "giresun.edu.tr": "Giresun Üniversitesi",
  "gumushane.edu.tr": "Gümüşhane Üniversitesi",
  "hakkari.edu.tr": "Hakkari Üniversitesi",
  "harran.edu.tr": "Harran Üniversitesi",
  "mku.edu.tr": "Hatay Mustafa Kemal Üniversitesi",
  "hitit.edu.tr": "Hitit Üniversitesi",
  "igdir.edu.tr": "Iğdır Üniversitesi",
  "inonu.edu.tr": "İnönü Üniversitesi",
  "iste.edu.tr": "İskenderun Teknik Üniversitesi",
  "medeniyet.edu.tr": "İstanbul Medeniyet Üniversitesi",
  "iuc.edu.tr": "İstanbul Üniversitesi-Cerrahpaşa",
  "isubyu.edu.tr": "Isparta Uygulamalı Bilimler Üniversitesi",
  "bakircay.edu.tr": "İzmir Bakırçay Üniversitesi",
  "idu.edu.tr": "İzmir Demokrasi Üniversitesi",
  "ikcu.edu.tr": "İzmir Kâtip Çelebi Üniversitesi",
  "iyte.edu.tr": "İzmir Yüksek Teknoloji Enstitüsü",
  "kafkas.edu.tr": "Kafkas Üniversitesi",
  "istiklal.edu.tr": "Kahramanmaraş İstiklal Üniversitesi",
  "ksu.edu.tr": "Kahramanmaraş Sütçü İmam Üniversitesi",
  "karabuk.edu.tr": "Karabük Üniversitesi",
  "ktu.edu.tr": "Karadeniz Teknik Üniversitesi",
  "kmu.edu.tr": "Karamanoğlu Mehmetbey Üniversitesi",
  "kastamonu.edu.tr": "Kastamonu Üniversitesi",
  "kayseri.edu.tr": "Kayseri Üniversitesi",
  "kku.edu.tr": "Kırıkkale Üniversitesi",
  "klu.edu.tr": "Kırklareli Üniversitesi",
  "ahievran.edu.tr": "Kırşehir Ahi Evran Üniversitesi",
  "kilis.edu.tr": "Kilis 7 Aralık Üniversitesi",
  "kocaeli.edu.tr": "Kocaeli Üniversitesi",
  "ktun.edu.tr": "Konya Teknik Üniversitesi",
  "dpu.edu.tr": "Kütahya Dumlupınar Üniversitesi",
  "ksbu.edu.tr": "Kütahya Sağlık Bilimleri Üniversitesi",
  "ozal.edu.tr": "Malatya Turgut Özal Üniversitesi",
  "cbu.edu.tr": "Manisa Celal Bayar Üniversitesi",
  "artuklu.edu.tr": "Mardin Artuklu Üniversitesi",
  "mersin.edu.tr": "Mersin Üniversitesi",
  "msgsu.edu.tr": "Mimar Sinan Güzel Sanatlar Üniversitesi",
  "mu.edu.tr": "Muğla Sıtkı Koçman Üniversitesi",
  "munzur.edu.tr": "Munzur Üniversitesi",
  "alparslan.edu.tr": "Muş Alparslan Üniversitesi",
  "erbakan.edu.tr": "Necmettin Erbakan Üniversitesi",
  "nevsehir.edu.tr": "Nevşehir Hacı Bektaş Veli Üniversitesi",
  "ohu.edu.tr": "Niğde Ömer Halisdemir Üniversitesi",
  "omu.edu.tr": "Ondokuz Mayıs Üniversitesi",
  "odu.edu.tr": "Ordu Üniversitesi",
  "osmaniye.edu.tr": "Osmaniye Korkut Ata Üniversitesi",
  "pau.edu.tr": "Pamukkale Üniversitesi",
  "erdogan.edu.tr": "Recep Tayyip Erdoğan Üniversitesi",
  "sbu.edu.tr": "Sağlık Bilimleri Üniversitesi",
  "sakarya.edu.tr": "Sakarya Üniversitesi",
  "subu.edu.tr": "Sakarya Uygulamalı Bilimler Üniversitesi",
  "samsun.edu.tr": "Samsun Üniversitesi",
  "selcuk.edu.tr": "Selçuk Üniversitesi",
  "siirt.edu.tr": "Siirt Üniversitesi",
  "sinop.edu.tr": "Sinop Üniversitesi",
  "cumhuriyet.edu.tr": "Sivas Cumhuriyet Üniversitesi",
  "sivas.edu.tr": "Sivas Bilim ve Teknoloji Üniversitesi",
  "sdu.edu.tr": "Süleyman Demirel Üniversitesi",
  "sirnak.edu.tr": "Şırnak Üniversitesi",
  "tarsus.edu.tr": "Tarsus Üniversitesi",
  "nku.edu.tr": "Tekirdağ Namık Kemal Üniversitesi",
  "trakya.edu.tr": "Trakya Üniversitesi",
  "trabzon.edu.tr": "Trabzon Üniversitesi",
  "usak.edu.tr": "Uşak Üniversitesi",
  "yyu.edu.tr": "Van Yüzüncü Yıl Üniversitesi",
  "yalova.edu.tr": "Yalova Üniversitesi",
  "bozok.edu.tr": "Yozgat Bozok Üniversitesi",
  "beun.edu.tr": "Zonguldak Bülent Ecevit Üniversitesi",
  // Foundation Universities
  "acibadem.edu.tr": "Acıbadem Üniversitesi",
  "alanyau.edu.tr": "Alanya Üniversitesi",
  "altinbas.edu.tr": "Altınbaş Üniversitesi",
  "ankarabilim.edu.tr": "Ankara Bilim Üniversitesi",
  "ankaramedipol.edu.tr": "Ankara Medipol Üniversitesi",
  "antalya.edu.tr": "Antalya Bilim Üniversitesi",
  "belek.edu.tr": "Antalya Belek Üniversitesi",
  "atilim.edu.tr": "Atılım Üniversitesi",
  "avrasya.edu.tr": "Avrasya Üniversitesi",
  "bau.edu.tr": "Bahçeşehir Üniversitesi",
  "baskent.edu.tr": "Başkent Üniversitesi",
  "beykent.edu.tr": "Beykent Üniversitesi",
  "beykoz.edu.tr": "Beykoz Üniversitesi",
  "bezmialem.edu.tr": "Bezmiâlem Vakıf Üniversitesi",
  "biruni.edu.tr": "Biruni Üniversitesi",
  "cag.edu.tr": "Çağ Üniversitesi",
  "cankaya.edu.tr": "Çankaya Üniversitesi",
  "demiroglu.edu.tr": "Demiroğlu Bilim Üniversitesi",
  "dogus.edu.tr": "Doğuş Üniversitesi",
  "fsm.edu.tr": "Fatih Sultan Mehmet Vakıf Üniversitesi",
  "fbu.edu.tr": "Fenerbahçe Üniversitesi",
  "halic.edu.tr": "Haliç Üniversitesi",
  "hku.edu.tr": "Hasan Kalyoncu Üniversitesi",
  "ibnhaldun.edu.tr": "İbn Haldun Üniversitesi",
  "isikun.edu.tr": "Işık Üniversitesi",
  "29mayis.edu.tr": "İstanbul 29 Mayıs Üniversitesi",
  "arel.edu.tr": "İstanbul Arel Üniversitesi",
  "atlas.edu.tr": "İstanbul Atlas Üniversitesi",
  "aydin.edu.tr": "İstanbul Aydın Üniversitesi",
  "bilgi.edu.tr": "İstanbul Bilgi Üniversitesi",
  "esenyurt.edu.tr": "İstanbul Esenyurt Üniversitesi",
  "galata.edu.tr": "İstanbul Galata Üniversitesi",
  "gedik.edu.tr": "İstanbul Gedik Üniversitesi",
  "gelisim.edu.tr": "İstanbul Gelişim Üniversitesi",
  "kent.edu.tr": "İstanbul Kent Üniversitesi",
  "iku.edu.tr": "İstanbul Kültür Üniversitesi",
  "medipol.edu.tr": "İstanbul Medipol Üniversitesi",
  "okan.edu.tr": "İstanbul Okan Üniversitesi",
  "rumeli.edu.tr": "İstanbul Rumeli Üniversitesi",
  "izu.edu.tr": "İstanbul Sabahattin Zaim Üniversitesi",
  "istun.edu.tr": "İstanbul Sağlık ve Teknoloji Üniversitesi",
  "ticaret.edu.tr": "İstanbul Ticaret Üniversitesi",
  "topkapi.edu.tr": "İstanbul Topkapı Üniversitesi",
  "yeniyuzyil.edu.tr": "İstanbul Yeni Yüzyıl Üniversitesi",
  "istinye.edu.tr": "İstinye Üniversitesi",
  "ieu.edu.tr": "İzmir Ekonomi Üniversitesi",
  "tinaztepe.edu.tr": "İzmir Tınaztepe Üniversitesi",
  "khas.edu.tr": "Kadir Has Üniversitesi",
  "kapadokya.edu.tr": "Kapadokya Üniversitesi",
  "kstu.edu.tr": "Kocaeli Sağlık ve Teknoloji Üniversitesi",
  "gidatarim.edu.tr": "Konya Gıda ve Tarım Üniversitesi",
  "karatay.edu.tr": "KTO Karatay Üniversitesi",
  "lokmanhekim.edu.tr": "Lokman Hekim Üniversitesi",
  "maltepe.edu.tr": "Maltepe Üniversitesi",
  "mef.edu.tr": "MEF Üniversitesi",
  "mudanya.edu.tr": "Mudanya Üniversitesi",
  "nisantasi.edu.tr": "Nişantaşı Üniversitesi",
  "nny.edu.tr": "Nuh Naci Yazgan Üniversitesi",
  "ostimteknik.edu.tr": "Ostim Teknik Üniversitesi",
  "pirireis.edu.tr": "Piri Reis Üniversitesi",
  "sanko.edu.tr": "Sanko Üniversitesi",
  "tedu.edu.tr": "TED Üniversitesi",
  "etu.edu.tr": "TOBB Ekonomi ve Teknoloji Üniversitesi",
  "toros.edu.tr": "Toros Üniversitesi",
  "tau.edu.tr": "Türk-Alman Üniversitesi",
  "thk.edu.tr": "Türk Hava Kurumu Üniversitesi",
  "ufuk.edu.tr": "Ufuk Üniversitesi",
  "uskudar.edu.tr": "Üsküdar Üniversitesi",
  "yasar.edu.tr": "Yaşar Üniversitesi",
  "yeditepe.edu.tr": "Yeditepe Üniversitesi",
  "yiu.edu.tr": "Yüksek İhtisas Üniversitesi",
};

/**
 * Normalize Turkish/IDN characters in domain to ASCII equivalents.
 * Handles: itü.edu.tr -> itu.edu.tr, xn--it-yka.edu.tr -> itu.edu.tr
 */
function normalizeDomain(domain: string): string {
  // First handle punycode IDN domains (xn-- encoded)
  // Common Turkish university punycode mappings
  const punycodeMap: Record<string, string> = {
    "xn--it-yka": "itu",        // itü -> itu
    "xn--gm-yka": "gmu",        // gmü -> gmu  
    "xn--bm-yka": "bmu",        // bmü -> bmu
  };
  
  return domain
    .split(".")
    .map(part => punycodeMap[part] || part)
    .join(".")
    // Also normalize Turkish chars directly in domain
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/i̇/g, "i");
}

/**
 * Extract the full domain from an email address (part after '@').
 * Normalizes Turkish characters and punycode to ASCII.
 */
export function extractEmailDomain(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return "";
  return normalizeDomain(parts[1]);
}

/**
 * Resolve the university base domain from a potentially prefixed email domain.
 * E.g. "myo.ege.edu.tr" -> "ege.edu.tr", "ogrenci.itu.edu.tr" -> "itu.edu.tr"
 * Works by progressively stripping leading subdomains until a match is found.
 */
function resolveUniversityDomain(fullDomain: string): string | null {
  let domain = normalizeDomain(fullDomain);
  while (domain) {
    if (domain in EMAIL_DOMAIN_MAP) return domain;
    const dotIndex = domain.indexOf(".");
    if (dotIndex === -1) break;
    domain = domain.substring(dotIndex + 1);
  }
  return null;
}

/**
 * Check if an email domain is a valid Turkish university domain.
 * Handles prefixed subdomains like myo.ege.edu.tr, ogrenci.itu.edu.tr, etc.
 */
export function isValidEduEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  return resolveUniversityDomain(domain) !== null;
}

/**
 * Get university name from an email address.
 * Prefix-agnostic: strips subdomains to find the official university code.
 * Returns null if the domain is not recognized.
 */
export function getUniversityByEmailDomain(email: string): string | null {
  const domain = extractEmailDomain(email);
  const baseDomain = resolveUniversityDomain(domain);
  return baseDomain ? EMAIL_DOMAIN_MAP[baseDomain] : null;
}

/**
 * Get all valid email domains.
 */
export function getAllEmailDomains(): Record<string, string> {
  return { ...EMAIL_DOMAIN_MAP };
}

// Common departments shared across most universities
const COMMON_ENGINEERING = [
  "Bilgisayar Mühendisliği",
  "Elektrik-Elektronik Mühendisliği",
  "Makine Mühendisliği",
  "İnşaat Mühendisliği",
  "Endüstri Mühendisliği",
  "Kimya Mühendisliği",
  "Çevre Mühendisliği",
  "Gıda Mühendisliği",
  "Biyomedikal Mühendisliği",
  "Mekatronik Mühendisliği",
  "Yazılım Mühendisliği",
  "Malzeme Bilimi ve Mühendisliği",
  "Metalurji ve Malzeme Mühendisliği",
  "Tekstil Mühendisliği",
  "Jeoloji Mühendisliği",
  "Maden Mühendisliği",
  "Harita Mühendisliği",
];

const COMMON_SCIENCE = [
  "Matematik",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "İstatistik",
  "Moleküler Biyoloji ve Genetik",
];

const COMMON_ARTS = [
  "Türk Dili ve Edebiyatı",
  "Tarih",
  "Felsefe",
  "Sosyoloji",
  "Psikoloji",
  "Arkeoloji",
  "Sanat Tarihi",
  "Coğrafya",
  "Batı Dilleri ve Edebiyatları",
];

const COMMON_ECONOMICS = [
  "İktisat",
  "İşletme",
  "Maliye",
  "Çalışma Ekonomisi ve Endüstri İlişkileri",
  "Ekonometri",
  "Uluslararası Ticaret ve Finansman",
  "Kamu Yönetimi",
  "Siyaset Bilimi ve Uluslararası İlişkiler",
];

const COMMON_EDUCATION = [
  "İlköğretim Matematik Öğretmenliği",
  "Fen Bilgisi Öğretmenliği",
  "Türkçe Öğretmenliği",
  "Sınıf Öğretmenliği",
  "Okul Öncesi Öğretmenliği",
  "İngilizce Öğretmenliği",
  "Rehberlik ve Psikolojik Danışmanlık",
  "Özel Eğitim Öğretmenliği",
  "Sosyal Bilgiler Öğretmenliği",
];

const COMMON_LAW = ["Hukuk"];

const COMMON_MEDICINE = [
  "Tıp",
  "Diş Hekimliği",
  "Eczacılık",
];

const COMMON_HEALTH = [
  "Hemşirelik",
  "Fizyoterapi ve Rehabilitasyon",
  "Beslenme ve Diyetetik",
  "Ebelik",
  "Sağlık Yönetimi",
  "Acil Yardım ve Afet Yönetimi",
];

const COMMON_COMMUNICATION = [
  "Gazetecilik",
  "Halkla İlişkiler ve Tanıtım",
  "Radyo, Televizyon ve Sinema",
  "Reklamcılık",
  "Yeni Medya ve İletişim",
];

const COMMON_ARCHITECTURE = [
  "Mimarlık",
  "Şehir ve Bölge Planlama",
  "İç Mimarlık",
  "Peyzaj Mimarlığı",
  "Endüstriyel Tasarım",
];

const COMMON_AGRICULTURE = [
  "Ziraat Mühendisliği",
  "Bitki Koruma",
  "Tarla Bitkileri",
  "Bahçe Bitkileri",
  "Tarım Ekonomisi",
  "Toprak Bilimi ve Bitki Besleme",
  "Hayvansal Üretim",
];

const COMMON_FINE_ARTS = [
  "Grafik Tasarım",
  "Resim",
  "Heykel",
  "Seramik ve Cam Tasarımı",
  "Müzik",
  "Tekstil ve Moda Tasarımı",
];

const COMMON_SPORTS = [
  "Beden Eğitimi ve Spor Öğretmenliği",
  "Antrenörlük Eğitimi",
  "Spor Yöneticiliği",
  "Rekreasyon",
];

const COMMON_THEOLOGY = [
  "İlahiyat",
  "İslami İlimler",
];

const COMMON_TOURISM = [
  "Turizm İşletmeciliği",
  "Turizm Rehberliği",
  "Gastronomi ve Mutfak Sanatları",
];

const COMMON_VETERINARY = ["Veteriner Hekimliği"];

const COMMON_MARITIME = [
  "Deniz Ulaştırma İşletme Mühendisliği",
  "Gemi Makineleri İşletme Mühendisliği",
  "Denizcilik İşletmeleri Yönetimi",
];

// =============================================
// ÖNLISANS (Associate Degree) Programs
// =============================================
export const ONLISANS_PROGRAMS = [
  // Teknik Programlar
  "Bilgisayar Programcılığı",
  "Bilgisayar Teknolojisi",
  "Bilişim Güvenliği Teknolojisi",
  "Yapay Zeka ve Veri Bilimi (Önlisans)",
  "Web Tasarımı ve Kodlama",
  "Bilgisayar Destekli Tasarım ve Animasyon",
  "Elektrik",
  "Elektronik Teknolojisi",
  "Elektronik Haberleşme Teknolojisi",
  "Makine",
  "Otomotiv Teknolojisi",
  "Mekatronik",
  "Endüstriyel Otomasyon",
  "İnşaat Teknolojisi",
  "Harita ve Kadastro",
  "İklimlendirme ve Soğutma Teknolojisi",
  "Gıda Teknolojisi",
  "Kimya Teknolojisi",
  "Tekstil Teknolojisi",
  "Mobilya ve Dekorasyon",
  "İç Mekan Tasarımı",
  "Grafik Tasarımı (Önlisans)",
  "Moda Tasarımı",
  "Mimari Restorasyon",
  "Biyomedikal Cihaz Teknolojisi",
  "Radyo ve Televizyon Teknolojisi",
  "Basım ve Yayın Teknolojileri",
  "Matbaacılık ve Yayın Teknolojileri",
  "Sivil Havacılık Kabin Hizmetleri",
  "Uçak Teknolojisi",
  "Deniz ve Liman İşletmeciliği",
  "Raylı Sistemler İşletmeciliği",
  "Lojistik",
  "Enerji Tesisleri İşletmeciliği",
  "Alternatif Enerji Kaynakları Teknolojisi",
  "Çevre Koruma ve Kontrol",
  "İş Sağlığı ve Güvenliği",
  "Maden Teknolojisi",
  "Laborant ve Veteriner Sağlık",
  "Seracılık",
  "Organik Tarım",
  "Peyzaj ve Süs Bitkileri",
  "Aşçılık",
  "Pastacılık ve Fırıncılık",
  "Süt ve Ürünleri Teknolojisi",
  "Et ve Ürünleri Teknolojisi",
  // Sağlık Programları
  "Ameliyathane Hizmetleri",
  "Anestezi",
  "Diyaliz",
  "Diş Protez Teknolojisi",
  "Eczane Hizmetleri",
  "Fizyoterapi (Önlisans)",
  "İlk ve Acil Yardım",
  "Optisyenlik",
  "Odyometri",
  "Paramedik",
  "Patoloji Laboratuvar Teknikleri",
  "Radyoterapi",
  "Sağlık Kurumları İşletmeciliği",
  "Tıbbi Dokümantasyon ve Sekreterlik",
  "Tıbbi Görüntüleme Teknikleri",
  "Tıbbi Laboratuvar Teknikleri",
  "Yaşlı Bakımı",
  "Çocuk Gelişimi",
  "Engelli Bakımı ve Rehabilitasyon",
  // İdari ve Sosyal Programlar
  "Muhasebe ve Vergi Uygulamaları",
  "İşletme Yönetimi",
  "Bankacılık ve Sigortacılık",
  "Dış Ticaret",
  "Pazarlama",
  "Halkla İlişkiler ve Tanıtım (Önlisans)",
  "İnsan Kaynakları Yönetimi",
  "Yerel Yönetimler",
  "Büro Yönetimi ve Yönetici Asistanlığı",
  "Turizm ve Otel İşletmeciliği",
  "Turizm ve Seyahat Hizmetleri",
  "Adalet",
  "Sosyal Hizmetler",
  "Medya ve İletişim",
  "Fotoğrafçılık ve Kameramanlık",
  "Spor Yönetimi (Önlisans)",
  "Emlak Yönetimi",
  "Kooperatifçilik",
  "Tapu ve Kadastro",
  "Maliye (Önlisans)",
];

// Full department set for large state universities
const FULL_DEPARTMENTS = [
  ...COMMON_ENGINEERING,
  ...COMMON_SCIENCE,
  ...COMMON_ARTS,
  ...COMMON_ECONOMICS,
  ...COMMON_EDUCATION,
  ...COMMON_LAW,
  ...COMMON_MEDICINE,
  ...COMMON_HEALTH,
  ...COMMON_COMMUNICATION,
  ...COMMON_ARCHITECTURE,
  ...COMMON_AGRICULTURE,
  ...COMMON_FINE_ARTS,
  ...COMMON_SPORTS,
  ...COMMON_THEOLOGY,
  ...COMMON_TOURISM,
  ...ONLISANS_PROGRAMS,
];

// Standard departments for medium universities
const STANDARD_DEPARTMENTS = [
  ...COMMON_ENGINEERING.slice(0, 8),
  ...COMMON_SCIENCE,
  ...COMMON_ARTS.slice(0, 5),
  ...COMMON_ECONOMICS,
  ...COMMON_EDUCATION.slice(0, 5),
  ...COMMON_MEDICINE,
  ...COMMON_HEALTH,
  ...COMMON_COMMUNICATION.slice(0, 3),
  ...ONLISANS_PROGRAMS.slice(0, 40),
];

// Compact departments for smaller/newer universities
const COMPACT_DEPARTMENTS = [
  ...COMMON_ENGINEERING.slice(0, 5),
  ...COMMON_SCIENCE.slice(0, 4),
  ...COMMON_ECONOMICS.slice(0, 4),
  ...COMMON_EDUCATION.slice(0, 3),
  ...COMMON_HEALTH.slice(0, 3),
  ...ONLISANS_PROGRAMS.slice(0, 25),
];

// University list with metadata
export const UNIVERSITIES: University[] = [
  // Popular / Major State Universities
  { name: "İstanbul Üniversitesi", city: "İstanbul", type: "devlet", popular: true },
  { name: "İstanbul Teknik Üniversitesi", city: "İstanbul", type: "devlet", popular: true },
  { name: "Boğaziçi Üniversitesi", city: "İstanbul", type: "devlet", popular: true },
  { name: "Orta Doğu Teknik Üniversitesi", city: "Ankara", type: "devlet", popular: true },
  { name: "Hacettepe Üniversitesi", city: "Ankara", type: "devlet", popular: true },
  { name: "Ankara Üniversitesi", city: "Ankara", type: "devlet", popular: true },
  { name: "Ege Üniversitesi", city: "İzmir", type: "devlet", popular: true },
  { name: "Dokuz Eylül Üniversitesi", city: "İzmir", type: "devlet", popular: true },
  { name: "Gazi Üniversitesi", city: "Ankara", type: "devlet", popular: true },
  { name: "Marmara Üniversitesi", city: "İstanbul", type: "devlet", popular: true },
  { name: "Yıldız Teknik Üniversitesi", city: "İstanbul", type: "devlet", popular: true },
  { name: "Atatürk Üniversitesi", city: "Erzurum", type: "devlet", popular: true },
  { name: "Çukurova Üniversitesi", city: "Adana", type: "devlet", popular: true },
  { name: "Erciyes Üniversitesi", city: "Kayseri", type: "devlet", popular: true },
  { name: "Anadolu Üniversitesi", city: "Eskişehir", type: "devlet", popular: true },
  { name: "Akdeniz Üniversitesi", city: "Antalya", type: "devlet", popular: true },
  // Popular Foundation Universities
  { name: "Koç Üniversitesi", city: "İstanbul", type: "vakıf", popular: true },
  { name: "Sabancı Üniversitesi", city: "İstanbul", type: "vakıf", popular: true },
  { name: "Bilkent Üniversitesi", city: "Ankara", type: "vakıf", popular: true },
  { name: "Özyeğin Üniversitesi", city: "İstanbul", type: "vakıf", popular: true },
  // State Universities (alphabetical)
  { name: "Abdullah Gül Üniversitesi", city: "Kayseri", type: "devlet" },
  { name: "Adana Alparslan Türkeş Bilim ve Teknoloji Üniversitesi", city: "Adana", type: "devlet" },
  { name: "Adıyaman Üniversitesi", city: "Adıyaman", type: "devlet" },
  { name: "Afyon Kocatepe Üniversitesi", city: "Afyonkarahisar", type: "devlet" },
  { name: "Afyonkarahisar Sağlık Bilimleri Üniversitesi", city: "Afyonkarahisar", type: "devlet" },
  { name: "Ağrı İbrahim Çeçen Üniversitesi", city: "Ağrı", type: "devlet" },
  { name: "Aksaray Üniversitesi", city: "Aksaray", type: "devlet" },
  { name: "Alanya Alaaddin Keykubat Üniversitesi", city: "Antalya", type: "devlet" },
  { name: "Amasya Üniversitesi", city: "Amasya", type: "devlet" },
  { name: "Ankara Hacı Bayram Veli Üniversitesi", city: "Ankara", type: "devlet" },
  { name: "Ankara Müzik ve Güzel Sanatlar Üniversitesi", city: "Ankara", type: "devlet" },
  { name: "Ankara Sosyal Bilimler Üniversitesi", city: "Ankara", type: "devlet" },
  { name: "Ankara Yıldırım Beyazıt Üniversitesi", city: "Ankara", type: "devlet" },
  { name: "Ardahan Üniversitesi", city: "Ardahan", type: "devlet" },
  { name: "Artvin Çoruh Üniversitesi", city: "Artvin", type: "devlet" },
  { name: "Aydın Adnan Menderes Üniversitesi", city: "Aydın", type: "devlet" },
  { name: "Balıkesir Üniversitesi", city: "Balıkesir", type: "devlet" },
  { name: "Bandırma Onyedi Eylül Üniversitesi", city: "Balıkesir", type: "devlet" },
  { name: "Bartın Üniversitesi", city: "Bartın", type: "devlet" },
  { name: "Batman Üniversitesi", city: "Batman", type: "devlet" },
  { name: "Bayburt Üniversitesi", city: "Bayburt", type: "devlet" },
  { name: "Bilecik Şeyh Edebali Üniversitesi", city: "Bilecik", type: "devlet" },
  { name: "Bingöl Üniversitesi", city: "Bingöl", type: "devlet" },
  { name: "Bitlis Eren Üniversitesi", city: "Bitlis", type: "devlet" },
  { name: "Bolu Abant İzzet Baysal Üniversitesi", city: "Bolu", type: "devlet" },
  { name: "Burdur Mehmet Akif Ersoy Üniversitesi", city: "Burdur", type: "devlet" },
  { name: "Bursa Teknik Üniversitesi", city: "Bursa", type: "devlet" },
  { name: "Bursa Uludağ Üniversitesi", city: "Bursa", type: "devlet" },
  { name: "Çanakkale Onsekiz Mart Üniversitesi", city: "Çanakkale", type: "devlet" },
  { name: "Çankırı Karatekin Üniversitesi", city: "Çankırı", type: "devlet" },
  { name: "Dicle Üniversitesi", city: "Diyarbakır", type: "devlet" },
  { name: "Düzce Üniversitesi", city: "Düzce", type: "devlet" },
  { name: "Erzincan Binali Yıldırım Üniversitesi", city: "Erzincan", type: "devlet" },
  { name: "Erzurum Teknik Üniversitesi", city: "Erzurum", type: "devlet" },
  { name: "Eskişehir Osmangazi Üniversitesi", city: "Eskişehir", type: "devlet" },
  { name: "Eskişehir Teknik Üniversitesi", city: "Eskişehir", type: "devlet" },
  { name: "Fırat Üniversitesi", city: "Elazığ", type: "devlet" },
  { name: "Galatasaray Üniversitesi", city: "İstanbul", type: "devlet" },
  { name: "Gaziantep Üniversitesi", city: "Gaziantep", type: "devlet" },
  { name: "Gaziantep İslam Bilim ve Teknoloji Üniversitesi", city: "Gaziantep", type: "devlet" },
  { name: "Gebze Teknik Üniversitesi", city: "Kocaeli", type: "devlet" },
  { name: "Giresun Üniversitesi", city: "Giresun", type: "devlet" },
  { name: "Gümüşhane Üniversitesi", city: "Gümüşhane", type: "devlet" },
  { name: "Hakkari Üniversitesi", city: "Hakkari", type: "devlet" },
  { name: "Harran Üniversitesi", city: "Şanlıurfa", type: "devlet" },
  { name: "Hatay Mustafa Kemal Üniversitesi", city: "Hatay", type: "devlet" },
  { name: "Hitit Üniversitesi", city: "Çorum", type: "devlet" },
  { name: "Iğdır Üniversitesi", city: "Iğdır", type: "devlet" },
  { name: "Isparta Uygulamalı Bilimler Üniversitesi", city: "Isparta", type: "devlet" },
  { name: "İnönü Üniversitesi", city: "Malatya", type: "devlet" },
  { name: "İskenderun Teknik Üniversitesi", city: "Hatay", type: "devlet" },
  { name: "İstanbul Medeniyet Üniversitesi", city: "İstanbul", type: "devlet" },
  { name: "İstanbul Üniversitesi-Cerrahpaşa", city: "İstanbul", type: "devlet" },
  { name: "İzmir Bakırçay Üniversitesi", city: "İzmir", type: "devlet" },
  { name: "İzmir Demokrasi Üniversitesi", city: "İzmir", type: "devlet" },
  { name: "İzmir Kâtip Çelebi Üniversitesi", city: "İzmir", type: "devlet" },
  { name: "İzmir Yüksek Teknoloji Enstitüsü", city: "İzmir", type: "devlet" },
  { name: "Kafkas Üniversitesi", city: "Kars", type: "devlet" },
  { name: "Kahramanmaraş İstiklal Üniversitesi", city: "Kahramanmaraş", type: "devlet" },
  { name: "Kahramanmaraş Sütçü İmam Üniversitesi", city: "Kahramanmaraş", type: "devlet" },
  { name: "Karabük Üniversitesi", city: "Karabük", type: "devlet" },
  { name: "Karadeniz Teknik Üniversitesi", city: "Trabzon", type: "devlet" },
  { name: "Karamanoğlu Mehmetbey Üniversitesi", city: "Karaman", type: "devlet" },
  { name: "Kastamonu Üniversitesi", city: "Kastamonu", type: "devlet" },
  { name: "Kayseri Üniversitesi", city: "Kayseri", type: "devlet" },
  { name: "Kırıkkale Üniversitesi", city: "Kırıkkale", type: "devlet" },
  { name: "Kırklareli Üniversitesi", city: "Kırklareli", type: "devlet" },
  { name: "Kırşehir Ahi Evran Üniversitesi", city: "Kırşehir", type: "devlet" },
  { name: "Kilis 7 Aralık Üniversitesi", city: "Kilis", type: "devlet" },
  { name: "Kocaeli Üniversitesi", city: "Kocaeli", type: "devlet" },
  { name: "Konya Teknik Üniversitesi", city: "Konya", type: "devlet" },
  { name: "Kütahya Dumlupınar Üniversitesi", city: "Kütahya", type: "devlet" },
  { name: "Kütahya Sağlık Bilimleri Üniversitesi", city: "Kütahya", type: "devlet" },
  { name: "Malatya Turgut Özal Üniversitesi", city: "Malatya", type: "devlet" },
  { name: "Manisa Celal Bayar Üniversitesi", city: "Manisa", type: "devlet" },
  { name: "Mardin Artuklu Üniversitesi", city: "Mardin", type: "devlet" },
  { name: "Mersin Üniversitesi", city: "Mersin", type: "devlet" },
  { name: "Mimar Sinan Güzel Sanatlar Üniversitesi", city: "İstanbul", type: "devlet" },
  { name: "Muğla Sıtkı Koçman Üniversitesi", city: "Muğla", type: "devlet" },
  { name: "Munzur Üniversitesi", city: "Tunceli", type: "devlet" },
  { name: "Muş Alparslan Üniversitesi", city: "Muş", type: "devlet" },
  { name: "Necmettin Erbakan Üniversitesi", city: "Konya", type: "devlet" },
  { name: "Nevşehir Hacı Bektaş Veli Üniversitesi", city: "Nevşehir", type: "devlet" },
  { name: "Niğde Ömer Halisdemir Üniversitesi", city: "Niğde", type: "devlet" },
  { name: "Ondokuz Mayıs Üniversitesi", city: "Samsun", type: "devlet" },
  { name: "Ordu Üniversitesi", city: "Ordu", type: "devlet" },
  { name: "Osmaniye Korkut Ata Üniversitesi", city: "Osmaniye", type: "devlet" },
  { name: "Pamukkale Üniversitesi", city: "Denizli", type: "devlet" },
  { name: "Recep Tayyip Erdoğan Üniversitesi", city: "Rize", type: "devlet" },
  { name: "Sağlık Bilimleri Üniversitesi", city: "İstanbul", type: "devlet" },
  { name: "Sakarya Üniversitesi", city: "Sakarya", type: "devlet" },
  { name: "Sakarya Uygulamalı Bilimler Üniversitesi", city: "Sakarya", type: "devlet" },
  { name: "Samsun Üniversitesi", city: "Samsun", type: "devlet" },
  { name: "Selçuk Üniversitesi", city: "Konya", type: "devlet" },
  { name: "Siirt Üniversitesi", city: "Siirt", type: "devlet" },
  { name: "Sinop Üniversitesi", city: "Sinop", type: "devlet" },
  { name: "Sivas Bilim ve Teknoloji Üniversitesi", city: "Sivas", type: "devlet" },
  { name: "Sivas Cumhuriyet Üniversitesi", city: "Sivas", type: "devlet" },
  { name: "Süleyman Demirel Üniversitesi", city: "Isparta", type: "devlet" },
  { name: "Şırnak Üniversitesi", city: "Şırnak", type: "devlet" },
  { name: "Tarsus Üniversitesi", city: "Mersin", type: "devlet" },
  { name: "Tekirdağ Namık Kemal Üniversitesi", city: "Tekirdağ", type: "devlet" },
  { name: "Tokat Gaziosmanpaşa Üniversitesi", city: "Tokat", type: "devlet" },
  { name: "Trakya Üniversitesi", city: "Edirne", type: "devlet" },
  { name: "Trabzon Üniversitesi", city: "Trabzon", type: "devlet" },
  { name: "Türk-Alman Üniversitesi", city: "İstanbul", type: "devlet" },
  { name: "Türk-Japon Bilim ve Teknoloji Üniversitesi", city: "İstanbul", type: "devlet" },
  { name: "Uşak Üniversitesi", city: "Uşak", type: "devlet" },
  { name: "Van Yüzüncü Yıl Üniversitesi", city: "Van", type: "devlet" },
  { name: "Yalova Üniversitesi", city: "Yalova", type: "devlet" },
  { name: "Yozgat Bozok Üniversitesi", city: "Yozgat", type: "devlet" },
  { name: "Zonguldak Bülent Ecevit Üniversitesi", city: "Zonguldak", type: "devlet" },
  // Foundation Universities
  { name: "Acıbadem Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Alanya Üniversitesi", city: "Antalya", type: "vakıf" },
  { name: "Altınbaş Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Ankara Bilim Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Ankara Medipol Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Antalya Belek Üniversitesi", city: "Antalya", type: "vakıf" },
  { name: "Antalya Bilim Üniversitesi", city: "Antalya", type: "vakıf" },
  { name: "Atılım Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Avrasya Üniversitesi", city: "Trabzon", type: "vakıf" },
  { name: "Bahçeşehir Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Başkent Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Beykent Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Beykoz Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Bezmiâlem Vakıf Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Biruni Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Çağ Üniversitesi", city: "Mersin", type: "vakıf" },
  { name: "Çankaya Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Demiroğlu Bilim Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Doğuş Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Fatih Sultan Mehmet Vakıf Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Fenerbahçe Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Haliç Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Hasan Kalyoncu Üniversitesi", city: "Gaziantep", type: "vakıf" },
  { name: "İbn Haldun Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Işık Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul 29 Mayıs Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Arel Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Atlas Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Aydın Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Bilgi Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Esenyurt Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Galata Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Gedik Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Gelişim Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Kent Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Kültür Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Medipol Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Okan Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Rumeli Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Sabahattin Zaim Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Sağlık ve Teknoloji Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Ticaret Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Topkapı Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstanbul Yeni Yüzyıl Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İstinye Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "İzmir Ekonomi Üniversitesi", city: "İzmir", type: "vakıf" },
  { name: "İzmir Tınaztepe Üniversitesi", city: "İzmir", type: "vakıf" },
  { name: "Kadir Has Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Kapadokya Üniversitesi", city: "Nevşehir", type: "vakıf" },
  { name: "Kocaeli Sağlık ve Teknoloji Üniversitesi", city: "Kocaeli", type: "vakıf" },
  { name: "Konya Gıda ve Tarım Üniversitesi", city: "Konya", type: "vakıf" },
  { name: "KTO Karatay Üniversitesi", city: "Konya", type: "vakıf" },
  { name: "Lokman Hekim Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Maltepe Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "MEF Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Mudanya Üniversitesi", city: "Bursa", type: "vakıf" },
  { name: "Nişantaşı Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Nuh Naci Yazgan Üniversitesi", city: "Kayseri", type: "vakıf" },
  { name: "Ostim Teknik Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Piri Reis Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Sanko Üniversitesi", city: "Gaziantep", type: "vakıf" },
  { name: "TED Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "TOBB Ekonomi ve Teknoloji Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Toros Üniversitesi", city: "Mersin", type: "vakıf" },
  { name: "Türk Hava Kurumu Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Ufuk Üniversitesi", city: "Ankara", type: "vakıf" },
  { name: "Üsküdar Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Yaşar Üniversitesi", city: "İzmir", type: "vakıf" },
  { name: "Yeditepe Üniversitesi", city: "İstanbul", type: "vakıf" },
  { name: "Yüksek İhtisas Üniversitesi", city: "Ankara", type: "vakıf" },
];

// Map university names to department lists based on size/type
const LARGE_UNIVERSITIES = new Set([
  "İstanbul Üniversitesi",
  "İstanbul Teknik Üniversitesi",
  "Boğaziçi Üniversitesi",
  "Orta Doğu Teknik Üniversitesi",
  "Hacettepe Üniversitesi",
  "Ankara Üniversitesi",
  "Ege Üniversitesi",
  "Dokuz Eylül Üniversitesi",
  "Gazi Üniversitesi",
  "Marmara Üniversitesi",
  "Atatürk Üniversitesi",
  "Çukurova Üniversitesi",
  "Erciyes Üniversitesi",
  "Selçuk Üniversitesi",
  "Ondokuz Mayıs Üniversitesi",
  "Karadeniz Teknik Üniversitesi",
  "Fırat Üniversitesi",
  "İnönü Üniversitesi",
  "Süleyman Demirel Üniversitesi",
  "Pamukkale Üniversitesi",
  "Sakarya Üniversitesi",
  "Kocaeli Üniversitesi",
  "Mersin Üniversitesi",
  "Bursa Uludağ Üniversitesi",
  "Akdeniz Üniversitesi",
  "Dicle Üniversitesi",
  "İstanbul Üniversitesi-Cerrahpaşa",
  "Sağlık Bilimleri Üniversitesi",
  "Aydın Adnan Menderes Üniversitesi",
  "Trakya Üniversitesi",
  "Manisa Celal Bayar Üniversitesi",
  "Gaziantep Üniversitesi",
  "Koç Üniversitesi",
  "Sabancı Üniversitesi",
  "Bilkent Üniversitesi",
  "Yeditepe Üniversitesi",
  "Bahçeşehir Üniversitesi",
  "İstanbul Bilgi Üniversitesi",
]);

const TECH_UNIVERSITIES = new Set([
  "İstanbul Teknik Üniversitesi",
  "Yıldız Teknik Üniversitesi",
  "Karadeniz Teknik Üniversitesi",
  "Gebze Teknik Üniversitesi",
  "Bursa Teknik Üniversitesi",
  "Eskişehir Teknik Üniversitesi",
  "Konya Teknik Üniversitesi",
  "İskenderun Teknik Üniversitesi",
  "Erzurum Teknik Üniversitesi",
  "İzmir Yüksek Teknoloji Enstitüsü",
  "Orta Doğu Teknik Üniversitesi",
  "Boğaziçi Üniversitesi",
  "Türk-Japon Bilim ve Teknoloji Üniversitesi",
]);

/**
 * Get departments for a given university.
 * Large universities get the full list, tech universities get engineering-heavy lists,
 * smaller universities get compact lists.
 */
export function getDepartmentsForUniversity(universityName: string): string[] {
  if (!universityName) return [];

  let departments: string[];

  if (LARGE_UNIVERSITIES.has(universityName)) {
    departments = [...FULL_DEPARTMENTS];
    // Add veterinary for some large universities
    if (["Ankara Üniversitesi", "İstanbul Üniversitesi", "Selçuk Üniversitesi", 
         "Atatürk Üniversitesi", "Fırat Üniversitesi", "Bursa Uludağ Üniversitesi",
         "Erciyes Üniversitesi"].includes(universityName)) {
      departments.push(...COMMON_VETERINARY);
    }
  } else if (TECH_UNIVERSITIES.has(universityName)) {
    departments = [
      ...COMMON_ENGINEERING,
      ...COMMON_SCIENCE,
      ...COMMON_ARCHITECTURE,
      ...COMMON_MARITIME.slice(0, 2),
      "İşletme",
      "İktisat",
      ...ONLISANS_PROGRAMS.slice(0, 30),
    ];
  } else {
    // Check if it's a known state university (medium) or small
    const uni = UNIVERSITIES.find(u => u.name === universityName);
    if (uni?.type === "vakıf") {
      // Foundation universities tend to have focused programs
      departments = [
        ...COMMON_ENGINEERING.slice(0, 6),
        ...COMMON_SCIENCE.slice(0, 4),
        ...COMMON_ECONOMICS,
        ...COMMON_ARTS.slice(0, 4),
        ...COMMON_HEALTH,
        ...COMMON_COMMUNICATION,
        ...COMMON_LAW,
        ...COMMON_ARCHITECTURE.slice(0, 3),
        ...COMMON_FINE_ARTS.slice(0, 3),
        ...ONLISANS_PROGRAMS.slice(0, 30),
      ];
    } else {
      departments = [...STANDARD_DEPARTMENTS];
    }
  }

  // Remove duplicates and sort alphabetically (Turkish locale)
  return [...new Set(departments)].sort((a, b) => a.localeCompare(b, "tr"));
}

/**
 * Get sorted list of university names.
 * Popular universities appear first, then alphabetical.
 */
export function getSortedUniversities(): University[] {
  const popular = UNIVERSITIES.filter(u => u.popular).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const rest = UNIVERSITIES.filter(u => !u.popular).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  return [...popular, ...rest];
}

/**
 * Search universities by name or city.
 */
export function searchUniversities(query: string): University[] {
  if (!query.trim()) return getSortedUniversities();
  const q = query.toLowerCase().replace(/i̇/g, "i");
  return getSortedUniversities().filter(
    u =>
      u.name.toLowerCase().replace(/i̇/g, "i").includes(q) ||
      u.city.toLowerCase().replace(/i̇/g, "i").includes(q)
  );
}

/**
 * Search departments by name.
 */
export function searchDepartments(departments: string[], query: string): string[] {
  if (!query.trim()) return departments;
  const q = query.toLowerCase().replace(/i̇/g, "i");
  return departments.filter(d => d.toLowerCase().replace(/i̇/g, "i").includes(q));
}

/**
 * Validate that a university exists in our list.
 */
export function isValidUniversity(name: string): boolean {
  return UNIVERSITIES.some(u => u.name === name);
}

/**
 * Validate that a department exists for the given university.
 */
export function isValidDepartment(universityName: string, departmentName: string): boolean {
  const departments = getDepartmentsForUniversity(universityName);
  return departments.includes(departmentName);
}
