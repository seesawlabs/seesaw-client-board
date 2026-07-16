import { getBoard } from "@/lib/actions";
import { Board } from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function Home() {
  const board = await getBoard();
  return <Board initial={board} />;
}
