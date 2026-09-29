/**
 * Floating 3D hero cartridges.
 *
 * Ported from the cartridge-studio vertical gallery: the same GLB shell, the
 * same PBR plastic + paper sticker materials, the same wrapping carousel
 * math, the same studio light rig defaults. What did not come over:
 *
 * - the debug Leva panel, inspect zoom mode, favorites, and search UI,
 * - the ScreenScraper resolver queue (hero art resolves once, see
 *   `lib/cover-art`, and never touches the browse index),
 * - the remote environment HDR (lights only, so the hero is self-contained).
 *
 * One deliberate deviation from the studio: it mounts R3F through `<Canvas>`,
 * which waits on a ResizeObserver reading before creating the WebGL root.
 * That observer never fires in some embedded browsers, leaving a dead
 * 300x150 canvas. This hero drives `createRoot` directly with an explicitly
 * measured size instead, so it initializes everywhere.
 *
 * Display-only: the full index search is untouched and still covers every
 * record. Clicking the centred cartridge opens its record page.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoot, events, extend, useFrame, useThree } from "@react-three/fiber";
import type { Catalogue, ReconcilerRoot } from "@react-three/fiber";
import { Sparkles, useCursor, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { RomEntry } from "../lib/roms";
import { romView } from "../lib/rom-view";
import { labelDataUrl } from "../lib/cover-label";

/* Manual roots do not run <Canvas>'s auto-extend: register THREE ourselves. */
extend(THREE as unknown as Catalogue);

export interface HeroCartridge {
	rom: RomEntry;
	/** Resolved box art URL, or null to wear the generated label. */
	artUrl: string | null;
}

const MODEL_URL = "/cart/model.glb";
const BODY_URL = "/cart/diffuse.jpg";
const NORMAL_URL = "/cart/normal.png";
const ROUGH_URL = "/cart/roughness.png";
const FALLBACK_COVER = "/cart/no-image.svg";

const TARGET_HEIGHT = 2.8;
const LERP_SPEED = 5;
const FACE_ROTATION = Math.PI / 2;
const GAP = 2.15;
const STEP = 1.0;
const DEPTH_STEP = 0.55;
const CULL_RADIUS = 3;

/* Light rig defaults, copied from the studio's tuned preset. */
const RIG = {
	ambient: 0.12,
	fillIntensity: 1.61,
	fillPos: [-2, 1, 14.4] as const,
	rimIntensity: 1.25,
	rimPos: [0, 7.2, -6.2] as const,
	accentIntensity: 2.98,
	accentPos: [-20, 1.1, -20] as const,
	accentColor: "#f9a8d4",
	exposure: 1.15,
	bloom: 0.12,
} as const;

function wrappedOffset(index: number, selected: number, count: number): number {
	if (count <= 0) return 0;
	let offset = index - selected;
	const half = count / 2;
	if (offset > half) offset -= count;
	if (offset < -half) offset += count;
	return offset;
}

/* One GPU upload per URL for the whole carousel. */
const texCache = new Map<string, THREE.Texture>();
function sharedTexture(url: string, srgb: boolean): THREE.Texture {
	let texture = texCache.get(url);
	if (!texture) {
		const loader = new THREE.TextureLoader();
		loader.setCrossOrigin("anonymous");
		texture = loader.load(url);
		texture.flipY = false;
		if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = 8;
		texture.needsUpdate = true;
		texCache.set(url, texture);
	}
	return texture;
}

function useProbedTexture(url: string): THREE.Texture {
	const [resolved, setResolved] = useState(url);
	useEffect(() => {
		let cancelled = false;
		// Data URLs (generated labels) need no probe.
		if (url.startsWith("data:")) {
			setResolved(url);
			return;
		}
		const probe = new Image();
		probe.crossOrigin = "anonymous";
		probe.onload = () => {
			if (!cancelled) setResolved(url);
		};
		probe.onerror = () => {
			if (!cancelled) setResolved(FALLBACK_COVER);
		};
		probe.src = url;
		return () => {
			cancelled = true;
		};
	}, [url]);
	return useMemo(() => sharedTexture(resolved, true), [resolved]);
}

