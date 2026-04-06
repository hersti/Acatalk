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
      description="Bölümün ve son etkileşiminle uyumlu, doğrudan başlayabileceğin dersler."
      emptyText="Sana uygun ders bulunamadı. Dersler ekranından filtreleyerek keşfe başlayabilirsin."
      emptyActionLabel="Derslere git"
      emptyActionHref="/courses"
      items={items}
      loading={loading}
    />
  );
}
