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
 * record. Selecting a cartridge updates the small title/platform readout;
 * gallery gestures never navigate away from the landing page.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createRoot, events, extend, useFrame, useThree } from "@react-three/fiber";
import type { Catalogue, ReconcilerRoot } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
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
const BODY_URL = "/cart/fast/diffuse.webp";
const NORMAL_URL = "/cart/fast/normal.webp";
const ROUGH_URL = "/cart/fast/roughness.webp";
const FALLBACK_COVER = "/cart/no-image.svg";
const DRACO_URL = "/cart/draco/";

const TARGET_HEIGHT = 2.8;
const LERP_SPEED = 5;
const FACE_ROTATION = Math.PI / 2;
const CAMERA_DISTANCE = 9;
const GAP = 2.15;
const STEP = 1.0;
const DEPTH_STEP = 0.55;
const VISIBLE_RADIUS = 3;
const MIN_HORIZONTAL_VIEW = 8;

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
} as const;

function wrappedOffset(index: number, selected: number, count: number): number {
	if (count <= 0) return 0;
	let offset = index - selected;
	const half = count / 2;
	if (offset > half) offset -= count;
	if (offset < -half) offset += count;
	return offset;
}

interface SlotTarget {
	y: number;
	z: number;
	rotX: number;
	rotY: number;
	scale: number;
}

function getSlotTarget(offset: number): SlotTarget {
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
}

function getStackBounds(radius: number): { minY: number; maxY: number } {
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (let offset = -radius; offset <= radius; offset++) {
		const target = getSlotTarget(offset);
		minY = Math.min(minY, target.y);
		maxY = Math.max(maxY, target.y + TARGET_HEIGHT * target.scale);
	}
	return { minY, maxY };
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
		texture.anisotropy = 4;
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
	const gltf = useGLTF(MODEL_URL, DRACO_URL);
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
			} else if (mesh.name === "boxart") {
				mesh.material = new THREE.MeshStandardMaterial({
					map: gameArt,
					roughness: 0.21,
					metalness: 0.0,
					envMapIntensity: 1.22,
					color: new THREE.Color(0xffffff),
				});
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
}

function CartridgeSlot({ item, index, count, selected, reducedMotion }: SlotProps) {
	const ref = useRef<THREE.Group>(null!);
	const initialized = useRef(false);
	const isSelected = index === selected;

	const labelUrl = useMemo(() => item.artUrl ?? labelDataUrl(romView(item.rom)), [item]);

	const target = useMemo(() => {
		return getSlotTarget(wrappedOffset(index, selected, count));
	}, [index, selected, count]);

	useLayoutEffect(() => {
		if (!ref.current || initialized.current) return;
		ref.current.position.set(0, target.y, target.z);
		ref.current.rotation.set(target.rotX, target.rotY + FACE_ROTATION, 0);
		ref.current.scale.setScalar(target.scale);
		initialized.current = true;
	}, [target]);

	useFrame((state, delta) => {
		if (!ref.current) return;
		const l = THREE.MathUtils.lerp;
		ref.current.position.z = l(ref.current.position.z, target.z, LERP_SPEED * delta);
		let ty = target.y;
		if (isSelected && !reducedMotion) ty += Math.sin(state.clock.elapsedTime * 1.85) * 0.04;
		ref.current.position.y = l(ref.current.position.y, ty, LERP_SPEED * delta);
		const rotY = target.rotY + FACE_ROTATION;
		const rotX = target.rotX;
		ref.current.rotation.y = l(ref.current.rotation.y, rotY, LERP_SPEED * delta);
		ref.current.rotation.x = l(ref.current.rotation.x, rotX, LERP_SPEED * delta);
		ref.current.scale.setScalar(l(ref.current.scale.x, target.scale, LERP_SPEED * delta));
	});

	return <group ref={ref}><Cartridge3D labelUrl={labelUrl} /></group>;
}

function Tonemap({ visibleRadius }: { visibleRadius: number }) {
	const gl = useThree((s) => s.gl);
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const bounds = useMemo(() => getStackBounds(visibleRadius), [visibleRadius]);
	useEffect(() => {
		gl.toneMapping = THREE.ACESFilmicToneMapping;
		gl.toneMappingExposure = RIG.exposure;
		if (camera instanceof THREE.PerspectiveCamera) {
			// Fit the entire visible stack, not only its center cartridge, and
			// keep enough horizontal room for the shell on narrow canvases.
			const aspect = Math.max(size.width / Math.max(size.height, 1), 0.4);
			const stackHeight = (bounds.maxY - bounds.minY) * 1.14;
			const viewHeight = Math.max(stackHeight, MIN_HORIZONTAL_VIEW / aspect);
			camera.fov = THREE.MathUtils.clamp(
				THREE.MathUtils.radToDeg(2 * Math.atan(viewHeight / (2 * CAMERA_DISTANCE))),
				32,
				76,
			);
			camera.updateProjectionMatrix();
		}
		camera.lookAt(0, (bounds.minY + bounds.maxY) / 2, 0);
	}, [gl, camera, size.width, size.height, bounds]);
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
}

function HeroScene({ items, selected, reducedMotion }: SceneProps) {
	const count = items.length;
	const visibleRadius = Math.min(VISIBLE_RADIUS, Math.floor(count / 2));
	return (
		<>
			<Tonemap visibleRadius={visibleRadius} />
			<Rig />
			{items.map((item, i) =>
				Math.abs(wrappedOffset(i, selected, count)) <= visibleRadius ? (
					<CartridgeSlot
						key={item.rom.id}
						item={item}
						index={i}
						count={count}
						selected={selected}
						reducedMotion={reducedMotion}
					/>
				) : null,
			)}
		</>
	);
}

