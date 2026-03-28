/**
 * Client-side profanity pre-filter for Turkish content.
 * Fast check before sending to AI moderation — catches obvious violations instantly.
 * COMPREHENSIVE: Covers Turkish, English, and common bypass attempts.
 */

// ============================================================
// TURKISH PROFANITY PATTERNS (obfuscation-aware)
// ============================================================
const TURKISH_PROFANITY_PATTERNS = [
  // Core Turkish swear words with leetspeak/spacing bypass
  /s[i1ıİ!][kKğ][i1ıİ!][şsṣ§ŝ]/i,
  /s[i1ıİ!]k[tT][i1ıİ!]r/i,
  /s[i1ıİ!]k[eEəé]r[i1ıİ!]m/i,
  /s[i1ıİ!]k[i1ıİ!]m/i,
  /s[i1ıİ!]k[eEəé]n/i,
  /s[i1ıİ!]k[i1ıİ!]c[i1ıİ!]/i,
  /a[mn]c[iı1ıİ!][kğgq]/i,
  /a[mn][ıi1][nN][ıi1]\s*(?:s[i1ıİ]k|a[mn]|g[öo]t)/i,
  /a[mn][ıi1]na?\s*k[oö0][yY]/i,
  /o[rŗ]o[sş§][pP][uü]/i,
  /p[i1ıİ!][çc][^a-zA-ZğüşöçıİĞÜŞÖÇ]/i,
  /\bp[i1ıİ!][çc]\b/i,
  /g[öo0][tT]\s*(?:[üu][nN]|ver|lal|[eé]n)/i,
  /g[öo0]tv[eé]r[eé]n/i,
  /y[aâ]rr?[aâ][kğgq]/i,
  /t[aâ][şsṣ][şsṣ][aâ][kğgq]/i,
  /d[aâ][şsṣ][şsṣ][aâ][kğgq]/i,
  /k[aâ]hpe/i,
  /(?:^|\s)ibne(?:\s|$|[.,!?])/i,
  /z[iı1]k[iı1][yş]/i,
  /g[aA]v[aA]t/i,
  /p[eé]z[eé]v[eé]nk/i,
  /f[aA]h[iı]?[şsṣ][eé]/i,
  /k[aA]lt[aA]k/i,
  /d[aA]ly[aA]rr?[aA]k/i,
  /h[aA]ys[iı]y[eé]ts[iı]z/i,
  /n[aA]m[uü]ss[uü]z/i,
  /[şsṣ][eé]r[eé]fs[iı]z/i,
  /s[aA]p[ıi]k/i,
  /t[aA]c[iı]zc[iı]/i,
  /h[aA]ss[iı]kt[iı]r/i,
  /y[aA]v[şsṣ][aA]k/i,

  // Abbreviations and coded forms
  /(?:^|\s)mk\b/i,
  /(?:^|\s)amk\b/i,
  /(?:^|\s)aq\b/i,
  /(?:^|\s)a\.?q\.?\b/i,
  /(?:^|\s)s\.?g\.?\b/i,
  /(?:^|\s)a\.?m\.?k\.?\b/i,
  /(?:^|\s)o\.?ç\.?\b/i,
  /(?:^|\s)s\.?k\.?t\.?r\.?\b/i,
  /(?:^|\s)sktr\b/i,
  /(?:^|\s)amcık/i,
  /(?:^|\s)amck\b/i,
  /(?:^|\s)amkk\b/i,
  /(?:^|\s)anan[ıi]/i,
  /(?:^|\s)annen[iı]/i,
  /(?:^|\s)anas[ıi]n[ıi]/i,
  /(?:^|\s)bacın[ıi]/i,
  /31[cç][iı]/i,
  /otuzb[iı]r/i,
  
  // Leetspeak Turkish: @mına, s!kt!r, etc.
  /@m[ıi]na/i,
  /s!kt!r/i,
  /s[!1]k[!1][sş]/i,
  /@mq/i,
  /@mk/i,
];

