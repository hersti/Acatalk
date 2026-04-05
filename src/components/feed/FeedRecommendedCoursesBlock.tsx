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
      description="Profil baglamin ve ders hareketliligi ile senin icin oncelikli dersler."
      emptyText="Uygun ders onerisi henuz olusmadi. Filtreleri genisletip dersleri kesfetmeye devam et."
      items={items}
      loading={loading}
    />
  );
}
