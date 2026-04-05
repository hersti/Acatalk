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
      description="Son günlerde içerik ve sohbeti artan dersler."
      emptyText="Şu an hareketli ders görünmüyor. Ders listesine gidip bir hub açabilirsin."
      emptyActionLabel="Dersleri incele"
      emptyActionHref="/#courses-grid"
      items={items}
      loading={loading}
    />
  );
}
