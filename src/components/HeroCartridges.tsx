/** A continuous, drag/wheel-only gallery. All slots stay mounted as they wrap. */
import { useGLTF } from "@react-three/drei/core/Gltf.js";
import type { Catalogue, ReconcilerRoot } from "@react-three/fiber";
import {
	createRoot,
	extend,
	invalidate,
	useFrame,
	useThree,
} from "@react-three/fiber";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { labelDataUrl } from "../lib/cover-label";
import { romView } from "../lib/rom-view";
import type { RomEntry } from "../lib/roms";
import HeroCartridgesFallback from "./HeroCartridgesFallback";

extend(THREE as unknown as Catalogue);

export interface HeroCartridge {
	rom: RomEntry;
	artUrl: string | null;
}

const MODEL_URL = "/cart/model.glb";
const DRACO_URL = "/cart/draco/";
const TARGET_HEIGHT = 2.8;
const RADIUS = 3.6;
const texCache = new Map<string, THREE.Texture>();

interface GalleryMotion {
	current: number;
	target: number;
	dragging: boolean;
}

export function wrappedOffset(
	index: number,
	position: number,
	count: number,
): number {
	return (
		((((index - position + count / 2) % count) + count) % count) - count / 2
	);
}

function texture(url: string, color = false): THREE.Texture {
	let cached = texCache.get(url);
	if (!cached) {
		cached = new THREE.TextureLoader().load(url, () => invalidate());
		cached.flipY = false;
		cached.anisotropy = 4;
		if (color) cached.colorSpace = THREE.SRGBColorSpace;
		texCache.set(url, cached);
	}
	return cached;
}

function Cartridge({
	item,
	body,
}: {
	item: HeroCartridge;
	body: THREE.MeshStandardMaterial;
}) {
	const gltf = useGLTF(MODEL_URL, DRACO_URL);
	const labelUrl = useMemo(() => labelDataUrl(romView(item.rom)), [item.rom]);
	const [art, setArt] = useState(labelUrl);
	useEffect(() => {
		if (!item.artUrl) {
			setArt(labelUrl);
			return;
		}
		let cancelled = false;
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = () => {
			if (!cancelled) setArt(item.artUrl ?? labelUrl);
		};
		image.onerror = () => {
			if (!cancelled) setArt(labelUrl);
		};
		image.src = item.artUrl;
		return () => {
			cancelled = true;
		};
	}, [item.artUrl, labelUrl]);
	const paper = useMemo(
		() =>
			new THREE.MeshBasicMaterial({
				map: texture(art, true),
				toneMapped: false,
			}),
		[art],
	);
	const clone = useMemo(() => {
		const scene = gltf.scene.clone(true);
		const size = new THREE.Box3()
			.setFromObject(scene)
			.getSize(new THREE.Vector3());
		scene.scale.multiplyScalar(TARGET_HEIGHT / Math.max(size.y, 0.001));
		const center = new THREE.Box3()
			.setFromObject(scene)
			.getCenter(new THREE.Vector3());
		scene.position.copy(center.negate());
		scene.rotation.y = Math.PI / 2;
		scene.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			if (child.name === "model_2") child.material = body;
			if (child.name === "boxart") child.material = paper;
		});
		return scene;
	}, [gltf.scene, body, paper]);
	useEffect(
		() => () => {
			paper.dispose();
		},
		[paper],
	);
	return <primitive dispose={null} object={clone} />;
}

function slot(offset: number) {
	const distance = Math.abs(offset);
	if (distance < 1) {
		// A smooth interpolation through the focus, not a discrete re-layout.
		const t = distance * distance * (3 - 2 * distance);
		return {
			x: offset * 0.18,
			y: -offset * 2.1,
			z: THREE.MathUtils.lerp(1.8, -0.55, t),
			scale: THREE.MathUtils.lerp(0.92, 0.66, t),
			rotX: 0.025 + offset * 0.2,
			rotY: -0.12 + offset * -0.15,
		};
	}
	return {
		x: offset * 0.18,
		y: -Math.sign(offset) * (2.1 + (distance - 1) * 1.25),
		z: -0.55 - (distance - 1) * 0.65,
		scale: Math.max(0.43, 0.66 - (distance - 1) * 0.07),
		rotX: 0.025 + Math.sign(offset) * 0.2,
		rotY: -0.12 + Math.sign(offset) * -0.15,
	};
}

