export const COMMUNITY_IDS = ["global", "kampus", "bolum"] as const;
export const CHANNEL_IDS = ["genel", "dersler", "projeler", "etkinlikler"] as const;

export type CommunityId = (typeof COMMUNITY_IDS)[number];
export type ChannelId = (typeof CHANNEL_IDS)[number];

export type CommunityDef = { id: CommunityId; label: string; description: string };
export type ChannelDef = { id: ChannelId; label: string; description: string };

export type MessageContext = {
  community: CommunityId;
  channel: ChannelId;
};

export const DEFAULT_MESSAGE_CONTEXT: MessageContext = {
  community: "global",
  channel: "genel",
};

export const DEFAULT_COMMUNITIES: CommunityDef[] = [
  { id: "global", label: "Global Öğrenci Ağları", description: "Tüm öğrencilerin ortak topluluk alanı" },
  { id: "kampus", label: "Kampüs Ağı", description: "Üniversite bağlamlı genel topluluk" },
  { id: "bolum", label: "Bölüm Ağı", description: "Bölüm odaklı öğrenci etkileşimi" },
];

export const CHANNELS: ChannelDef[] = [
  { id: "genel", label: "Genel", description: "Genel topluluk sohbeti" },
  { id: "dersler", label: "Dersler", description: "Ders odakli konular" },
  { id: "projeler", label: "Projeler", description: "Proje ekipleri ve teslimler" },
  { id: "etkinlikler", label: "Etkinlikler", description: "Topluluk etkinlikleri" },
];

const TAG_PREFIX_PATTERN = /^\[co:([^\]]+)\]\s*\[ch:([^\]]+)\]\s*/i;

const COMMUNITY_ID_SET = new Set<string>(COMMUNITY_IDS);
const CHANNEL_ID_SET = new Set<string>(CHANNEL_IDS);

export function isCommunityId(value: string): value is CommunityId {
  return COMMUNITY_ID_SET.has(value);
}

export function isChannelId(value: string): value is ChannelId {
  return CHANNEL_ID_SET.has(value);
}

export function encodeCommunityMessageTags(communityId: CommunityId, channelId: ChannelId): string {
  return `[co:${communityId}] [ch:${channelId}]`;
}

export function stripCommunityMessageTags(raw: string): string {
  return raw.replace(TAG_PREFIX_PATTERN, "").trim();
}

// TODO(data-model): Replace encoded [co:*]/[ch:*] tags with dedicated columns (community_id, channel_id) and run a backfill migration.
export function extractCommunityMessageContext(content: string): MessageContext {
  const match = content.match(TAG_PREFIX_PATTERN);
  const communityCandidate = match?.[1]?.toLowerCase() || DEFAULT_MESSAGE_CONTEXT.community;
  const channelCandidate = match?.[2]?.toLowerCase() || DEFAULT_MESSAGE_CONTEXT.channel;

  return {
    community: isCommunityId(communityCandidate) ? communityCandidate : DEFAULT_MESSAGE_CONTEXT.community,
    channel: isChannelId(channelCandidate) ? channelCandidate : DEFAULT_MESSAGE_CONTEXT.channel,
  };
}

export function buildCommunityDefinitions(university?: string | null, department?: string | null): CommunityDef[] {
  const campusLabel = university ? `${university} Kampüs Ağı` : "Kampüs Ağı";
  const departmentLabel = department ? `${department} Öğrenci Ağı` : "Bölüm Ağı";

  return [
    { id: "global", label: "Global Öğrenci Ağları", description: "Tüm öğrencilerin ortak topluluk alanı" },
    { id: "kampus", label: campusLabel, description: "Üniversite bağlamlı genel topluluk" },
    { id: "bolum", label: departmentLabel, description: "Bölüm odaklı öğrenci etkileşimi" },
  ];
}
