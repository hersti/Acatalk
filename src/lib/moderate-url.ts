/**
 * Client-side URL safety checker.
 * Scans URLs for known NSFW / dangerous patterns before allowing them on the platform.
 */

const NSFW_DOMAIN_PATTERNS = [
  // Major porn sites
  /pornhub/i, /xvideos/i, /xnxx/i, /redtube/i, /youporn/i,
  /brazzers/i, /xhamster/i, /chaturbate/i, /onlyfans/i,
  /rule34/i, /hentai/i, /nhentai/i, /porn/i, /xxx/i,
  /livejasmin/i, /cam4/i, /bongacams/i, /stripchat/i,
  /fapello/i, /nudogram/i, /leaked/i, /nudes/i,
  /erome/i, /spankbang/i, /tnaflix/i, /tube8/i,
  /beeg/i, /motherless/i, /efukt/i, /heavy-r/i,
  /bangbros/i, /naughtyamerica/i, /realitykings/i, /mofos/i,
  /fakehub/i, /babes\.com/i, /tushy/i, /vixen/i, /blacked/i,
  /digitalplayground/i, /wicked\.com/i, /kink\.com/i,
  /clips4sale/i, /manyvids/i, /fansly/i, /justfor\.fans/i,
  /iwara/i, /hanime/i, /gelbooru/i, /danbooru/i, /e621/i,
  /sankaku/i, /konachan/i, /yande\.re/i, /pixiv.*r18/i,
  /f95zone/i, /literotica/i, /asstr/i, /sexstories/i,
  /omegle/i, /chatrandom/i, /dirtyroulette/i, /camsoda/i,
  /myfreecams/i, /flirt4free/i, /imlive/i, /streamate/i,
  /jerkmate/i, /rabbits\.?cams/i, /xcams/i,
  /xgroovy/i, /hqporner/i, /daftsex/i, /sxyprn/i,
  /nudevista/i, /porndoe/i, /fuq\.com/i, /4tube/i,
  /sunporno/i, /txxx/i, /voyeurhit/i, /anyporn/i,
  /fux\.com/i, /drtuber/i, /porntrex/i, /eporner/i,
  /pornone/i, /youjizz/i, /porndig/i,
  // Turkish adult
  /sik[iı]ş/i, /porno(?:izle|film|video|tube)/i, /altyaz[iı]l[iı]porno/i,
  /t[uü]rk(?:porno|ifşa|seks)/i, /ifşa/i, /yerli\s*porno/i,

  // Gore / shock
  /bestgore/i, /rotten/i, /theync/i, /liveleak/i,
  /crazyshit/i, /documenting\.?reality/i, /kaotic/i,
  /seegore/i, /goregrish/i, /shockgore/i,

  // Hate / extremism
  /4chan\.org/i, /8kun/i, /8chan/i, /kiwifarms/i,
  /stormfront/i, /dailystormer/i,

  // Darkweb / illegal
  /darkweb/i, /silkroad/i, /tormarket/i,

  // Escort / trafficking
  /megapersonals/i, /backpage/i, /escortfish/i,
  /skipthegames/i, /listcrawler/i, /eroticmonkey/i,
  /adultwork/i, /erosguide/i, /tryst\.link/i,

  // Phishing / malware
  /phishing/i, /malware/i,

  // Piracy / crack
  /thepiratebay/i, /1337x/i, /rarbg/i,

  // Gambling
  /bet365/i, /1xbet/i, /mostbet/i, /melbet/i,
  /pinnacle/i, /stake\.com/i,
];

const SUSPICIOUS_PATH_PATTERNS = [
  /nsfw/i, /porn/i, /xxx/i, /nude/i, /sex/i, /hentai/i,
  /adult/i, /erotic/i, /fetish/i, /camgirl/i, /escort/i,
  /gore/i, /snuff/i, /torture/i,
  /phishing/i, /malware/i, /trojan/i,
  /hack[- ]?tool/i, /crack[- ]?key/i, /keygen/i,
  /onlyfans[- _]?leak/i, /ifşa/i, /sızıntı/i,
  /deepfake/i, /deepnude/i, /undress/i,
  /jailbreak/i, /bypass[- _]?filter/i,
  /(?:buy|sell)[- _]?(?:drugs|weed|cocaine|mdma)/i,
  /(?:naked|topless|bottomless|upskirt|downblouse)/i,
  /(?:creepshot|voyeur|hidden[- _]?cam)/i,
  /(?:child|underage|minor|teen)[- _]?(?:porn|nude|sex|naked)/i,
  /(?:lolicon|shotacon|cp[- _]?links)/i,
];

const DANGEROUS_PATTERNS = [
  /^javascript:/i,
  /^data:text\/html/i,
  /^data:application/i,
  /^vbscript:/i,
  /^file:/i,
  /^blob:/i,
];

const SUSPICIOUS_TLD_PATTERNS = [
  /\.(xxx|sex|porn|adult|cam|sexy|nude|dating)$/i,
];

// Known malicious/suspicious redirect domains
const SUSPICIOUS_REDIRECT_DOMAINS = [
  /bit\.ly/i, /tinyurl\.com/i, /t\.co/i, /goo\.gl/i,
  /is\.gd/i, /v\.gd/i, /ow\.ly/i, /cutt\.ly/i,
  /shorturl\.at/i, /rebrand\.ly/i, /tiny\.cc/i,
  /linktr\.ee/i,
];

export interface UrlCheckResult {
  safe: boolean;
  reason?: string;
  isShortener?: boolean;
}

/**
 * Check a URL for NSFW or dangerous patterns.
 */
export function checkUrlSafety(url: string): UrlCheckResult {
  const trimmed = url.trim();

  // Block dangerous protocols
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: "Bu bağlantı güvenlik kurallarını ihlal ediyor." };
    }
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    const fullUrl = hostname + pathname + search;

    // Check domain patterns
    for (const pattern of NSFW_DOMAIN_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: "Bu bağlantı uygunsuz içeriğe yönlendiriyor ve platform kurallarını ihlal ediyor." };
      }
    }

    // Check suspicious TLDs
    for (const pattern of SUSPICIOUS_TLD_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: "Bu bağlantı uygunsuz içerik barındırıyor olabilir." };
      }
    }

    // Check path patterns (includes search params)
    for (const pattern of SUSPICIOUS_PATH_PATTERNS) {
      if (pattern.test(pathname) || pattern.test(search)) {
        return { safe: false, reason: "Bu bağlantı uygunsuz içerik barındırıyor olabilir." };
      }
    }

    // Flag URL shorteners
    for (const pattern of SUSPICIOUS_REDIRECT_DOMAINS) {
      if (pattern.test(hostname)) {
        return { safe: true, isShortener: true };
      }
    }

    // Check for suspicious subdomains
    if (/^(nsfw|adult|porn|xxx|sex)\./i.test(hostname)) {
      return { safe: false, reason: "Bu bağlantı uygunsuz içerik barındırıyor olabilir." };
    }

    // Check for IP-based URLs (often malicious)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { safe: true, isShortener: true }; // flag but don't block
    }
  } catch {
    // Not a valid URL, let it pass
  }

  return { safe: true };
}

/**
 * Check all URLs in a text block.
 */
export function checkTextUrls(text: string): UrlCheckResult {
  const urlRegex = /(https?:\/\/[^\s<>"')\]]+)/g;
  const matches = text.match(urlRegex);
  if (!matches) return { safe: true };

  for (const url of matches) {
    const result = checkUrlSafety(url);
    if (!result.safe) return result;
  }

  return { safe: true };
}
