"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { createWindowAtlas, FocusBeacon } from "./Building3D";
import InstancedBuildings from "./InstancedBuildings";
import { signalCityFrame } from "@/lib/city-first-frame";
import InstancedLabels from "./InstancedLabels";
import EffectsLayer from "./EffectsLayer";
import LiveDots from "./LiveDots";
import DropBeacon from "./DropBeacon";
import type { LiveSession } from "@/lib/useCodingPresence";
import type { CityBuilding } from "@/lib/github";
import type { BuildingColors } from "./CityCanvas";
import type { SmashStore } from "@/lib/league-city/smash";
import { getDistrictConfigBySlug } from "@/lib/codenagari-config";

const NO_FX =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("fx") === "0";

const GRID_CELL_SIZE = 200;

// Pre-allocated temp vector for focus info projection
const _position = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();

export interface FocusInfo {
  dist: number;
  screenX: number;
  screenY: number;
}

interface ActiveSkyBlimp {
  id: string;
  sponsor_name: string;
  badge_text: string;
  target_url: string;
  district_slug: string | null;
  expires_at: string | null;
}

interface EnrichedProfileMeta {
  github_login: string;
  district_slug: string | null;
  is_claimed: boolean;
  is_open_to_work: boolean;
  role_target: string | null;
  resume_or_portfolio_url: string | null;
  equipped_items: string[];
}

interface CityStateApiResponse {
  ok?: boolean;
  active_sky_blimps?: ActiveSkyBlimp[];
  profiles_by_login?: Record<string, EnrichedProfileMeta>;
  recruiter_spotlight?: EnrichedProfileMeta[];
}

// ─── Spatial Grid ───────────────────────────────────────────────

interface GridIndex {
  // Integer-keyed (cx * 4096 + cz) — matches the query side. City sits well
  // inside ±2k cells either way so this stays comfortably in V8 SMI range.
  cells: Map<number, number[]>;
  cellSize: number;
}

function buildSpatialGrid(
  buildings: CityBuilding[],
  cellSize: number
): GridIndex {
  const cells = new Map<number, number[]>();
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const cx = Math.floor(b.position[0] / cellSize);
    const cz = Math.floor(b.position[2] / cellSize);
    const key = cx * 4096 + cz;
    let arr = cells.get(key);
    if (!arr) {
      arr = [];
      cells.set(key, arr);
    }
    arr.push(i);
  }
  return { cells, cellSize };
}

// ─── Pre-computed building data ─────────────────────────────────

interface BuildingLookup {
  indexByLogin: Map<string, number>;
}

function buildLookup(buildings: CityBuilding[]): BuildingLookup {
  const indexByLogin = new Map<string, number>();
  for (let i = 0; i < buildings.length; i++) {
    indexByLogin.set(buildings[i].loginLower, i);
  }
  return { indexByLogin };
}

// ─── Smash ──────────────────────────────────────────────────────

/** The logins drawn broken (their roof items and beacons hide), re-read when the store says the set changed. */
function useSmashBroken(smash?: SmashStore): ReadonlySet<string> | null {
  const [broken, setBroken] = useState<ReadonlySet<string> | null>(null);
  const seen = useRef(-1);
  useFrame(() => {
    if (!smash || smash.version === seen.current) return;
    seen.current = smash.version;
    setBroken(smash.brokenLogins());
  });
  return broken;
}

// ─── 3D Sky Blimps (Up to 3 Active Sponsors Circling High Above Skyline) ───