function Cartridge3D({ labelUrl }: { labelUrl: string }) {
	const gltf = useGLTF(MODEL_URL);
	const bodyBase = useMemo(() => sharedTexture(BODY_URL, true), []);
	const bodyNormal = useMemo(() => sharedTexture(NORMAL_URL, false), []);
	const bodyRoughness = useMemo(() => sharedTexture(ROUGH_URL, false), []);
	const gameArt = useProbedTexture(labelUrl);

	const clone = useMemo(() => {
		const c = gltf.scene.clone(true);
		const box = new THREE.Box3().setFromObject(c);
		const size = new THREE.Vector3();
		box.getSize(size);
		c.scale.multiplyScalar(TARGET_HEIGHT / Math.max(size.y, 0.001));
		const scaled = new THREE.Box3().setFromObject(c);
		const centre = new THREE.Vector3();
		scaled.getCenter(centre);
		c.position.set(-centre.x, -scaled.min.y, -centre.z);
		c.rotation.y = FACE_ROTATION;
		return c;
	}, [gltf.scene]);

	useEffect(() => {
		clone.traverse((child) => {
			if (!(child as THREE.Mesh).isMesh) return;
			const mesh = child as THREE.Mesh;
			if (mesh.name === "model_2") {
				mesh.material = new THREE.MeshStandardMaterial({
					map: bodyBase,
					normalMap: bodyNormal,
					normalScale: new THREE.Vector2(1.0, 1.0),
					roughnessMap: bodyRoughness,
					roughness: 0.75,
					metalness: 0.0,
					envMapIntensity: 0.45,
					color: new THREE.Color(0xffffff),
				});
				mesh.castShadow = true;
				mesh.receiveShadow = true;
			} else if (mesh.name === "boxart") {
				mesh.material = new THREE.MeshStandardMaterial({
					map: gameArt,
					roughness: 0.21,
					metalness: 0.0,
					envMapIntensity: 1.22,
					color: new THREE.Color(0xffffff),
				});
				mesh.castShadow = true;
				mesh.receiveShadow = true;
			}
		});
	}, [clone, bodyBase, bodyNormal, bodyRoughness, gameArt]);

	return <primitive object={clone} />;
}

interface SlotProps {
	item: HeroCartridge;
	index: number;
	count: number;
	selected: number;
	reducedMotion: boolean;
	onSelect: (index: number) => void;
	onOpen: (rom: RomEntry) => void;
}

function CartridgeSlot({ item, index, count, selected, reducedMotion, onSelect, onOpen }: SlotProps) {
	const ref = useRef<THREE.Group>(null!);
	const [hovered, setHovered] = useState(false);
	const isSelected = index === selected;
	useCursor(hovered);

	const labelUrl = useMemo(() => item.artUrl ?? labelDataUrl(romView(item.rom)), [item]);

	const target = useMemo(() => {
		const offset = wrappedOffset(index, selected, count);
		if (offset === 0) return { y: 0.2, z: 1.9, rotX: 0, rotY: 0, scale: 0.82 };
		const sign = Math.sign(offset);
		const abs = Math.abs(offset);
		return {
			y: -sign * (GAP + (abs - 1) * STEP),
			z: -0.9 - (abs - 1) * DEPTH_STEP,
			rotX: sign * 0.32,
			rotY: -sign * 0.28,
			scale: Math.max(0.5, 0.68 - (abs - 1) * 0.07),
		};
	}, [index, selected, count]);

	useFrame((state, delta) => {
		if (!ref.current) return;
		const l = THREE.MathUtils.lerp;
		ref.current.position.z = l(ref.current.position.z, target.z, LERP_SPEED * delta);
		let ty = target.y;
		if (isSelected && !reducedMotion) ty += Math.sin(state.clock.elapsedTime * 1.85) * 0.04;
		if (hovered && !isSelected) ty -= Math.sign(target.y) * 0.16;
		ref.current.position.y = l(ref.current.position.y, ty, LERP_SPEED * delta);
		const rotY = (hovered && !isSelected ? target.rotY * 0.6 : target.rotY) + FACE_ROTATION;
		const rotX = hovered && !isSelected ? target.rotX * 0.6 : target.rotX;
		ref.current.rotation.y = l(ref.current.rotation.y, rotY, LERP_SPEED * delta);
		ref.current.rotation.x = l(ref.current.rotation.x, rotX, LERP_SPEED * delta);
		const ts = hovered && !isSelected ? target.scale * 1.05 : target.scale;
		ref.current.scale.setScalar(l(ref.current.scale.x, ts, LERP_SPEED * delta));
	});

	return (
		<group
			ref={ref}
			onPointerDown={(e) => {
				e.stopPropagation();
				if (isSelected) onOpen(item.rom);
				else onSelect(index);
			}}
			onPointerOver={(e) => {
				e.stopPropagation();
				setHovered(true);
			}}
			onPointerOut={() => setHovered(false)}
		>
			<Cartridge3D labelUrl={labelUrl} />
		</group>
	);
}

function Tonemap() {
	const gl = useThree((s) => s.gl);
	const camera = useThree((s) => s.camera);
	useEffect(() => {
		gl.toneMapping = THREE.ACESFilmicToneMapping;
		gl.toneMappingExposure = RIG.exposure;
		camera.lookAt(0, 1.0, 0);
	}, [gl, camera]);
	return null;
}