// ============================================================
// ENGLISH PROFANITY PATTERNS
// ============================================================
const ENGLISH_PROFANITY_PATTERNS = [
  /\bf+[uü]+c+k+/i,
  /\bsh[i1!]+t+\b/i,
  /\bb[i1!]tch/i,
  /\bass\s*hole/i,
  /\bc[uü]+nt\b/i,
  /\bwh[o0]re/i,
  /\bsl[uü]+t/i,
  /\bd[i1!]ck(?:head|face|sucker)?/i,
  /\bc[o0]ck\s*(?:suck|head)/i,
  /\bmoth[eé]rf/i,
  /\bstfu\b/i,
  /\bgtfo\b/i,
  /\bn[i1!]g+[eaə3]+r/i,
  /\bf[a4@]+g+[o0]+t/i,
  /\bretard(?:ed)?\b/i,
  /\bwanker/i,
  /\btwat\b/i,
  /\bjackass/i,
  /\bdumb\s*(?:ass|fuck)/i,
];

// ============================================================
// SEXUAL / NSFW CONTENT PATTERNS
// ============================================================
const SEXUAL_PATTERNS = [
  /siki[şs](?:elim|mek|me|iyor|en|ek)/i,
  /s[eé]ks\s*(?:yap|ist[eé]|öner|et)/i,
  /oral\s*seks/i,
  /anal\s*seks/i,
  /cinsel\s*(?:ili[şs]ki|i[çc]erik|organ|taciz|istismar)/i,
  /göğüs\s*(?:at|gönder|foto)/i,
  /nude\s*(?:at|gönder|foto)/i,
  /çıplak\s*(?:foto|resim|video)/i,
  /ifşa\s*(?:at|gönder|izle|video)/i,
  /dick\s*pic/i,
  /send\s*nudes?/i,
  /\bp[o0]rn(?:o|ography|ografik|ostar|hub)?\b/i,
  /\bhentai\b/i,
  /\bmilf\b/i,
  /\bxxx+\b/i,
  /\bxvideos?\b/i,
  /\bxnxx\b/i,
  /\bxhamster\b/i,
  /\bredtube\b/i,
  /\byouporn\b/i,
  /\btube8\b/i,
  /\bbrazzers\b/i,
  /\bbangbros\b/i,
  /\breality\s*kings\b/i,
  /\bonlyfans\b/i,
  /\bchaturbate\b/i,
  /\bstripchat\b/i,
  /\bbonga\s*cams?\b/i,
  /\bcam\s*soda\b/i,
  /\bmyfreecams?\b/i,
  /\badult\s*friend\s*finder\b/i,
  /\bashley\s*madison\b/i,
  /\btinder\b/i,
  /\bbadoo\b/i,
  /\bgrindr\b/i,
  /\bfetlife\b/i,
  /\bliterotica\b/i,
  /\bhandjob\b/i,
  /\bblowjob\b/i,
  /\bcumshot\b/i,
  /\bdildo\b/i,
  /\borgasm/i,
  /\bmastür(?:basyon|b)/i,
  /\b31\s*çek/i,
  /\botuzbir\s*çek/i,
  /\bam\s*yala/i,
  /\byarak\s*yala/i,
  /\bsik\s*yala/i,
  /\bgöt\s*yala/i,
  /\bsex\s*chat\b/i,
  /\bcyber\s*sex\b/i,
  /\berotik/i,
  /\bescort\b/i,
  /\bseks\s*işçi/i,
  /\bgenelev/i,
  /\brani?devu/i,
  /\bswingers?\b/i,
  /\bbdsm\b/i,
  /\bfetish/i,
  /\bdominatrix/i,
  /\bsadomazo/i,
];

