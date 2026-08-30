import { useGLTF, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
	memo,
	Suspense,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import * as THREE from "three";

import type { Game } from "../data/games";

const MODEL_URL = "/api/asset/new-n64cart.glb";
const BODY_MAP_URL = "/api/asset/newbase.jpg";
const BODY_NORMAL_URL = "/api/asset/newbase_Normal.tga.png";
const BODY_ROUGHNESS_URL = "/api/asset/newbase_Roughness.tga.png";

const SPACING = 3.6;
const SIDE_SCALE = 0.58;
// .glb exports facing away from camera; flip to show the label
const MODEL_ROT_Y = Math.PI;

// Resting pose: the featured cart leans back so its bottom connector shows;
// side carts angle inward toward the center.
const CENTER_PITCH = -0.42;
const SIDE_PITCH = -0.05;
const SIDE_YAW = 0.34;

// Underdamped spring: quick slide with one subtle overshoot bounce.
const SPRING_OMEGA = 19;
const SPRING_ZETA = 0.62;

function springStep(
	pos: number,
	vel: number,
	target: number,
	dt: number,
	omega = SPRING_OMEGA,
	zeta = SPRING_ZETA,
): [number, number] {
	const accel = -omega * omega * (pos - target) - 2 * zeta * omega * vel;
	const nextVel = vel + accel * dt;
	return [pos + nextVel * dt, nextVel];
}

// Insert timeline (seconds): a bouncy hop above the row with a full spin,
// then a fast, decisive drop into the "slot" at the bottom of the screen.
const INSERT = { rise: 0.3, hang: 0.1, drop: 0.16 };
const INSERT_APEX_Y = 1.6;
const INSERT_SLOT_Y = -1.7;
const INSERT_TOTAL = INSERT.rise + INSERT.hang + INSERT.drop;

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeInQuad = (p: number) => p * p;
const easeOutBack = (p: number) => 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2;
const easeInOutQuad = (p: number) =>
	p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;

const CART_HEIGHT = 2.35;

useGLTF.setDecoderPath(
	"https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
);
useGLTF.preload(MODEL_URL);

// Label images decode asynchronously, then enter a shared GPU queue. The queue
// uploads at most one texture every few frames, avoiding startup bursts.
function useLabelTexture(url: string | null, fallback: THREE.Texture) {
	const [tex, setTex] = useState(fallback);
	useEffect(() => {
		let alive = true;
		let loaded: THREE.Texture | null = null;
		setTex(fallback);
		if (!url) return;

		const apply = (t: THREE.Texture) => {
			loaded = t;
			if (!alive) {
				t.dispose();
				return;
			}
			t.flipY = false;
			t.colorSpace = THREE.SRGBColorSpace;
			t.anisotropy = 8;
			// Small delay lets several labels decode before the GPU upload burst
			const timer = setTimeout(() => {
				if (alive) setTex(t);
			}, 40);
			cleanupTimers.push(() => clearTimeout(timer));
		};
		const cleanupTimers: Array<() => void> = [];

		if ("createImageBitmap" in window) {
			const loader = new THREE.ImageBitmapLoader();
			loader.setOptions({
				imageOrientation: "from-image",
				premultiplyAlpha: "none",
			});
			loader.load(
				url,
				(bitmap) => {
					const texture = new THREE.Texture(bitmap);
					texture.needsUpdate = true;
					apply(texture);
				},
				undefined,
				() => {},
			);
		} else {
			new THREE.TextureLoader().load(url, apply, undefined, () => {});
		}
		return () => {
			alive = false;
			cleanupTimers.forEach((fn) => {
				fn();
			});
			loaded?.dispose();
		};
	}, [url, fallback]);
	return tex;
}

interface CartridgeProps {
	index: number;
	count: number;
	carousel: { selected: number; launching: boolean };
	artUrl: string | null;
	onPick: (index: number) => void;
	onLaunch: () => void;
	bodyNode: THREE.Mesh;
	labelNode: THREE.Mesh;
	modelOffset: THREE.Vector3;
	normScale: number;
	body: {
		map: THREE.Texture;
		normalMap: THREE.Texture;
		roughnessMap: THREE.Texture;
	};
	fallbackLabel: THREE.Texture;
}

const Cartridge = memo(function Cartridge({
	index,
	count,
	carousel,
	artUrl,
	onPick,
	onLaunch,
	bodyNode,
	labelNode,
	modelOffset,
	normScale,
	body,
	fallbackLabel,
}: CartridgeProps) {
	const outer = useRef<THREE.Group>(null);
	const inner = useRef<THREE.Group>(null);

	const bodyMat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				map: body.map,
				normalMap: body.normalMap,
				roughnessMap: body.roughnessMap,
				metalness: 0.05,
			}),
		[body],
	);

	const labelTex = useLabelTexture(artUrl, fallbackLabel);
	const labelMat = useMemo(
		() => new THREE.MeshStandardMaterial({ roughness: 0.5 }),
		[],
	);
	useEffect(() => {
		labelMat.map = labelTex;
		labelMat.needsUpdate = true;
	}, [labelTex, labelMat]);

	useEffect(() => {
		// Delay disposal by a task so StrictMode's setup/cleanup/setup cycle
		// can cancel it instead of invalidating materials still in use.
		return () => {
			setTimeout(() => {
				bodyMat.dispose();
				labelMat.dispose();
			});
		};
	}, [bodyMat, labelMat]);

	const vel = useRef({ x: 0, y: 0, s: 0 });
	const rot = useRef({ pitch: 0, yaw: 0 });
	const launchStart = useRef<number | null>(null);
	const settling = useRef(false);
	const uscale = useRef(1);
	const prevY = useRef(0);

	useFrame((state, delta) => {
		if (!outer.current || !inner.current) return;
		const t = state.clock.elapsedTime;
		const dt = Math.min(delta, 1 / 30); // clamp so springs stay stable
		const offset = wrapOffset(index - carousel.selected, count);
		const launching = carousel.launching;
		const isCenter = offset === 0;
		const pos = outer.current.position;

		const targetX = offset * SPACING;
		const targetY = isCenter ? -0.1 : 0;
		const targetZ = isCenter ? 0.45 : -0.85;
		const targetScale = isCenter ? 1 : SIDE_SCALE;
		const shouldShow = Math.abs(offset) <= 2;

		// Hidden carts stay mounted (no rebuild jank) and park just below.
		if (!shouldShow) {
			launchStart.current = null;
			settling.current = false;
			outer.current.visible = false;
			pos.set(targetX, targetY - 1.2, targetZ);
			uscale.current = targetScale;
			outer.current.scale.setScalar(uscale.current);
			prevY.current = pos.y;
			vel.current.x = vel.current.y = vel.current.s = 0;
			rot.current.pitch = isCenter ? CENTER_PITCH : SIDE_PITCH;
			rot.current.yaw = isCenter ? 0 : offset < 0 ? -SIDE_YAW : SIDE_YAW;
			return;
		}
		outer.current.visible = true;

		// Springy slide with a hint of overshoot
		[pos.x, vel.current.x] = springStep(pos.x, vel.current.x, targetX, dt);
		pos.z += (targetZ - pos.z) * (1 - 0.001 ** dt);
		const [s, sv] = springStep(
			uscale.current,
			vel.current.s,
			targetScale,
			dt,
			16,
			0.6,
		);
		uscale.current = s;
		vel.current.s = sv;

		// Insert animation: choreographed y-path + full spin for the featured cart
		let spin = 0;
		let flightTilt = 0;
		const inFlight = launching && isCenter;
		if (inFlight) {
			if (launchStart.current === null) launchStart.current = t;
			const lt = t - launchStart.current;
			const { rise, hang, drop } = INSERT;
			if (lt < rise) {
				pos.y = -0.1 + (INSERT_APEX_Y + 0.1) * easeOutBack(lt / rise);
			} else if (lt < rise + hang) {
				pos.y = INSERT_APEX_Y + Math.sin((lt - rise) * 14) * 0.03;
			} else if (lt < rise + hang + drop) {
				const q = easeInQuad((lt - rise - hang) / drop);
				pos.y = INSERT_APEX_Y + (INSERT_SLOT_Y - INSERT_APEX_Y) * q;
			} else {
				pos.y = INSERT_SLOT_Y; // seated dead solid until the launch ends
			}
			vel.current.y = 0;
			const spinP = Math.min(lt / (rise + hang), 1);
			spin = 2 * Math.PI * easeInOutQuad(spinP);
			flightTilt = Math.sin(spinP * Math.PI) * 0.24;
		} else {
			if (launchStart.current !== null) settling.current = true;
			launchStart.current = null;
			// After an insert the cart sits in the slot; the spring pops it back up.
			[pos.y, vel.current.y] = springStep(
				pos.y,
				vel.current.y,
				targetY,
				dt,
				13,
				0.7,
			);
			if (
				settling.current &&
				Math.abs(pos.y - targetY) < 0.04 &&
				Math.abs(vel.current.y) < 0.2
			)
				settling.current = false;
		}

		// Squash & stretch along vertical motion; rigid during the insert flight.
		const vy = (pos.y - prevY.current) / Math.max(dt, 1e-4);
		prevY.current = pos.y;
		const stretch =
			inFlight || settling.current ? 0 : Math.min(Math.abs(vy) * 0.028, 0.22);
		outer.current.scale.set(
			Math.max(0.01, uscale.current * (1 - stretch * 0.5)),
			Math.max(0.01, uscale.current * (1 + stretch)),
			Math.max(0.01, uscale.current * (1 - stretch * 0.5)),
		);

		// Smoothly blend toward the resting pose for this slot
		const targetPitch = inFlight ? 0 : isCenter ? CENTER_PITCH : SIDE_PITCH;
		const targetYaw =
			inFlight || isCenter ? 0 : offset < 0 ? -SIDE_YAW : SIDE_YAW;
		const kRot = 1 - 0.002 ** dt;
		rot.current.pitch += (targetPitch - rot.current.pitch) * kRot;
		rot.current.yaw += (targetYaw - rot.current.yaw) * kRot;

		// Pose + gentle idle sway + launch spin. Sway phase is keyed on the
		// stable index so selection changes can't pop the rotation.
		inner.current.rotation.x =
			rot.current.pitch + Math.sin(t * 0.8 + index) * 0.02;
		inner.current.rotation.y =
			MODEL_ROT_Y +
			rot.current.yaw +
			spin +
			Math.sin(t * 0.55 + index * 1.7) * (isCenter ? 0.06 : 0.03);
		// Lean into the direction of travel, proportional to slide velocity
		inner.current.rotation.z =
			THREE.MathUtils.clamp(-vel.current.x * 0.045, -0.2, 0.2) + flightTilt;
	});

	// Initial transform is set ONCE here; after mount the useFrame springs own it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: mounts once with the initial transform
	useLayoutEffect(() => {
		if (!outer.current) return;
		const off = wrapOffset(index - carousel.selected, count);
		const isC = off === 0;
		outer.current.visible = Math.abs(off) <= 2;
		outer.current.position.set(
			off * SPACING,
			(isC ? -0.1 : 0) - 1.7,
			isC ? 0.45 : -0.85,
		);
		outer.current.scale.setScalar(isC ? 1 : SIDE_SCALE);
		rot.current.pitch = isC ? CENTER_PITCH : SIDE_PITCH;
		rot.current.yaw = isC ? 0 : off < 0 ? -SIDE_YAW : SIDE_YAW;
		uscale.current = outer.current.scale.x;
		prevY.current = outer.current.position.y;
	}, []);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: R3F 3D object, not DOM
		<group
			onClick={(e) => {
				e.stopPropagation();
				if (wrapOffset(index - carousel.selected, count) === 0) onLaunch();
				else onPick(index);
			}}
			onPointerOut={() => (document.body.style.cursor = "auto")}
			onPointerOver={() => (document.body.style.cursor = "pointer")}
			ref={outer}
		>
			<group ref={inner} scale={normScale}>
				<group position={modelOffset}>
					<mesh
						dispose={null}
						geometry={bodyNode.geometry}
						material={bodyMat}
						position={bodyNode.position}
						quaternion={bodyNode.quaternion}
						scale={bodyNode.scale}
					/>
					<mesh
						dispose={null}
						geometry={labelNode.geometry}
						material={labelMat}
						position={labelNode.position}
						quaternion={labelNode.quaternion}
						scale={labelNode.scale}
					/>
				</group>
			</group>
		</group>
	);
});

