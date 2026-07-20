import { getBoard, listActivityAction } from "@/lib/actions";
import { Board } from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [board, activity] = await Promise.all([getBoard(), listActivityAction()]);
  return <Board initial={board} activity={activity} />;
}
