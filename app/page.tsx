import { getBoard, listActivityAction, getGoogleStatus, getSlackStatus, getGithubStatus } from "@/lib/actions";
import { Board } from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [board, activity, google, slack, github] = await Promise.all([
    getBoard(), listActivityAction(), getGoogleStatus(), getSlackStatus(), getGithubStatus(),
  ]);
  return <Board initial={board} activity={activity} google={google} slack={slack} github={github} />;
}