// ============================================================
// THREAT / VIOLENCE PATTERNS
// ============================================================
const THREAT_PATTERNS = [
  /öldür[üu]r[üu]m/i,
  /seni\s*(?:öldür|bıçakla|vurur|keser|döver|yakala|bul[ua]r|sik)/i,
  /kafan[ıi]\s*(?:kırar|kopar|keser|uçurur|ezer)/i,
  /b[ıi]çak(?:lar[ıi]m|layacağ[ıi]m|la)/i,
  /bomba(?:l[ıi]yacağ[ıi]m|lar[ıi]m|la)/i,
  /intihar\s*et/i,
  /kendini\s*(?:öldür|as|kes|yak)/i,
  /kanını\s*(?:ak[ıi]t|döker)/i,
  /(?:silah|tabanca|tüfek)\s*(?:çek|sık|at)/i,
  /geber(?:t|eceksin|in)/i,
  /(?:öleceksin|ölürsün|öl\s+artık)/i,
  /(?:yakalar[ıi]m|bulurum)\s*seni/i,
  /(?:adresini|evini)\s*(?:bul|öğren)/i,
  /(?:mahalle|sokak)\s*(?:baskını|dayağı)/i,
];

// ============================================================
// HATE SPEECH PATTERNS
// ============================================================
const HATE_PATTERNS = [
  /ırk[çc][ıi]/i,
  /(?:^|\s)n[i1!]gg?[eaə3]r/i,
  /(?:^|\s)fa[gğ]+[oö]t/i,
  /gavur(?:lar)?(?:\s+(?:hepsi|hep|gebert|ölsün))/i,
  /ermeni\s*(?:dölü|piçi|soykırım)/i,
  /kürt\s*(?:eşeği|eşek|köpeği)/i,
  /suriyeli\s*(?:hepsi|defol|gebertilmeli|ölsün)/i,
  /göç?men\s*(?:defol|gebertilmeli|hepsi|ölsün)/i,
  /yahudi\s*(?:dölü|piçi|köpeği)/i,
  /arap\s*(?:dölü|piçi|köpeği)/i,
  /alevi\s*(?:dölü|piçi|köpeği|yakılmalı)/i,
  /(?:gay|eşcinsel|lezbiyen|trans)\s*(?:hastası|hastalık|sapık|iğrenç|ölsün)/i,
  /homo\s*(?:sapiens\b)?/i,
  /\btransfobi/i,
  /\bhomofobi/i,
  /\bırkçılık/i,
  /\bantisemit/i,
];

// ============================================================
// TERROR ORGANIZATIONS & EXTREMIST CONTENT
// ============================================================
const TERROR_ORG_PATTERNS = [
  // PKK and aliases
  /\bpkk\b/i,
  /\bkck\b/i,
  /\bhpg\b/i,
  /\btaj\b/i,
  /\bkadek\b/i,
  /\bkongra[\s-]?gel\b/i,
  /\bapo(?:cu|culuk|cular)?\b/i,
  /\böcalan/i,
  /\bbarzani/i,
  
  // FETÖ/PDY
  /\bfetö\b/i,
  /\bfeto\b/i,
  /\bpdy\b/i,
  /\bgülen(?:ci|ciler|ist)?\b/i,
  /\bcement?\s*gülen/i,
  /\bhizmet\s*hareketi/i,
  /\bbylock\b/i,
  /\bbank\s*asya\b/i,
  
  // DHKP-C
  /\bdhkp[\s-]?c?\b/i,
  
  // IŞİD/DAEŞ
  /\bi[şs]id\b/i,
  /\bdae[şs]\b/i,
  /\bisis\b/i,
  /\bisil\b/i,
  /\bjihad(?:ist|ci|cı|çı)?\b/i,
  /\bcihat(?:çı|cı)?\b/i,
  
  // Al-Qaeda
  /\bel[\s-]?kaide\b/i,
  /\bal[\s-]?qaeda\b/i,
  /\bal[\s-]?qa[iı]de\b/i,
  
  // TKP/ML, MLKP, TIKKO
  /\btkp[\s/-]?ml\b/i,
  /\bmlkp\b/i,
  /\btikko\b/i,
  
  // General extremist
  /\b(?:bomba|patlayıcı|c4)\s*(?:yap|hazırla|tarihi)/i,
  /\b(?:silah|mermi|roket)\s*(?:al|sat|yap|bul)/i,
  /\b(?:şehit|gazi)\s*(?:olun|düşsün)/i,
  /\bintikam\s*(?:alacağız|al[ıi]r[ıi]z)/i,
  /\bkatliam\s*(?:yap|olmalı)/i,
  /\bsoykırım\s*(?:yap|olmalı)/i,
];

