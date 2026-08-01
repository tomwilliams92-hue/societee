import { PublicBoard } from "./PublicBoard";

export default async function LivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicBoard token={token} />;
}