function Rig() {
	return (
		<>
			<ambientLight intensity={RIG.ambient} />
			<spotLight
				position={[...RIG.fillPos] as [number, number, number]}
				angle={0.55}
				penumbra={1}
				intensity={RIG.fillIntensity}
				distance={21}
				decay={0}
				color="#eef0ff"
			/>
			<spotLight
				position={[...RIG.rimPos] as [number, number, number]}
				angle={0.58}
				penumbra={0.39}
				intensity={RIG.rimIntensity}
				distance={18}
				decay={0.79}
				color="#c8d4ff"
			/>
			<pointLight
				position={[...RIG.accentPos] as [number, number, number]}
				intensity={RIG.accentIntensity}
				color={RIG.accentColor}
				decay={2}
				distance={18}
			/>
		</>
	);
}

interface SceneProps {
	items: HeroCartridge[];
	selected: number;
	reducedMotion: boolean;
	onSelect: (index: number) => void;
	onOpen: (rom: RomEntry) => void;
}

function HeroScene({ items, selected, reducedMotion, onSelect, onOpen }: SceneProps) {
	const count = items.length;
	return (
		<>
			<Tonemap />
			<Rig />
			<Sparkles count={24} scale={[10, 8, 6]} size={1.4} speed={0.12} opacity={0.35} color="#a5b4fc" />
			{items.map((item, i) =>
				Math.abs(wrappedOffset(i, selected, count)) <= CULL_RADIUS ? (
					<CartridgeSlot
						key={item.rom.id}
						item={item}
						index={i}
						count={count}
						selected={selected}
						reducedMotion={reducedMotion}
						onSelect={onSelect}
						onOpen={onOpen}
					/>
				) : null,
			)}
			<EffectComposer multisampling={4}>
				<Bloom intensity={RIG.bloom} luminanceThreshold={0.72} luminanceSmoothing={0.35} mipmapBlur radius={0.86} />
				<Vignette eskil={false} offset={0.18} darkness={0.4} />
			</EffectComposer>
		</>
	);
}

function measure(el: HTMLElement | null): { width: number; height: number } {
	if (!el) return { width: 0, height: 0 };
	const rect = el.getBoundingClientRect();
	return { width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) };
}

export default function HeroCartridges({ items }: { items: HeroCartridge[] }) {
	const navigate = useNavigate();
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rootRef = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null);
	const [selected, setSelected] = useState(0);
	const lastInteract = useRef(0);
	const reducedMotion = useMemo(
		() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
		[],
	);

	const count = items.length;

	const handleSelect = useMemo(
		() => (index: number) => {
			lastInteract.current = Date.now();
			setSelected(index);
		},
		[],
	);
	const handleOpen = useMemo(
		() => (rom: RomEntry) => {
			lastInteract.current = Date.now();
			navigate(`/rom/${romView(rom).slug}`);
		},
		[navigate],
	);

	// Slow auto-advance, paused for a while after the visitor takes over.
	useEffect(() => {
		if (reducedMotion || count < 2) return;
		const timer = window.setInterval(() => {
			if (Date.now() - lastInteract.current > 10000) {
				setSelected((value) => (value + 1) % count);
			}
		}, 4500);
		return () => window.clearInterval(timer);
	}, [count, reducedMotion]);

	// Create the WebGL root once with an explicitly measured size.
	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container || count === 0) return;
		const root = createRoot(canvas);
		rootRef.current = root;
		const box = measure(container);
		void root
			.configure({
				events,
				shadows: true,
				dpr: [1, 1.5],
				camera: { position: [0, 1.7, 8.4], fov: 30, near: 0.1, far: 60 },
				size: { width: box.width, height: box.height, top: 0, left: 0 },
				gl: { antialias: true, alpha: true, powerPreference: "high-performance", stencil: false },
			})
			.catch(() => {
				// WebGL unavailable: the 2D fallback already covers this case.
			});
		const onResize = () => {
			const next = measure(container);
			void root.configure({ size: { width: next.width, height: next.height, top: 0, left: 0 } }).catch(() => {});
		};
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
			rootRef.current = null;
			root.unmount();
		};
	}, [count === 0]);

	// Re-render the scene whenever selection or items change.
	useEffect(() => {
		const root = rootRef.current;
		if (!root || count === 0) return;
		root.render(
			<HeroScene items={items} selected={selected} reducedMotion={reducedMotion} onSelect={handleSelect} onOpen={handleOpen} />,
		);
	});

	if (count === 0) return null;

	return (
		<div ref={containerRef} className="relative h-full w-full">
			<canvas ref={canvasRef} className="block h-full w-full" />
		</div>
	);
}

useGLTF.preload(MODEL_URL);
