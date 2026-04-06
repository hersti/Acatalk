import FeedCourseBlockBase from "@/components/feed/FeedCourseBlockBase";
import type { FeedCourseBlockItem } from "@/hooks/useFeedSnapshotV1";

interface FeedActiveCoursesBlockProps {
  items: FeedCourseBlockItem[];
  loading?: boolean;
}

export default function FeedActiveCoursesBlock({ items, loading }: FeedActiveCoursesBlockProps) {
  return (
    <FeedCourseBlockBase
      title="Hareketli Dersler"
      description="Son günlerde içerik ve etkileşim artışı görülen canlı ders alanları."
      emptyText="Şu an öne çıkan hareketli ders görünmüyor. Ders listesine geçip bir Course Hub açabilirsin."
      emptyActionLabel="Dersleri incele"
      emptyActionHref="/courses"
      items={items}
      loading={loading}
    />
  );
}
