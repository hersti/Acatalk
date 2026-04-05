import FeedCourseBlockBase from "@/components/feed/FeedCourseBlockBase";
import type { FeedCourseBlockItem } from "@/hooks/useFeedSnapshotV1";

interface FeedResumeCoursesBlockProps {
  items: FeedCourseBlockItem[];
  loading?: boolean;
}

export default function FeedResumeCoursesBlock({ items, loading }: FeedResumeCoursesBlockProps) {
  return (
    <FeedCourseBlockBase
      title="Nereye Donmelisin"
      description="Son ziyaret ettigin derslere hizli donus alani."
      emptyText="Heniz ziyaret gecmisi yok. Bir ders actiginda burada gorunecek."
      items={items}
      loading={loading}
      emphasizeResume
    />
  );
}
