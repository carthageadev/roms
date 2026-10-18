import { getGames } from "@/lib/archive";
import { ArchiveApp } from "@/components/ArchiveApp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const games = await getGames();
  return <ArchiveApp initialGames={games} />;
}
