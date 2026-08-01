import { SocietyView } from "./SocietyView";

export default async function SocietyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SocietyView slug={slug} />;
}
