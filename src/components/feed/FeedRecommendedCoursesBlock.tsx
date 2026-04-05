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
      description="Bölümüne ve son hareketine göre öne çıkan dersler."
      emptyText="Sana uygun ders bulunamadı. Filtrelerden ders seçerek başlayabilirsin."
      emptyActionLabel="Filtrelere git"
      emptyActionHref="/#feed-filters"
      items={items}
      loading={loading}
    />
  );
}