function measure(el: HTMLElement | null): { width: number; height: number } {
	if (!el) return { width: 0, height: 0 };
	const rect = el.getBoundingClientRect();
	return { width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) };
}

export default function HeroCartridges({ items }: { items: HeroCartridge[] }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rootRef = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null);
	const rootCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const rootDisposeTimer = useRef<number | null>(null);
	const rootConfigured = useRef(false);
	const [selected, setSelected] = useState(0);
	const drag = useRef<{ pointerId: number; lastY: number; carried: number } | null>(null);
	const reducedMotion = useMemo(
		() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
		[],
	);

	const count = items.length;

	const moveBy = useCallback((amount: number) => {
		if (!count || amount === 0) return;
		setSelected((current) => ((current + amount) % count + count) % count);
	}, [count]);

	// Wheel over the gallery advances the vertical shelf without scrolling the page.
	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		let accumulated = 0;
		let lastStepAt = Number.NEGATIVE_INFINITY;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const now = performance.now();
			if (now - lastStepAt < 160) return;
			accumulated += event.deltaY;
			if (Math.abs(accumulated) < 55) return;
			const direction = Math.sign(accumulated);
			accumulated = 0;
			lastStepAt = now;
			moveBy(direction);
		};
		element.addEventListener("wheel", onWheel, { passive: false });
		return () => element.removeEventListener("wheel", onWheel);
	}, [moveBy]);

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { pointerId: event.pointerId, lastY: event.clientY, carried: 0 };
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const state = drag.current;
		if (!state || state.pointerId !== event.pointerId) return;
		const delta = state.lastY - event.clientY;
		state.lastY = event.clientY;
		state.carried += delta;
		const steps = Math.trunc(state.carried / 56);
		if (steps) {
			state.carried -= steps * 56;
			moveBy(steps);
		}
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (drag.current?.pointerId === event.pointerId) drag.current = null;
	};

	const selectedItem = items[selected] ?? items[0];
	const selectedView = selectedItem ? romView(selectedItem.rom) : null;

	// Create the WebGL root once with an explicitly measured size.
	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container || count === 0) return;
		if (rootDisposeTimer.current !== null) {
			window.clearTimeout(rootDisposeTimer.current);
			rootDisposeTimer.current = null;
		}
		if (rootRef.current && rootCanvasRef.current !== canvas) {
			rootRef.current.unmount();
			rootRef.current = null;
			rootCanvasRef.current = null;
			rootConfigured.current = false;
		}
		let root = rootRef.current;
		if (!root) {
			root = createRoot(canvas);
			rootRef.current = root;
			rootCanvasRef.current = canvas;
			rootConfigured.current = false;
		}
		const box = measure(container);
		if (!rootConfigured.current) {
			rootConfigured.current = true;
			void root.configure({
				events,
				dpr: [1, 1.25],
				camera: { position: [0, 2.5, 9], fov: 32, near: 0.1, far: 80 },
				size: { width: box.width, height: box.height, top: 0, left: 0 },
				gl: { antialias: true, alpha: true, powerPreference: "high-performance", stencil: false },
			})
				.catch(() => {
					// WebGL unavailable: the 2D fallback already covers this case.
				});
		}
		const onResize = () => {
			const next = measure(container);
			void root.configure({ size: { width: next.width, height: next.height, top: 0, left: 0 } }).catch(() => {});
		};
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
			// React StrictMode replays effects once in development. Defer unmount
			// by one task so its immediate remount can reuse the same WebGL root.
			rootDisposeTimer.current = window.setTimeout(() => {
				rootDisposeTimer.current = null;
				if (rootRef.current !== root) return;
				rootRef.current = null;
				rootCanvasRef.current = null;
				rootConfigured.current = false;
				root.unmount();
			}, 0);
		};
	}, [count === 0]);

	// Re-render the scene whenever selection or items change.
	useEffect(() => {
		const root = rootRef.current;
		if (!root || count === 0) return;
		root.render(
			<HeroScene items={items} selected={selected} reducedMotion={reducedMotion} />,
		);
	});

	if (count === 0) return null;

	return (
		<div className="flex h-full w-full flex-col">
			<div
				ref={containerRef}
				role="region"
				className="relative min-h-0 flex-1 cursor-grab touch-none active:cursor-grabbing"
				aria-label="Popular game cartridges. Drag vertically or scroll to change games."
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={() => { drag.current = null; }}
			>
				<canvas ref={canvasRef} className="block h-full w-full" />
			</div>
			{selectedView && (
				<div aria-live="polite" className="mx-auto mt-1 flex w-full max-w-[480px] items-center gap-3 rounded-2xl border border-white/12 bg-[#101013]/85 px-4 py-3 shadow-[0_18px_55px_rgba(0,0,0,.35)] backdrop-blur-xl sm:px-5">
					<div className="min-w-0 flex-1">
						<p className="truncate text-[14px] font-medium tracking-[-0.02em] text-white sm:text-[15px]">{selectedView.title}</p>
						<p className="faint mt-1 truncate font-mono text-[9px] tracking-[0.13em] uppercase sm:text-[10px]">
							{selectedView.platform}
						</p>
					</div>
					<span className="faint shrink-0 font-mono text-[9px] tracking-[0.12em] uppercase">Drag / scroll</span>
				</div>
			)}
		</div>
	);
}

useGLTF.preload(MODEL_URL, DRACO_URL);