// Wrap index distance so the carousel is endless in both directions.
function wrapOffset(rawOffset: number, count: number) {
	return rawOffset - Math.round(rawOffset / count) * count;
}

interface SceneContentsProps {
	games: Game[];
	artMap: Record<string, string>;
	carousel: { selected: number; launching: boolean };
	onPick: (index: number) => void;
	onLaunch: () => void;
}

function SceneContents({
	games,
	artMap,
	carousel,
	onPick,
	onLaunch,
}: SceneContentsProps) {
	const { scene } = useGLTF(MODEL_URL);
	const gl = useThree((s) => s.gl);
	const [mapImage, normalImage, roughnessImage] = useLoader(
		THREE.ImageBitmapLoader,
		[BODY_MAP_URL, BODY_NORMAL_URL, BODY_ROUGHNESS_URL],
		(loader) =>
			loader.setOptions({
				imageOrientation: "from-image",
				premultiplyAlpha: "none",
				resizeWidth: 1024,
				resizeHeight: 1024,
				resizeQuality: "high",
			}),
	);
	const body = useMemo(
		() => ({
			map: new THREE.Texture(mapImage),
			normalMap: new THREE.Texture(normalImage),
			roughnessMap: new THREE.Texture(roughnessImage),
		}),
		[mapImage, normalImage, roughnessImage],
	);
	const fallbackLabel = useTexture("/icon.svg");
	const fallbackTexture = useMemo(() => {
		// The svg texture is a placeholder; a flat dark label reads better.
		const canvas = document.createElement("canvas");
		canvas.width = 64;
		canvas.height = 56;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "#111114";
			ctx.fillRect(0, 0, 64, 56);
		}
		const tex = new THREE.Texture(canvas);
		tex.needsUpdate = true;
		return tex;
	}, []);
	useEffect(() => () => fallbackTexture.dispose(), [fallbackTexture]);
	void fallbackLabel;

	// The GLTF has two root meshes. Reuse their decoded geometries and transforms
	// directly instead of cloning/traversing the scene per cartridge.
	const { bodyNode, labelNode, modelOffset, normScale } = useMemo(() => {
		const bodyMesh = scene.getObjectByName("model_2") as THREE.Mesh | undefined;
		const labelMesh = scene.getObjectByName("boxart") as THREE.Mesh | undefined;
		if (!bodyMesh || !labelMesh)
			throw new Error("cartridge model meshes missing");
		const box = new THREE.Box3().setFromObject(scene);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());
		return {
			bodyNode: bodyMesh,
			labelNode: labelMesh,
			modelOffset: center.multiplyScalar(-1),
			normScale: CART_HEIGHT / (size.y || 1),
		};
	}, [scene]);

	useLayoutEffect(() => {
		body.map.colorSpace = THREE.SRGBColorSpace;
		Object.values(body).forEach((t) => {
			t.flipY = false;
			t.needsUpdate = true;
			gl.initTexture(t);
		});
		fallbackTexture.flipY = false;
		fallbackTexture.colorSpace = THREE.SRGBColorSpace;
		fallbackTexture.needsUpdate = true;
		gl.initTexture(fallbackTexture);
	}, [body, fallbackTexture, gl]);

	return (
		<>
			{games.map((game, gi) => (
				<Cartridge
					artUrl={artMap[game.title] ?? null}
					body={body}
					bodyNode={bodyNode}
					carousel={carousel}
					count={games.length}
					fallbackLabel={fallbackTexture}
					index={gi}
					key={game.title}
					labelNode={labelNode}
					modelOffset={modelOffset}
					normScale={normScale}
					onLaunch={onLaunch}
					onPick={onPick}
				/>
			))}
		</>
	);
}

const Scene = memo(function Scene({
	games,
	artMap,
	carousel,
	onPick,
	onLaunch,
}: SceneContentsProps) {
	return (
		<Canvas
			camera={{ position: [0, 0.15, 7.4], fov: 35 }}
			dpr={[1, 1.75]}
			gl={{ alpha: true, antialias: true }}
			onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
		>
			<ambientLight intensity={1.1} />
			<directionalLight intensity={1.6} position={[4, 5, 6]} />
			<directionalLight intensity={0.5} position={[-5, 2, -3]} />
			<directionalLight intensity={0.25} position={[0, -3, 4]} />
			<Suspense fallback={null}>
				<SceneContents
					artMap={artMap}
					carousel={carousel}
					games={games}
					onLaunch={onLaunch}
					onPick={onPick}
				/>
			</Suspense>
		</Canvas>
	);
});

export { easeOutCubic, INSERT_TOTAL };
export default Scene;
