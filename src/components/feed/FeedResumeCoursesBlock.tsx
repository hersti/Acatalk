import FeedCourseBlockBase from "@/components/feed/FeedCourseBlockBase";
import type { FeedCourseBlockItem } from "@/hooks/useFeedSnapshotV1";

interface FeedResumeCoursesBlockProps {
  items: FeedCourseBlockItem[];
  loading?: boolean;
}

export default function FeedResumeCoursesBlock({ items, loading }: FeedResumeCoursesBlockProps) {
  return (
    <FeedCourseBlockBase
      title="Son Baktığın Dersler"
      description="Kaldığın yerden devam etmek için hızlı dönüş listesi."
      emptyText="Henüz ziyaret geçmişin yok. Bir ders açtığında burada görünür."
      items={items}
      loading={loading}
      emphasizeResume
    />
  );
}