// ============================================================
// SPAM / SCAM PATTERNS
// ============================================================
const SPAM_PATTERNS = [
  /(?:telegram|whatsapp)\s*(?:grup|kanal|link)/i,
  /(?:takip|follow)\s*(?:et|edin)\s*(?:@|http)/i,
  /(?:para|money)\s*kazan/i,
  /(?:bitcoin|crypto|kripto)\s*(?:yatırım|kazan)/i,
  /(?:bahis|bet)\s*(?:sitel|kazan|yap)/i,
  /(?:bedava|free)\s*(?:para|coin|token)/i,
  /(?:kazanmak|kazan)\s*(?:ister\s*misin|için\s*tıkla)/i,
  /(?:yatırım|invest)\s*(?:fırsat|şans|kazan)/i,
  /(?:hemen|şimdi)\s*(?:kazan|tıkla|katıl)/i,
  /(?:promosyon|kampanya)\s*(?:kodu|link)/i,
];

// ============================================================
// SELF-HARM / GROOMING / DOXXING PATTERNS  
// ============================================================
const DANGEROUS_PATTERNS = [
  // Self-harm encouragement
  /kendini\s*(?:kes|yak|zehirle|öldür|as)/i,
  /intihar\s*(?:et|yöntemi|nasıl)/i,
  /(?:bilek|damar)\s*(?:kes|kır)/i,
  /(?:yaşamaya|hayata)\s*(?:değmez|son\s*ver)/i,
  /(?:hap|ilaç)\s*(?:iç|yut)\s*(?:çok|fazla)/i,
  
  // Grooming patterns
  /kaç\s*yaşındasın/i,
  /(?:fotoğraf|foto|resim)\s*(?:at|gönder|atar\s*mısın)/i,
  /(?:buluşalım|görüşelim)\s*(?:gizli|kimse|yalnız)/i,
  /(?:kimse|anne|baba)\s*(?:bilmesin|görmesin|duymasın)/i,
  /(?:sır|gizli)\s*(?:kalsın|tut|aramızda)/i,
  
  // Doxxing
  /(?:adresi|evini|okulunu|numarası)\s*(?:paylaş|ver|at|yaz)/i,
  /(?:tc|kimlik)\s*(?:no|numarası)\s*(?:ver|at|paylaş)/i,
  /(?:ip\s*adres|lokasyon)\s*(?:bul|tespit|öğren)/i,
];

