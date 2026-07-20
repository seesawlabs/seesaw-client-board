import { getBoard, listActivityAction, getGoogleStatus } from "@/lib/actions";
import { Board } from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [board, activity, google] = await Promise.all([getBoard(), listActivityAction(), getGoogleStatus()]);
  return <Board initial={board} activity={activity} google={google} />;
}
