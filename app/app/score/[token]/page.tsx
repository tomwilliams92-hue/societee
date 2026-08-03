import { GroupScorer } from "./GroupScorer";

export default async function ScorePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GroupScorer token={token} />;
}
