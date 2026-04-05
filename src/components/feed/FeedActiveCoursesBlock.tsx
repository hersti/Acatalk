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
      description="Post ve sohbet hareketi son gunlerde artan dersler."
      emptyText="Su an hareketli ders yok. Ders listesinden bir hub acarak hareket baslatabilirsin."
      emptyActionLabel="Dersleri incele"
      emptyActionHref="/#courses-grid"
      items={items}
      loading={loading}
    />
  );
}
