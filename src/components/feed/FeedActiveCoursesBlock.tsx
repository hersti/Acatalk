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
      description="Yakin zamanda post, tartisma veya sohbet hareketi olan dersler."
      emptyText="Bu aralikta hareketli ders bulunamadi. Dersleri inceleyip ilk katkini sen baslatabilirsin."
      items={items}
      loading={loading}
    />
  );
}
