import { Link, Navigate, useParams } from "react-router-dom";
import { CollectionWorkbench } from "../components/collection-workbench";
import { useLibraryState } from "../lib/use-library";
import { formatSizeMb } from "../lib/rom-view";
import { useRomIndex } from "../lib/rom-index-context";

export default function CollectionDetailPage() {
	const { id = "" } = useParams();
	const { collections } = useLibraryState();
	const { view } = useRomIndex();
	const collection = collections.find((item) => item.id === id);

	if (!collection) {
		if (collections.length === 0) return <Navigate to="/collections" replace />;
		return (
			<div className="mx-auto max-w-[860px] px-5 pb-20 pt-32">
				<p className="text-[15px] text-white/80">That list is no longer on this device.</p>
				<Link
					to="/collections"
					className="mt-4 inline-block text-[13px] text-white/65 underline underline-offset-4 hover:text-white"
				>
					← All lists
				</Link>
			</div>
		);
	}

	const resolved = collection.items
		.map((item) => view.byId.get(item.romId))
		.filter((rom): rom is NonNullable<typeof rom> => Boolean(rom));
	const totalMb = resolved.reduce((total, rom) => total + (rom.sizeBytes ?? 0) / (1024 * 1024), 0);

	return (
		<div className="mx-auto max-w-[1180px] px-5 pb-14 pt-28 sm:pt-32">
			<Link to="/collections" className="text-[13px] text-white/62 hover:text-white">
				← All lists
			</Link>

			<header className="mt-10 max-w-[680px]">
				<h1 className="text-[42px] font-semibold leading-[.98] tracking-[-0.055em] text-white sm:text-[58px]">
					{collection.name}
				</h1>
				{collection.note && <p className="mt-5 text-[16px] leading-[1.7] text-white/72">{collection.note}</p>}
				<p className="mt-5 text-[13px] text-white/58">
					{collection.items.length} {collection.items.length === 1 ? "record" : "records"}
					{resolved.length > 0 && ` - ${formatSizeMb(totalMb)}`}
					{collection.curator && ` - curated by ${collection.curator}`}
				</p>
			</header>

			<CollectionWorkbench collection={collection} />
		</div>
	);
}