function CartridgeSlot({
	item,
	index,
	count,
	motion,
	body,
}: {
	item: HeroCartridge;
	index: number;
	count: number;
	motion: GalleryMotion;
	body: THREE.MeshStandardMaterial;
}) {
	const group = useRef<THREE.Group>(null);
	useFrame(() => {
		if (!group.current) return;
		const offset = wrappedOffset(index, motion.current, count);
		group.current.visible = Math.abs(offset) <= RADIUS;
		const target = slot(offset);
		group.current.position.set(target.x, target.y, target.z);
		group.current.rotation.set(target.rotX, target.rotY + Math.PI / 2, -0.04);
		group.current.scale.setScalar(target.scale);
	});
	return (
		<group ref={group}>
			<Cartridge body={body} item={item} />
		</group>
	);
}

function Studio() {
	const { gl, scene, camera, size, invalidate } = useThree();
	useEffect(() => {
		const room = new RoomEnvironment();
		const generator = new THREE.PMREMGenerator(gl);
		const environment = generator.fromScene(room, 0.04);
		scene.environment = environment.texture;
		gl.toneMapping = THREE.ACESFilmicToneMapping;
		gl.toneMappingExposure = 0.68;
		invalidate();
		room.dispose();
		generator.dispose();
		return () => {
			scene.environment = null;
			environment.dispose();
		};
	}, [gl, scene, invalidate]);
	useEffect(() => {
		const aspect = size.width / Math.max(size.height, 1);
		if (camera instanceof THREE.PerspectiveCamera) {
			const height = Math.max(10.8, 6.5 / Math.max(aspect, 0.3));
			camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / 24));
			camera.position.set(0, 1.15, 12);
			camera.lookAt(0, 0, 0);
			camera.updateProjectionMatrix();
			invalidate();
		}
	}, [camera, size.width, size.height, invalidate]);
	return (
		<>
			<fog args={["#101110", 11, 25]} attach="fog" />
			<ambientLight intensity={0.2} />
			<directionalLight
				color="#fff9ec"
				intensity={1.15}
				position={[-4, 5, 8]}
			/>
			<directionalLight color="#e7f0e1" intensity={0.45} position={[5, 1, 4]} />
			<directionalLight color="#e9eddf" intensity={0.8} position={[1, 5, -5]} />
		</>
	);
}

function GalleryScene({
	items,
	motion,
	reducedMotion,
	onSelection,
	onReady,
}: {
	items: HeroCartridge[];
	motion: GalleryMotion;
	reducedMotion: boolean;
	onSelection: (index: number) => void;
	onReady: () => void;
}) {
	const invalidate = useThree((state) => state.invalidate);
	const lastSelection = useRef(-1);
	const body = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				map: texture("/cart/fast/diffuse.webp", true),
				normalMap: texture("/cart/fast/normal.webp"),
				normalScale: new THREE.Vector2(0.45, 0.45),
				roughnessMap: texture("/cart/fast/roughness.webp"),
				roughness: 0.78,
				envMapIntensity: 0.45,
				color: "#c7c8bc",
			}),
		[],
	);
	useEffect(() => {
		onReady();
		invalidate();
	}, [onReady, invalidate]);
	useEffect(
		() => () => {
			body.dispose();
		},
		[body],
	);
	useFrame((_, delta) => {
		motion.current = reducedMotion
			? motion.target
			: THREE.MathUtils.damp(
					motion.current,
					motion.target,
					11,
					Math.min(delta, 0.05),
				);
		const selected =
			((Math.round(motion.current) % items.length) + items.length) %
			items.length;
		if (selected !== lastSelection.current) {
			lastSelection.current = selected;
			onSelection(selected);
		}
		if (Math.abs(motion.current - motion.target) > 0.0001 || motion.dragging)
			invalidate();
	}, -1);
	return (
		<>
			<Studio />
			{items.map((item, index) => (
				<CartridgeSlot
					body={body}
					count={items.length}
					index={index}
					item={item}
					key={item.rom.id}
					motion={motion}
				/>
			))}
		</>
	);
}

function measure(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	return {
		width: Math.max(1, Math.round(rect.width)),
		height: Math.max(1, Math.round(rect.height)),
		top: rect.top,
		left: rect.left,
	};
}