// ============================================================
// USERNAME-SPECIFIC PROFANITY (exact word matching)
// ============================================================
const USERNAME_PROFANITY_WORDS = [
  // Turkish
  "sik", "sikis", "sikim", "siken", "siker", "sikici", "sikti", "siktir", "siktirin", "siktim",
  "amcik", "amcuk", "amk", "amq", "amina", "aminakoyim", "aminakoydugum", "ananisikeyim",
  "orospu", "orospucocugu", "orospuevladi",
  "pic", "piclik", "picin", "pust",
  "yarrak", "yarram", "yarag", "yarak", "yarragim",
  "tassak", "tasak", "tassag",
  "dassak", "dasak", "dassag",
  "kahpe", "ibne", "ibneler",
  "gotveren", "gotten", "gotlek", "gotsuz", "got", "gotun", "gotunu",
  "gavat", "pezevenk", "fahise", "kaltak", "kevasen",
  "am", "amcigi", "amcigin",
  "31ci", "otuzbirci", "otuzbir",
  "hassiktir", "hssktr",
  "anani", "ananin", "ananizi", "anasini", "annesini",
  "bok", "boktan", "boklu",
  "dalyarak", "dalyarrak",
  "zikis", "zikim",
  "sktr", "amkk", "amck",
  "yavsakk", "yavsak",
  "sapik", "sapikk", "tacizci",

  // English
  "fuck", "fucker", "fucked", "fucking", "fck", "fcking", "fuk",
  "shit", "shitty", "bullshit",
  "dick", "dicks", "dickhead", "dickface",
  "pussy", "pussies",
  "bitch", "bitches", "biatch",
  "asshole", "arsehole",
  "bastard", "bastards",
  "whore", "whores",
  "slut", "sluts", "slutty",
  "cunt", "cunts",
  "cock", "cocks", "cocksucker",
  "wanker", "wank",
  "twat", "twats",
  "retard", "retarded",
  "nigger", "nigga", "niggas", "nigg3r", "n1gger",
  "faggot", "fag", "fags",
  "porn", "porno", "pornstar",
  "nude", "nudes",
  "penis", "vagina", "anal",
  "cum", "cumshot",
  "dildo", "orgasm",
  "hentai", "milf",
  "rape", "rapist",
  "molest",
  "pedo", "pedophile",
  "nazi", "nazist",
  "terrorist",
  "suicide",
  "tranny", "shemale",
  "motherfucker", "mf",
  "thot", "incel",
  "cuck", "cuckold",
  
  // Terror org names as usernames
  "pkk", "isis", "isid", "feto", "fetö", "dhkpc", "alqaeda", "elkaide",
  "jihad", "jihadist", "cihatci",

  // German / Spanish / French / Arabic / Russian
  "schlampe", "hurensohn", "wichser", "arschloch", "fotze", "scheisse",
  "puta", "puto", "mierda", "verga", "pendejo", "cabron", "chinga", "maricon",
  "merde", "putain", "salaud", "connard", "enculer",
  "sharmuta", "kuss", "kelb",
  "blyat", "suka", "pizdec", "nahui", "ebat",
];

const USERNAME_PROFANITY_SET = new Set(USERNAME_PROFANITY_WORDS.map(w => w.toLowerCase()));

const USERNAME_PROFANITY_REGEX_PATTERNS = [
  // Turkish embedded
  /s[i1]k(?:i[cs]|t[i1]r|[i1]m|en|er|[i1]c[i1])/i,
  /am[ck][i1u][gkq]/i,
  /orospu/i,
  /yarr?a[gkq]/i,
  /tass?a[gkq]/i,
  /dass?a[gkq]/i,
  /g[o0]tveren/i,
  /dalyar[ra]k/i,
  /aminak/i,
  /anani/i,
  
  // English embedded
  /f+u+c+k+/i,
  /sh[i1]+t+/i,
  /d[i1]ck/i,
  /p+u+ss+[yi]/i,
  /b[i1]tch/i,
  /a+ss+h+o+l+e/i,
  /wh[o0]re/i,
  /sl+u+t/i,
  /c+u+n+t/i,
  /n[i1]g+[e3a]+r/i,
  /f+[a4]+g+[o0]+t/i,
  /p[o0]rn/i,
  /r[a4]p[i1]st/i,
  /p[e3]d[o0]/i,
  /h[e3]nt[a4][i1]/i,
  /m[i1]lf/i,
  /cumsh[o0]t/i,
  /d[i1]ld[o0]/i,
  /m[o0]th[e3]rf/i,
  
  // Pornographic site names embedded
  /p[o0]rnhub/i,
  /xv[i1]de[o0]/i,
  /xnxx/i,
  /xhamst/i,
  /brazzers/i,
  /onlyfans/i,
  /chaturbate/i,
  
  // Terror orgs embedded  
  /pkk/i,
  /fetö|feto/i,
  /dhkpc/i,
  /i[sş]id/i,
  /jihad/i,
  /cihat/i,
];

/**
 * Check if a username contains profanity.
 */
