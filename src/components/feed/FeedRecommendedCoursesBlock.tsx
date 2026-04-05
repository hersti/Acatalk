import FeedCourseBlockBase from "@/components/feed/FeedCourseBlockBase";
import type { FeedCourseBlockItem } from "@/hooks/useFeedSnapshotV1";

interface FeedRecommendedCoursesBlockProps {
  items: FeedCourseBlockItem[];
  loading?: boolean;
}

export default function FeedRecommendedCoursesBlock({ items, loading }: FeedRecommendedCoursesBlockProps) {
  return (
    <FeedCourseBlockBase
      title="Sana Uygun Dersler"
      description="Ders baglamin ve son hareketlere gore onceliklenen dersler."
      emptyText="Uygun ders onerisi henuz yok. Filtreyi acip ders secimi yapabilirsin."
      emptyActionLabel="Filtrelere git"
      emptyActionHref="/#feed-filters"
      items={items}
      loading={loading}
    />
  );
}