export default function HeroCartridges({ items }: { items: HeroCartridge[] }) {
	const containerRef = useRef<HTMLElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rootRef = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null);
	const disposeTimer = useRef<number | null>(null);
	const motion = useRef<GalleryMotion>({
		current: 0,
		target: 0,
		dragging: false,
	});
	const drag = useRef<{
		pointerId: number;
		startY: number;
		startTarget: number;
		moved: boolean;
	} | null>(null);
	const snapTimer = useRef<number | null>(null);
	const [selected, setSelected] = useState(0);
	const [ready, setReady] = useState(false);
	const reducedMotion = useMemo(
		() => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
		[],
	);
	const hasItems = items.length > 0;
	const onReady = useCallback(() => setReady(true), []);

	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container || !hasItems) return;
		if (disposeTimer.current !== null)
			window.clearTimeout(disposeTimer.current);
		let root = rootRef.current;
		if (!root) {
			root = createRoot(canvas);
			rootRef.current = root;
			void root.configure({
				frameloop: "demand",
				dpr: [1, 1.25],
				camera: { position: [0, 1.15, 12], fov: 49, near: 0.1, far: 60 },
				size: measure(container),
				gl: {
					antialias: true,
					alpha: true,
					powerPreference: "high-performance",
					stencil: false,
				},
			});
		}
		const resize = () => {
			if (root)
				void root.configure({
					size: measure(container),
					frameloop: "demand",
					dpr: [1, 1.25],
				});
		};
		const observer = new ResizeObserver(resize);
		observer.observe(container);
		window.addEventListener("resize", resize);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", resize);
			disposeTimer.current = window.setTimeout(() => {
				if (rootRef.current === root) {
					rootRef.current = null;
					root.unmount();
				}
			}, 0);
		};
	}, [hasItems]);

	useEffect(() => {
		rootRef.current?.render(
			<Suspense fallback={null}>
				<GalleryScene
					items={items}
					motion={motion.current}
					onReady={onReady}
					onSelection={setSelected}
					reducedMotion={reducedMotion}
				/>
			</Suspense>,
		);
	}, [items, reducedMotion, onReady]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const onWheel = (event: WheelEvent) => {
			if (event.ctrlKey) return;
			event.preventDefault();
			const pixels =
				event.deltaY *
				(event.deltaMode === 1
					? 16
					: event.deltaMode === 2
						? container.clientHeight
						: 1);
			motion.current.target += THREE.MathUtils.clamp(pixels / 180, -1.2, 1.2);
			invalidate();
			if (snapTimer.current !== null) window.clearTimeout(snapTimer.current);
			snapTimer.current = window.setTimeout(() => {
				motion.current.target = Math.round(motion.current.target);
				invalidate();
			}, 140);
		};
		container.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			container.removeEventListener("wheel", onWheel);
			if (snapTimer.current !== null) window.clearTimeout(snapTimer.current);
		};
	}, []);

	const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		if (snapTimer.current !== null) window.clearTimeout(snapTimer.current);
		drag.current = {
			pointerId: event.pointerId,
			startY: event.clientY,
			startTarget: motion.current.target,
			moved: false,
		};
	};
	const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
		const state = drag.current;
		if (!state || state.pointerId !== event.pointerId) return;
		const distance = state.startY - event.clientY;
		if (Math.abs(distance) < 5 && !state.moved) return;
		state.moved = true;
		motion.current.dragging = true;
		motion.current.target = state.startTarget + distance / 110;
		invalidate();
	};
	const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
		if (drag.current?.pointerId !== event.pointerId) return;
		if (drag.current.moved)
			motion.current.target = Math.round(motion.current.target);
		motion.current.dragging = false;
		drag.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId);
		invalidate();
	};

	const view = items[selected] ? romView(items[selected].rom) : null;
	return (
		<div className="cartridge-gallery" data-ready={ready}>
			{!ready && (
				<HeroCartridgesFallback
					views={items.map((item) => romView(item.rom))}
				/>
			)}
			<section
				aria-label="Cartridge gallery. Browse by vertical drag or scroll wheel only."
				className="cartridge-stage"
				onLostPointerCapture={endDrag}
				onPointerCancel={endDrag}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={endDrag}
				ref={containerRef}
			>
				<canvas
					ref={canvasRef}
					style={{ opacity: ready ? 1 : 0, transition: "opacity 400ms ease" }}
				/>
			</section>
			{view && (
				<div aria-live="polite" className="cartridge-caption">
					<span className="cartridge-number">
						{String(selected + 1).padStart(2, "0")}
					</span>
					<div className="min-w-0">
						<p className="cartridge-caption-title truncate">
							{view.title.replace(/\s*\([^)]*\)/g, "").replace(/, The\b/, "")}
						</p>
						<p className="cartridge-platform truncate">{view.platform}</p>
					</div>
					<span className="cartridge-instruction">
						Drag to wander
						<br />
						Scroll to discover
					</span>
				</div>
			)}
		</div>
	);
}

useGLTF.preload(MODEL_URL, DRACO_URL);