export function checkUsernameProfanity(username: string): ProfanityCheckResult {
  if (!username || username.length < 2) return { safe: true };
  const lower = username.toLowerCase().replace(/[_\-. ]/g, "");
  
  if (USERNAME_PROFANITY_SET.has(lower)) {
    return { safe: false, violation_type: "profanity", reason: "Bu kullanıcı adı uygunsuz içerik barındırıyor." };
  }
  
  for (const word of USERNAME_PROFANITY_WORDS) {
    if (lower.includes(word)) {
      return { safe: false, violation_type: "profanity", reason: "Bu kullanıcı adı uygunsuz içerik barındırıyor." };
    }
  }
  
  for (const pattern of USERNAME_PROFANITY_REGEX_PATTERNS) {
    if (pattern.test(lower)) {
      return { safe: false, violation_type: "profanity", reason: "Bu kullanıcı adı uygunsuz içerik barındırıyor." };
    }
  }
  
  return { safe: true };
}

export interface ProfanityCheckResult {
  safe: boolean;
  violation_type?: string;
  reason?: string;
}

/**
 * Normalize text to defeat bypass attempts:
 * - Remove special chars used as separators
 * - Collapse multiple spaces
 * - Map Turkish chars: ı→i, ş→s, ö→o, ü→u, ç→c, ğ→g
 * - Map leetspeak: 1→i, 3→e, 0→o, @→a, $→s, !→i
 */
function normalizeForCheck(text: string): string {
  return text
    .replace(/[._\-*#@!$%^&(){}[\]|\\/<>~`'"]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/0/g, "o")
    .replace(/\$/g, "s")
    .replace(/!/g, "i")
    .replace(/@/g, "a")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .trim();
}

/**
 * Quick client-side profanity/content check.
 * Returns immediately without network call.
 * Runs ALL categories for comprehensive detection.
 */
export function quickContentCheck(text: string): ProfanityCheckResult {
  if (!text || text.trim().length < 2) return { safe: true };

  const normalized = normalizeForCheck(text);
  const lower = text.toLowerCase();

  // 1. Terror / extremist (highest priority)
  for (const pattern of TERROR_ORG_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text) || pattern.test(lower)) {
      return { safe: false, violation_type: "dangerous", reason: "Bu içerik terör/aşırılıkçılık unsurları içeriyor ve platform kurallarını ihlal ediyor." };
    }
  }

  // 2. Threats
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return { safe: false, violation_type: "threat", reason: "Bu mesaj tehdit içeriyor ve platform kurallarını ihlal ediyor." };
    }
  }

  // 3. Dangerous (self-harm, grooming, doxxing)
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return { safe: false, violation_type: "dangerous", reason: "Bu içerik tehlikeli unsurlar barındırıyor ve platform kurallarını ihlal ediyor." };
    }
  }

  // 4. Hate speech
  for (const pattern of HATE_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return { safe: false, violation_type: "hate_speech", reason: "Bu mesaj nefret söylemi içeriyor ve platform kurallarını ihlal ediyor." };
    }
  }

  // 5. Sexual / NSFW content
  for (const pattern of SEXUAL_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text) || pattern.test(lower)) {
      return { safe: false, violation_type: "sexual", reason: "Bu mesaj cinsel/müstehcen içerik barındırıyor ve platform kurallarını ihlal ediyor." };
    }
  }

  // 6. Turkish profanity
  for (const pattern of TURKISH_PROFANITY_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return { safe: false, violation_type: "profanity", reason: "Bu mesaj küfür içeriyor ve platform kurallarını ihlal ediyor." };
    }
  }

  // 7. English profanity
  for (const pattern of ENGLISH_PROFANITY_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return { safe: false, violation_type: "profanity", reason: "Bu mesaj küfür içeriyor ve platform kurallarını ihlal ediyor." };
    }
  }

  // 8. Spam
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return { safe: false, violation_type: "spam", reason: "Bu mesaj spam/promosyon içeriyor ve platform kurallarını ihlal ediyor." };
    }
  }

  return { safe: true };
}