function PixelSkyBlimpMesh({
  blimp,
  slotIndex,
}: {
  blimp: ActiveSkyBlimp;
  slotIndex: number;
}) {
  const blimpGroupRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Mesh>(null);

  const orbitCenter = useMemo(() => {
    const distCfg = getDistrictConfigBySlug(blimp.district_slug);
    return {
      x: distCfg ? distCfg.coordinates.gridOffsetX * 1.4 : 0,
      z: distCfg ? distCfg.coordinates.gridOffsetZ * 1.4 : 0,
      y: 135 + slotIndex * 24,
      radius: 46 + slotIndex * 14,
      speed: 0.16 + slotIndex * 0.04,
      phase: (slotIndex * Math.PI * 2) / 3,
    };
  }, [blimp.district_slug, slotIndex]);

  useFrame((state) => {
    const grp = blimpGroupRef.current;
    if (!grp) return;

    const t = state.clock.elapsedTime * orbitCenter.speed + orbitCenter.phase;
    const nextX = orbitCenter.x + Math.cos(t) * orbitCenter.radius;
    const nextZ = orbitCenter.z + Math.sin(t) * orbitCenter.radius;
    const nextY = orbitCenter.y + Math.sin(state.clock.elapsedTime * 1.3 + slotIndex) * 4.5;

    const dx = -Math.sin(t);
    const dz = Math.cos(t);
    const yaw = Math.atan2(dx, dz);

    grp.position.set(nextX, nextY, nextZ);
    grp.rotation.y = yaw;

    if (propRef.current) {
      propRef.current.rotation.z = state.clock.elapsedTime * 18;
    }
  });

  const hullColor =
    slotIndex === 0 ? "#E2FF32" : slotIndex === 1 ? "#38BDF8" : "#F59E0B";

  return (
    <group
      ref={blimpGroupRef}
      position={[orbitCenter.x + orbitCenter.radius, orbitCenter.y, orbitCenter.z]}
    >
      {/* Pixel-art dirigible envelope */}
      <mesh scale={[18, 8.5, 8.5]} dispose={null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#0F172A"
          emissive={hullColor}
          emissiveIntensity={0.35}
          roughness={0.5}
        />
      </mesh>

      {/* Neon stripe band */}
      <mesh position={[0, 0, 0]} scale={[18.3, 2.2, 8.8]} dispose={null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={hullColor}
          emissive={hullColor}
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>

      {/* Tail fins */}
      <mesh position={[-9.5, 2.2, 0]} scale={[3.2, 4.5, 1.2]} dispose={null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={hullColor} emissive={hullColor} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[-9.5, -2.2, 0]} scale={[3.2, 4.5, 1.2]} dispose={null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={hullColor} emissive={hullColor} emissiveIntensity={0.7} />
      </mesh>

      {/* Suspended gondola */}
      <mesh position={[0, -5.2, 0]} scale={[7.5, 2.2, 4.2]} dispose={null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1E293B" roughness={0.7} />
      </mesh>

      {/* Spinning rear propeller */}
      <mesh ref={propRef} position={[-9.6, 0, 0]} scale={[0.6, 4.2, 1.1]} dispose={null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#F8FAFC" emissive="#38BDF8" emissiveIntensity={0.8} />
      </mesh>

      {/* Clickable Sponsor Badge & Link */}
      <Html
        position={[0, 7.5, 0]}
        center
        distanceFactor={140}
        zIndexRange={[10, 0]}
      >
        <a
          href={blimp.target_url || "https://codenagari.in"}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto inline-flex flex-col items-center rounded-lg border border-cyan-300/80 bg-[#070B14]/95 px-2.5 py-1 text-center font-mono shadow-[0_0_16px_rgba(56,189,248,0.45)] hover:scale-105 transition whitespace-nowrap"
        >
          <span className="text-[9px] font-black uppercase tracking-wider text-[#E2FF32]">
            {blimp.sponsor_name}
          </span>
          <span className="text-[10px] font-bold text-white">
            {blimp.badge_text} ↗
          </span>
        </a>
      </Html>
    </group>
  );
}

// ─── Component ──────────────────────────────────────────────────

interface CitySceneProps {
  buildings: CityBuilding[];
  colors: BuildingColors;
  focusedBuilding?: string | null;
  focusedBuildingB?: string | null;
  hideEffectsFor?: string | null;
  accentColor?: string;
  onBuildingClick?: (building: CityBuilding) => void;
  onFocusInfo?: (info: FocusInfo) => void;
  introMode?: boolean;
  /** A film's camera (the trailer studio): like the intro, but every building keeps its items. */
  filmMode?: boolean;
  flyMode?: boolean;
  ghostPreviewLogin?: string | null;
  holdRise?: boolean;
  liveByLogin?: Map<string, LiveSession>;
  cityEnergy?: number;
  dimAll?: boolean;
  lowPerf?: boolean;
  /** Drive-through destruction (rival towns, see lib/league-city/smash). */
  smash?: SmashStore;
  ghostColor?: string;
  /** A building going up (a film's): nothing is drawn above this world height. */
  buildTo?: { current: number };
}

// Tells the loading screen the city is on screen: two rendered frames after
// the buildings mount (the first one uploads buffers and compiles shaders).
function FirstFrameSignal() {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > 2) return;
    frames.current++;
    if (frames.current === 2) signalCityFrame();
  });
  return null;
}

export default function CityScene({
  buildings,
  colors,
  focusedBuilding,
  focusedBuildingB,
  hideEffectsFor,
  accentColor,
  onBuildingClick,
  onFocusInfo,
  introMode,
  filmMode,
  flyMode,
  ghostPreviewLogin,
  holdRise,
  liveByLogin,
  cityEnergy,
  dimAll,
  lowPerf,
  smash,
  ghostColor,
  buildTo,
}: CitySceneProps) {
  const { camera } = useThree();

  // Single atlas texture for all building windows (created once per theme)
  const atlasTexture = useMemo(() => createWindowAtlas(colors), [colors]);

  // CodeNagari live telemetry: active 3D Sky Blimps & enriched profiles
  const [activeBlimps, setActiveBlimps] = useState<ActiveSkyBlimp[]>([]);
  const [enrichedProfiles, setEnrichedProfiles] = useState<
    Record<string, EnrichedProfileMeta>
  >({});

  // Smooth camera flight target when district or recruiter filter triggers
  const cameraFlightRef = useRef<{
    active: boolean;
    camPos: THREE.Vector3;
    lookAt: THREE.Vector3;
  }>({
    active: false,
    camPos: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
  });

  const loadCodeNagariCityState = useCallback(async () => {
    try {
      const res = await fetch("/api/codenagari/city-state", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as CityStateApiResponse;
      if (!data.ok) return;

      if (Array.isArray(data.active_sky_blimps)) {
        setActiveBlimps(data.active_sky_blimps.slice(0, 3));
      }
      if (data.profiles_by_login && typeof data.profiles_by_login === "object") {
        setEnrichedProfiles(data.profiles_by_login);
      }
    } catch {
      // Keep existing state on transient network failure
    }
  }, []);

  useEffect(() => {
    void loadCodeNagariCityState();
    const interval = setInterval(() => {
      void loadCodeNagariCityState();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadCodeNagariCityState]);

  // Merge CodeNagari profile enrichments (equipped_items, is_open_to_work, role_target)
  // onto matching CityBuilding entries without mutating props in place
  const mergedBuildings = useMemo(() => {
    if (Object.keys(enrichedProfiles).length === 0) return buildings;
    return buildings.map((b) => {
      const meta = enrichedProfiles[b.loginLower];
      if (!meta) return b;
      const combinedItems = Array.from(
        new Set([...(b.owned_items ?? []), ...(meta.equipped_items ?? [])])
      );
      return {
        ...b,
        claimed: b.claimed || meta.is_claimed || combinedItems.length > 0,
        owned_items: combinedItems,
        is_open_to_work: meta.is_open_to_work,
        role_target: meta.role_target,
        resume_or_portfolio_url: meta.resume_or_portfolio_url,
        district_slug: meta.district_slug,
      } as CityBuilding & {
        is_open_to_work?: boolean;
        role_target?: string | null;
        resume_or_portfolio_url?: string | null;
        district_slug?: string | null;
      };
    });
  }, [buildings, enrichedProfiles]);

  // Listen for district focus or recruiter filter events dispatched from CodeNagariOverlay
  useEffect(() => {
    const flyToCoords = (targetX: number, targetY: number, targetZ: number) => {
      _desiredTarget.set(targetX, targetY, targetZ);
      _desiredCamPos.set(targetX + 85, Math.max(85, targetY + 75), targetZ + 110);
      cameraFlightRef.current = {
        active: true,
        camPos: _desiredCamPos.clone(),
        lookAt: _desiredTarget.clone(),
      };
    };

    const handleDistrictFocusEvent = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ districtSlug?: string | null }>;
      const slug = customEvt.detail?.districtSlug;
      if (!slug) return;

      // First try matching any building assigned to that district_slug
      const matchingBuilding = mergedBuildings.find(
        (b) =>
          (b as CityBuilding & { district_slug?: string | null }).district_slug === slug
      );

      if (matchingBuilding) {
        flyToCoords(
          matchingBuilding.position[0],
          Math.max(20, matchingBuilding.height * 0.5),
          matchingBuilding.position[2]
        );
        return;
      }

      // Fallback to district grid coordinates
      const distCfg = getDistrictConfigBySlug(slug);
      if (distCfg) {
        flyToCoords(
          distCfg.coordinates.gridOffsetX * 1.4,
          30,
          distCfg.coordinates.gridOffsetZ * 1.4
        );
      }
    };

    const handleRecruiterFilterEvent = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ enabled?: boolean }>;
      if (!customEvt.detail?.enabled) return;

      const openToWorkBuilding = mergedBuildings.find((b) => {
        const ext = b as CityBuilding & { is_open_to_work?: boolean };
        return (
          ext.is_open_to_work ||
          (b.owned_items ?? []).includes("recruiter_hologram_beacon")
        );
      });

      if (openToWorkBuilding) {
        flyToCoords(
          openToWorkBuilding.position[0],
          Math.max(25, openToWorkBuilding.height * 0.6),
          openToWorkBuilding.position[2]
        );
      }
    };

    window.addEventListener("codenagari:focus-district", handleDistrictFocusEvent);
    window.addEventListener("codenagari:recruiter-filter", handleRecruiterFilterEvent);

    return () => {
      window.removeEventListener("codenagari:focus-district", handleDistrictFocusEvent);
      window.removeEventListener("codenagari:recruiter-filter", handleRecruiterFilterEvent);
    };
  }, [mergedBuildings]);

  // A broken building loses its roof items and beacons with its floors.
  const broken = useSmashBroken(smash);
  const standing = useMemo(
    () =>
      broken && broken.size > 0
        ? mergedBuildings.filter((b) => !broken.has(b.loginLower))
        : mergedBuildings,
    [mergedBuildings, broken]
  );

  // Spatial grid for effects LOD
  const grid = useMemo(
    () => buildSpatialGrid(standing, GRID_CELL_SIZE),
    [standing]
  );

  // Lookup for focus info emission
  const lookup = useMemo(() => buildLookup(mergedBuildings), [mergedBuildings]);

  // Cache focus names
  const focusedLower = focusedBuilding?.toLowerCase() ?? null;
  const focusedBLower = focusedBuildingB?.toLowerCase() ?? null;

  // Focused building data (for FocusBeacon positioning)
  const focusedBuildingData = useMemo(() => {
    if (!focusedLower) return null;
    const idx = lookup.indexByLogin.get(focusedLower);
    if (idx === undefined) return null;
    return mergedBuildings[idx];
  }, [focusedLower, lookup, mergedBuildings]);

  const focusedBuildingBData = useMemo(() => {
    if (!focusedBLower) return null;
    const idx = lookup.indexByLogin.get(focusedBLower);
    if (idx === undefined) return null;
    return mergedBuildings[idx];
  }, [focusedBLower, lookup, mergedBuildings]);

  const lastFocusUpdate = useRef(-1);

  // Smooth camera flight + throttled 5Hz focus info emission
  useFrame(({ clock, size }, delta) => {
    if (cameraFlightRef.current.active) {
      const lerpAlpha = Math.min(1, delta * 3.2);
      camera.position.lerp(cameraFlightRef.current.camPos, lerpAlpha);
      camera.lookAt(cameraFlightRef.current.lookAt);

      if (camera.position.distanceTo(cameraFlightRef.current.camPos) < 1.5) {
        cameraFlightRef.current.active = false;
      }
    }

    const elapsed = clock.elapsedTime;
    if (elapsed - lastFocusUpdate.current < 0.2) return;
    lastFocusUpdate.current = elapsed;

    if (!onFocusInfo || (!focusedLower && !focusedBLower)) return;

    const fi = focusedLower ? lookup.indexByLogin.get(focusedLower) : undefined;
    const fbi = focusedBLower ? lookup.indexByLogin.get(focusedBLower) : undefined;
    const targetIdx = fi ?? fbi;
    if (targetIdx === undefined) return;

    const b = mergedBuildings[targetIdx];
    const dx = camera.position.x - b.position[0];
    const dz = camera.position.z - b.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    _position.set(b.position[0], b.height * 0.65, b.position[2]);
    _position.project(camera);
    const screenX = (_position.x * 0.5 + 0.5) * size.width;
    const screenY = (-_position.y * 0.5 + 0.5) * size.height;
    onFocusInfo({ dist, screenX, screenY });
  });

  // Dispose atlas on theme change
  useEffect(() => {
    return () => atlasTexture.dispose();
  }, [atlasTexture]);

  return (
    <>
      {/* All buildings: single instanced draw call with custom shader */}
      {mergedBuildings.length > 0 && <FirstFrameSignal />}
      <InstancedBuildings
        buildings={mergedBuildings}
        colors={colors}
        atlasTexture={atlasTexture}
        focusedBuilding={focusedBuilding}
        focusedBuildingB={focusedBuildingB}
        introMode={introMode}
        onBuildingClick={onBuildingClick}
        holdRise={holdRise}
        liveByLogin={liveByLogin}
        cityEnergy={cityEnergy}
        dimAll={dimAll}
        smash={smash}
        ghostColor={ghostColor}
        buildTo={buildTo}
      />

      {/* Live presence dots above active buildings */}
      {liveByLogin && liveByLogin.size > 0 && (
        <LiveDots buildings={mergedBuildings} liveByLogin={liveByLogin} />
      )}

      {/* All labels: single instanced draw call with billboard shader */}
      <InstancedLabels
        buildings={mergedBuildings}
        introMode={introMode}
        flyMode={flyMode}
        focusedBuilding={focusedBuilding}
        focusedBuildingB={focusedBuildingB}
      />

      {/* Effects: React components only for nearby buildings with items (?fx=0 turns them off to measure phones) */}
      {!NO_FX && (
        <EffectsLayer
          buildings={standing}
          grid={grid}
          colors={colors}
          accentColor={accentColor ?? colors.accent ?? "#c8e64a"}
          focusedBuilding={focusedBuilding}
          focusedBuildingB={focusedBuildingB}
          hideEffectsFor={hideEffectsFor}
          introMode={introMode && !filmMode}
          flyMode={flyMode}
          ghostPreviewLogin={ghostPreviewLogin}
          lowPerf={lowPerf}
        />
      )}

      {/* Up to 3 animated 3D pixel-art Sky Blimps circling above the skyline */}
      {!introMode &&
        !NO_FX &&
        activeBlimps.slice(0, 3).map((blimp, idx) => (
          <PixelSkyBlimpMesh key={blimp.id} blimp={blimp} slotIndex={idx} />
        ))}

      {/* FocusBeacon: standalone, only when a building is focused */}
      {!introMode && focusedBuildingData && (
        <group
          position={[
            focusedBuildingData.position[0],
            0,
            focusedBuildingData.position[2],
          ]}
        >
          <FocusBeacon
            height={focusedBuildingData.height}
            width={focusedBuildingData.width}
            depth={focusedBuildingData.depth}
            accentColor={accentColor ?? "#c8e64a"}
          />
        </group>
      )}

      {!introMode &&
        focusedBuildingBData &&
        focusedBuildingBData !== focusedBuildingData && (
          <group
            position={[
              focusedBuildingBData.position[0],
              0,
              focusedBuildingBData.position[2],
            ]}
          >
            <FocusBeacon
              height={focusedBuildingBData.height}
              width={focusedBuildingBData.width}
              depth={focusedBuildingBData.depth}
              accentColor={accentColor ?? "#c8e64a"}
            />
          </group>
        )}

      {/* Drop beacons: pillars of light on buildings with active drops */}
      {!introMode &&
        standing
          .filter((b) => b.active_drop)
          .map((b) => (
            <group
              key={`drop-${b.login}`}
              position={[b.position[0], 0, b.position[2]]}
            >
              <DropBeacon
                rarity={b.active_drop!.rarity}
                height={b.height}
              />
            </group>
          ))}
    </>
  );
}
