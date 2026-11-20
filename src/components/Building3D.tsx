"use client";

import { useMemo, useRef, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";
import type { BuildingColors } from "./CityCanvas";
import {
  ZONE_ITEMS,
  CODENAGARI_VOXEL_SPECS,
  type CodeNagariItemVisualSpec,
} from "@/lib/zones";
import {
  NeonOutline,
  ParticleAura,
  SpotlightEffect,
  RooftopFire,
  Helipad,
  AntennaArray,
  RooftopGarden,
  Spire,
  Billboards,
  Flag,
  NeonTrim,
  SatelliteDish,
  CrownItem,
  CompanionDuck,
  PoolParty,
  HologramRing,
  LightningAura,
  LEDBanner,
  StreakFlame,
  GitHubStar,
  TierNeonTrim,
  TierBaseGlow,
  TierSkyBeam,
} from "./BuildingEffects";
import { tierFromLevel } from "@/lib/xp";
import { MiniWhiteRabbit } from "./WhiteRabbit";

// Shared constants
const WHITE = new THREE.Color("#ffffff");
const RUST_BRONZE_TINT = new THREE.Color("#6e5849");
const RUST_ROOF_TINT = new THREE.Color("#4f433b");
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Shared unit box & cylinder geometries — scaled per primitive, prevents per-frame allocations
const SHARED_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const SHARED_CYLINDER_GEO = new THREE.CylinderGeometry(1, 1, 1, 8);

// Extended optional fields on CityBuilding for CodeNagari profiles & 24h preview state
type CodeNagariBuildingExt = CityBuilding & {
  is_open_to_work?: boolean;
  role_target?: string | null;
  resume_or_portfolio_url?: string | null;
  district_slug?: string | null;
  gifted_by?: string | null;
  created_at?: string | null;
  first_seen_at?: string | null;
};

// ─── Window Atlas ────────────────────────────────────────────
// ONE 2048x2048 texture with 6 lit-percentage bands of 42 rows each.
// Buildings clone this and use offset/repeat to pick their unique region.
const ATLAS_SIZE = 2048;
const ATLAS_CELL = 8; // 6px window + 2px gap
const ATLAS_COLS = ATLAS_SIZE / ATLAS_CELL; // 256
const ATLAS_BAND_ROWS = 42;
const ATLAS_LIT_PCTS = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95];

// Parse hex/named color to ABGR uint32 for direct pixel writes (little-endian)
function colorToABGR(hex: string): number {
  const c = new THREE.Color(hex);
  return (
    255 << 24 |
    (Math.round(c.b * 255) << 16) |
    (Math.round(c.g * 255) << 8) |
    Math.round(c.r * 255)
  );
}

export function createWindowAtlas(colors: BuildingColors): THREE.CanvasTexture {
  const WS = 6;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Use ImageData + Uint32Array for direct pixel writes (10-50x faster than fillRect)
  const imageData = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
  const buf32 = new Uint32Array(imageData.data.buffer);

  const faceABGR = colorToABGR(colors.face);
  const litABGRs = colors.windowLit.map(colorToABGR);
  const offABGR = colorToABGR(colors.windowOff);

  // Fill background with face color
  buf32.fill(faceABGR);

  let s = 42;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let band = 0; band < ATLAS_LIT_PCTS.length; band++) {
    const litPct = ATLAS_LIT_PCTS[band];
    const bandStart = band * ATLAS_BAND_ROWS;
    for (let r = 0; r < ATLAS_BAND_ROWS; r++) {
      const rowY = (bandStart + r) * ATLAS_CELL;
      for (let c = 0; c < ATLAS_COLS; c++) {
        const px = c * ATLAS_CELL;
        const abgr = rand() < litPct
          ? litABGRs[Math.floor(rand() * litABGRs.length)]
          : offABGR;
        // Write WS×WS pixel block directly
        for (let dy = 0; dy < WS; dy++) {
          const rowOffset = (rowY + dy) * ATLAS_SIZE + px;
          for (let dx = 0; dx < WS; dx++) {
            buf32[rowOffset + dx] = abgr;
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWindowTexture(
  rows: number,
  cols: number,
  litPct: number,
  seed: number,
  litColors: string[],
  offColor: string,
  faceColor: string
): THREE.CanvasTexture {
  const WS = 6;
  const GAP = 2;
  const PAD = 3;

  const w = PAD * 2 + cols * WS + Math.max(0, cols - 1) * GAP;
  const h = PAD * 2 + rows * WS + Math.max(0, rows - 1) * GAP;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, w, h);

  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = PAD + c * (WS + GAP);
      const y = PAD + r * (WS + GAP);

      if (rand() < litPct) {
        ctx.fillStyle = litColors[Math.floor(rand() * litColors.length)];
      } else {
        ctx.fillStyle = offColor;
      }
      ctx.fillRect(x, y, WS, WS);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── CodeNagari Helpers: Rust Weathering & Recruiter Beacon ─

function isBuildingRusted(building: CodeNagariBuildingExt): boolean {
  const items = building.owned_items ?? [];
  if (building.claimed || items.includes("recruiter_hologram_beacon") || building.is_open_to_work) {
    return false;
  }

  const timestampCandidate = building.created_at ?? building.first_seen_at;
  if (timestampCandidate) {
    const parsedMs = Date.parse(timestampCandidate);
    if (!Number.isNaN(parsedMs)) {
      return Date.now() - parsedMs > TWENTY_FOUR_HOURS_MS;
    }
  }

  // Deterministic fallback for static/seed buildings without a timestamp:
  // ~45% of unclaimed buildings display oxidized bronze-grey weathering after initial preview
  const hash = building.login.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return hash % 11 < 5;
}

function hasActiveRecruiterBeacon(building: CodeNagariBuildingExt): boolean {
  const items = building.owned_items ?? [];
  return Boolean(building.is_open_to_work || items.includes("recruiter_hologram_beacon"));
}

function createOpenToSdeSignTexture(roleTarget?: string | null): THREE.CanvasTexture {
  const W = 512;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, W, H);

  // Dark cyber glass pill
  ctx.fillStyle = "rgba(7, 11, 20, 0.92)";
  ctx.beginPath();
  ctx.roundRect(14, 14, W - 28, H - 28, 16);
  ctx.fill();

  // Emerald neon border
  ctx.strokeStyle = "#10B981";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(14, 14, W - 28, H - 28, 16);
  ctx.stroke();

  // Top line: OPEN TO SDE
  ctx.fillStyle = "#E2FF32";
  ctx.font = 'bold 38px "Silkscreen", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OPEN TO SDE", W / 2, 48);

  // Sub-line: HIRING ME or custom target role
  const subLabel = roleTarget && roleTarget.trim().length > 0
    ? roleTarget.trim().slice(0, 26).toUpperCase()
    : "HIRING ME • RESUME READY";
  ctx.fillStyle = "#34D399";
  ctx.font = 'bold 22px "Silkscreen", monospace';
  ctx.fillText(subLabel, W / 2, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── CodeNagari Rooftop Voxel Item & Floating Sign Renderer ───

function CodeNagariVoxelGroup({
  spec,
  height,
  width,
  depth,
  indexOffset,
}: {
  spec: CodeNagariItemVisualSpec;
  height: number;
  width: number;
  depth: number;
  indexOffset: number;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const scaleFactor = Math.max(2.4, Math.min(width, depth) * 0.28);

  const baseY = useMemo(() => {
    if (spec.zone === "crown") return height + 4.5 + indexOffset * 2.2;
    if (spec.zone === "aura") return height + 2.5;
    return height + 0.6;
  }, [spec.zone, height, indexOffset]);

  useFrame((state) => {
    const grp = rootRef.current;
    if (!grp) return;
    const t = state.clock.elapsedTime + indexOffset * 1.1;

    if (spec.animates === "bob_spin") {
      grp.position.y = baseY + Math.sin(t * 2.4) * 1.1;
      grp.rotation.y = t * 1.4;
    } else if (spec.animates === "pulse_beacon") {
      grp.position.y = baseY + Math.sin(t * 3.0) * 0.6;
      grp.rotation.y = t * 0.9;
    } else if (spec.animates === "tapri_steam") {
      grp.position.y = baseY + Math.sin(t * 2.0) * 0.2;
      grp.rotation.y = Math.sin(t * 0.6) * 0.15;
    } else if (spec.animates === "squad_orbit") {
      grp.position.y = baseY + Math.cos(t * 2.2) * 0.7;
      grp.rotation.y = -t * 1.2;
    }
  });

  return (
    <group
      ref={rootRef}
      position={[0, baseY, 0]}
      scale={[scaleFactor, scaleFactor, scaleFactor]}
    >
      {spec.primitives.map((prim, idx) => {
        const isCyl = prim.kind === "cylinder";
        const geo = isCyl ? SHARED_CYLINDER_GEO : SHARED_BOX_GEO;
        const argsScale: [number, number, number] = isCyl
          ? [prim.size[0], prim.size[2], prim.size[1]]
          : prim.size;

        return (
          <mesh
            key={`${spec.id}-${idx}`}
            geometry={geo}
            position={prim.position}
            rotation={prim.rotation ?? [0, 0, 0]}
            scale={argsScale}
            dispose={null}
          >
            <meshStandardMaterial
              color={prim.color}
              emissive={prim.emissive ? new THREE.Color(prim.emissive) : new THREE.Color("#000000")}
              emissiveIntensity={prim.emissiveIntensity ?? 0}
              roughness={0.55}
              metalness={0.15}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function OpenToSdeFloatingSign({
  height,
  roleTarget,
}: {
  height: number;
  roleTarget?: string | null;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);

  const signTexture = useMemo(
    () => createOpenToSdeSignTexture(roleTarget),
    [roleTarget]
  );

  useEffect(() => {
    return () => {
      signTexture.dispose();
    };
  }, [signTexture]);

  const signMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: signTexture,
        transparent: true,
        depthTest: true,
        sizeAttenuation: true,
      }),
    [signTexture]
  );

  useEffect(() => {
    return () => {
      signMaterial.dispose();
    };
  }, [signMaterial]);

  const baseSignY = height + 34;

  useFrame((state) => {
    if (!spriteRef.current) return;
    const t = state.clock.elapsedTime;
    spriteRef.current.position.y = baseSignY + Math.sin(t * 2.8) * 2.4;
  });

  return (
    <sprite
      ref={spriteRef}
      material={signMaterial}
      position={[0, baseSignY, 0]}
      scale={[36, 9, 1]}
    />
  );
}

// ─── Claimed Glow (neon trim + roof light) ────────────────────

export const ClaimedGlow = memo(function ClaimedGlow({
  height,
  width,
  depth,
  color,
}: {
  height: number;
  width: number;
  depth: number;
  /** Roofline trim color — pass the owner's XP-tier color; defaults to city lime. */
  color?: string;
}) {
  const trimThickness = 1.2;
  const trimHeight = 2;
  const accent = color ?? "#c8e64a";
  const hw = width / 2 + trimThickness / 2;
  const hd = depth / 2 + trimThickness / 2;

  return (
    <group>
      {/* Neon trim — 4 bars around the roofline */}
      <group position={[0, height - trimHeight / 2, 0]}>
        {/* Front */}
        <mesh position={[0, 0, hd]}>
          <boxGeometry args={[width + trimThickness * 2, trimHeight, trimThickness]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3} toneMapped={false} />
        </mesh>
        {/* Back */}
        <mesh position={[0, 0, -hd]}>
          <boxGeometry args={[width + trimThickness * 2, trimHeight, trimThickness]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3} toneMapped={false} />
        </mesh>
        {/* Left */}
        <mesh position={[-hw, 0, 0]}>
          <boxGeometry args={[trimThickness, trimHeight, depth]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3} toneMapped={false} />
        </mesh>
        {/* Right */}
        <mesh position={[hw, 0, 0]}>
          <boxGeometry args={[trimThickness, trimHeight, depth]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3} toneMapped={false} />
        </mesh>
      </group>

    </group>
  );
});

// ─── Multi-Level Labels ──────────────────────────────────────

/** Level 1: Far — just @USERNAME (512x80, semi-transparent bg for readability) */
function createFarLabel(building: CodeNagariBuildingExt): THREE.CanvasTexture {
  const W = 512;
  const H = 80;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const login = building.login.length > 16
    ? building.login.slice(0, 16).toUpperCase() + "..."
    : building.login.toUpperCase();
  const text = `@${login}`;

  ctx.font = 'bold 40px "Silkscreen", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Semi-transparent background pill for contrast
  const textWidth = ctx.measureText(text).width;
  const padX = 20;
  const padY = 8;
  const bgW = textWidth + padX * 2;
  const bgH = 48 + padY * 2;
  const bgX = (W - bgW) / 2;
  const bgY = (H - bgH) / 2;
  ctx.fillStyle = "rgba(10, 10, 14, 0.65)";
  ctx.beginPath();
  ctx.roundRect(bgX, bgY, bgW, bgH, 6);
  ctx.fill();

  const isClaimedOrBeaconed =
    building.claimed ||
    hasActiveRecruiterBeacon(building) ||
    (building.owned_items?.length ?? 0) > 0;

  if (isClaimedOrBeaconed) {
    const tier = tierFromLevel(building.xp_level ?? 1);
    // Localhost tier (Lv 1-4) uses default cream; higher tiers get tier color
    if (tier.id === "localhost") {
      ctx.fillStyle = "#e8dcc8";
      ctx.shadowColor = "rgba(200, 230, 74, 0.5)";
    } else {
      ctx.fillStyle = tier.color;
      ctx.shadowColor = tier.color;
    }
    ctx.shadowBlur = 8;
  } else {
    ctx.fillStyle = "rgba(140, 140, 160, 0.6)";
  }

  ctx.fillText(text, W / 2, H / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}


// ─── Building Animation (separate component, unmounts when done) ─

function BuildingRiseAnimation({
  height,
  meshRef,
  spriteRef,
}: {
  height: number;
  meshRef: React.RefObject<THREE.Mesh | null>;
  spriteRef: React.RefObject<THREE.Sprite | null>;
}) {
  const progress = useRef(0);
  const done = useRef(false);

  useFrame((_, delta) => {
    if (done.current) return;

    progress.current = Math.min(1, progress.current + delta * 1.2);
    const t = 1 - Math.pow(1 - progress.current, 3);

    if (meshRef.current) {
      meshRef.current.scale.y = Math.max(0.001, t * height);
      meshRef.current.position.y = (height * t) / 2;
    }
    if (spriteRef.current) {
      spriteRef.current.position.y = height * t + 20;
    }

    if (progress.current >= 1) {
      done.current = true;
    }
  });

  return null;
}

// ─── Focus Highlight (batman spotlight + beacon) ─────────────

const BEACON_HEIGHT = 500;
const SPOTLIGHT_Y = 400; // cone origin high above

export function FocusBeacon({ height, width, depth, accentColor }: { height: number; width: number; depth: number; accentColor: string }) {
  const coneRef = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Cone pulse
    if (coneRef.current) {
      (coneRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.10 + Math.sin(t * 1.5) * 0.03;
    }
    // Marker bob + spin
    if (markerRef.current) {
      markerRef.current.position.y = height + 35 + Math.sin(t * 2) * 5;
      markerRef.current.rotation.y = t * 1.5;
    }
  });

  const coneRadius = Math.max(width, depth) * 1.2;

  return (
    <group>
      {/* Batman spotlight cone from sky */}
      <mesh ref={coneRef} position={[0, SPOTLIGHT_Y / 2, 0]}>
        <cylinderGeometry args={[0, coneRadius, SPOTLIGHT_Y, 32, 1, true]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.10}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Thin bright core beam */}
      <mesh position={[0, BEACON_HEIGHT / 2, 0]}>
        <boxGeometry args={[2, BEACON_HEIGHT, 2]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* Floating diamond marker */}
      <group ref={markerRef} position={[0, height + 35, 0]}>
        <mesh>
          <octahedronGeometry args={[6, 0]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
        <mesh scale={[1.6, 1.6, 1.6]}>
          <octahedronGeometry args={[6, 0]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.15} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Main Building Component ─────────────────────────────────

// ─── Loadout-Aware Effect Rendering ──────────────────────────
// NOTE: the item_id → visual mapping below is mirrored in
// cosmetics/itemRenderers.ts (buildingItemVisual), which the shop and admin
// gallery render through. Keep the two in sync when adding an item.

/** True when the building's crown slot shows the free claim flag. */
export function showsFlag(building: CityBuilding): boolean {
  const items = building.owned_items ?? [];
  if (!items.includes("flag")) return false;
  const { loadout } = building;
  const hasLoadout = loadout && (loadout.crown || loadout.roof || loadout.aura);
  return hasLoadout ? loadout.crown === "flag" : true;
}

export const BuildingItemEffects = memo(function BuildingItemEffects({ building, accentColor, focused, skipFlag }: {
  building: CodeNagariBuildingExt;
  accentColor: string;
  focused?: boolean;
  /** The city draws flags instanced (InstancedEffects); previews draw them here. */
  skipFlag?: boolean;
}) {
  const { height, width, depth, owned_items, loadout, billboard_images } = building;
  const items = owned_items ?? [];

  // Zone definitions (from shared constants)
  const crownItems = ZONE_ITEMS.crown;
  const roofItems = ZONE_ITEMS.roof;
  const auraItems = ZONE_ITEMS.aura;

  // Without a loadout, only render flag (free claim item). All other items require explicit equip.
  const hasLoadout = loadout && (loadout.crown || loadout.roof || loadout.aura);
  const crownItem = hasLoadout ? loadout.crown : (items.includes("flag") ? "flag" : null);
  const roofItem = hasLoadout ? loadout.roof : null;
  const auraItem = hasLoadout ? loadout.aura : null;

  const shouldRender = (itemId: string) => {
    if (!items.includes(itemId)) return false;
    return true; // Faces zone items always render if owned
  };

  const shouldRenderZone = (itemId: string) => {
    if (!items.includes(itemId)) return false;
    if (crownItems.includes(itemId)) return crownItem === itemId;
    if (roofItems.includes(itemId)) return roofItem === itemId;
    if (auraItems.includes(itemId)) return auraItem === itemId;
    return true;
  };

  // CodeNagari items render when owned (or when loadout explicitly selects them)
  const equippedCodeNagariSpecs = useMemo(() => {
    const specs: CodeNagariItemVisualSpec[] = [];
    for (const itemId of items) {
      if (
        itemId === "pixel_cat_companion" ||
        itemId === "chakra_neon_crown" ||
        itemId === "recruiter_hologram_beacon" ||
        itemId === "hostel_squad_4pack"
      ) {
        specs.push(CODENAGARI_VOXEL_SPECS[itemId]);
      }
    }
    return specs;
  }, [items]);

  const showRecruiterSign = hasActiveRecruiterBeacon(building);

  return (
    <>
      {/* Aura zone */}
      {shouldRenderZone("neon_outline") && (
        <NeonOutline width={width} height={height} depth={depth} color={accentColor} />
      )}
      {shouldRenderZone("particle_aura") && (
        <ParticleAura width={width} height={height} depth={depth} color={accentColor} />
      )}
      {shouldRenderZone("spotlight") && (
        <SpotlightEffect height={height} width={width} depth={depth} color={accentColor} />
      )}

      {/* Roof zone */}
      {shouldRenderZone("rooftop_fire") && (
        <RooftopFire height={height} width={width} depth={depth} />
      )}
      {shouldRenderZone("antenna_array") && (
        <AntennaArray height={height} width={width} depth={depth} />
      )}
      {shouldRenderZone("rooftop_garden") && (
        <RooftopGarden height={height} width={width} depth={depth} />
      )}

      {/* Crown zone */}
      {shouldRenderZone("helipad") && (
        <Helipad height={height} width={width} depth={depth} />
      )}
      {shouldRenderZone("spire") && (
        <Spire height={height} width={width} depth={depth} />
      )}
      {!skipFlag && shouldRenderZone("flag") && (
        <Flag height={height} width={width} depth={depth} color={accentColor} />
      )}

      {/* New aura zone items */}
      {shouldRenderZone("neon_trim") && (
        <NeonTrim width={width} height={height} depth={depth} color={accentColor} />
      )}
      {shouldRenderZone("hologram_ring") && (
        <HologramRing width={width} height={height} depth={depth} color={accentColor} />
      )}
      {shouldRenderZone("lightning_aura") && (
        <LightningAura width={width} height={height} depth={depth} color={accentColor} />
      )}

      {/* New crown zone items */}
      {shouldRenderZone("satellite_dish") && (
        <SatelliteDish height={height} width={width} depth={depth} color={accentColor} />
      )}
      {shouldRenderZone("crown_item") && (
        <CrownItem height={height} color={accentColor} focused={focused} />
      )}
      {shouldRenderZone("github_star") && (
        <GitHubStar height={height} width={width} depth={depth} color={accentColor} />
      )}
      {shouldRenderZone("companion_duck") && (
        <CompanionDuck height={height} width={width} depth={depth} variant="companion_duck" />
      )}
      {shouldRenderZone("duck_combatant") && (
        <CompanionDuck height={height} width={width} depth={depth} variant="duck_combatant" />
      )}
      {shouldRenderZone("duck_gold_animated") && (
        <CompanionDuck height={height} width={width} depth={depth} variant="duck_gold_animated" />
      )}
      {/* White rabbit: always renders for completers, not tied to loadout */}
      {building.rabbit_completed && (
        <MiniWhiteRabbit height={height} width={width} depth={depth} />
      )}

      {/* New roof zone items */}
      {shouldRenderZone("pool_party") && (
        <PoolParty height={height} width={width} depth={depth} />
      )}

      {/* Faces zone (always render if owned) */}
      {shouldRender("billboard") && (
        <Billboards height={height} width={width} depth={depth} images={billboard_images ?? []} color={accentColor} />
      )}
      {shouldRender("led_banner") && (
        <LEDBanner height={height} width={width} depth={depth} color={accentColor} />
      )}

      {/* CodeNagari Low-Poly Voxel Items (Pixel Cat + Chai Tapri, Chakra Crown, Recruiter Beacon, Hostel Squad) */}
      {equippedCodeNagariSpecs.map((spec, idx) => (
        <CodeNagariVoxelGroup
          key={spec.id}
          spec={spec}
          height={height}
          width={width}
          depth={depth}
          indexOffset={idx}
        />
      ))}

      {/* Floating Bobbing 3D Rooftop Sign for Open-to-SDE / Recruiter Beacon Builders */}
      {showRecruiterSign && (
        <OpenToSdeFloatingSign
          height={height}
          roleTarget={building.role_target}
        />
      )}
    </>
  );
});

// ─── Main Building Component ─────────────────────────────────

interface Props {
  building: CodeNagariBuildingExt;
  colors: BuildingColors;
  atlasTexture: THREE.CanvasTexture;
  introMode?: boolean;
  focused?: boolean;
  dimmed?: boolean;
  accentColor?: string;
  onClick?: (building: CityBuilding) => void;
}

export default function Building3D({ building, colors, atlasTexture, introMode, focused, dimmed, accentColor, onClick }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const spriteRef = useRef<THREE.Sprite>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  const isRusted = useMemo(() => isBuildingRusted(building), [building]);

  const textures = useMemo(() => {
    const seed =
      building.login.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 137;

    // Custom color buildings: per-building canvas textures (rare, <5%)
    // Blend custom color 50% with theme face color to prevent glaring brightness
    if (building.custom_color) {
      const blended = new THREE.Color(colors.face)
        .lerp(new THREE.Color(building.custom_color), 0.5);
      const blendedHex = '#' + blended.getHexString();
      const front = createWindowTexture(
        building.floors,
        building.windowsPerFloor,
        building.litPercentage,
        seed,
        colors.windowLit,
        colors.windowOff,
        blendedHex
      );
      const side = createWindowTexture(
        building.floors,
        building.sideWindowsPerFloor,
        building.litPercentage,
        seed + 7919,
        colors.windowLit,
        colors.windowOff,
        blendedHex
      );
      return { front, side };
    }

    // Atlas-based textures (lightweight clones, shared GPU source)
    const bandIndex = Math.min(5, Math.max(0, Math.round(building.litPercentage * 5)));
    const bandRowOffset = bandIndex * ATLAS_BAND_ROWS;

    const frontColStart = Math.abs(seed % Math.max(1, ATLAS_COLS - building.windowsPerFloor));
    const front = atlasTexture.clone();
    front.offset.set(frontColStart / ATLAS_COLS, bandRowOffset / ATLAS_COLS);
    front.repeat.set(building.windowsPerFloor / ATLAS_COLS, building.floors / ATLAS_COLS);

    const sideColStart = Math.abs((seed + 7919) % Math.max(1, ATLAS_COLS - building.sideWindowsPerFloor));
    const side = atlasTexture.clone();
    side.offset.set(sideColStart / ATLAS_COLS, bandRowOffset / ATLAS_COLS);
    side.repeat.set(building.sideWindowsPerFloor / ATLAS_COLS, building.floors / ATLAS_COLS);

    return { front, side };
  }, [building, colors, atlasTexture]);

  useEffect(() => {
    return () => {
      textures.front.dispose();
      textures.side.dispose();
    };
  }, [textures]);

  const materials = useMemo(() => {
    const roofColor = isRusted
      ? new THREE.Color(colors.roof).lerp(RUST_ROOF_TINT, 0.55)
      : new THREE.Color(colors.roof);

    const roof = new THREE.MeshStandardMaterial({
      color: roofColor,
      emissive: isRusted ? RUST_ROOF_TINT : new THREE.Color(colors.roof),
      emissiveIntensity: isRusted ? 0.35 : 1.5,
      roughness: isRusted ? 0.95 : 0.6,
      metalness: isRusted ? 0.25 : 0,
    });

    const emIntensity = isRusted ? 0.45 : (building.custom_color ? 1.5 : 2.0);
    const faceTint = isRusted ? RUST_BRONZE_TINT : WHITE;

    const make = (tex: THREE.CanvasTexture) =>
      new THREE.MeshStandardMaterial({
        map: tex,
        color: faceTint,
        emissive: faceTint,
        emissiveMap: tex,
        emissiveIntensity: emIntensity,
        roughness: isRusted ? 0.92 : 0.85,
        metalness: isRusted ? 0.2 : 0,
      });

    // Reuse material instances for opposite faces (5 allocs -> 3)
    const side = make(textures.side);
    const front = make(textures.front);
    return [side, side, roof, roof, front, front];
  }, [textures, colors.roof, isRusted, building.custom_color]);

  // Defer label creation until intro is done (saves 160KB+ canvas work per building)
  const labelTexture = useMemo(
    () => introMode ? null : createFarLabel(building),
    [building, introMode]
  );

  useEffect(() => {
    return () => { labelTexture?.dispose(); };
  }, [labelTexture]);

  const labelMaterial = useMemo(
    () =>
      labelTexture
        ? new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true,
            depthTest: true,
            sizeAttenuation: true,
            fog: true,
          })
        : null,
    [labelTexture]
  );

  // Dispose materials + label material on unmount/change
  useEffect(() => {
    return () => {
      for (const mat of materials) mat.dispose();
      labelMaterial?.dispose();
    };
  }, [materials, labelMaterial]);

  // Dim/undim building when another is focused
  useEffect(() => {
    const baseEmissive = isRusted ? 0.45 : 2.0;
    for (const mat of materials) {
      mat.transparent = dimmed || false;
      mat.opacity = dimmed ? 0.55 : 1;
      mat.emissiveIntensity = dimmed ? 0.25 : (mat.map ? baseEmissive : (isRusted ? 0.35 : 1.5));
    }
    if (labelMaterial) {
      labelMaterial.opacity = focused ? 0 : dimmed ? 0.15 : 1;
    }
    if (spriteRef.current) spriteRef.current.visible = !focused;
    // Reset group visibility when un-dimming
    if (!dimmed && groupRef.current) {
      groupRef.current.visible = true;
    }
  }, [focused, dimmed, materials, labelMaterial, isRusted]);

  const isClaimedOrBeaconed =
    building.claimed ||
    hasActiveRecruiterBeacon(building) ||
    (building.owned_items?.length ?? 0) > 0;

  return (
    <group ref={groupRef} position={[building.position[0], 0, building.position[2]]}>
      <mesh
        ref={meshRef}
        material={materials}
        geometry={SHARED_BOX_GEO}
        scale={[building.width, 0.001, building.depth]}
        dispose={null}
        onPointerDown={introMode ? undefined : (e) => {
          pointerDown.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={introMode ? undefined : (e) => {
          e.stopPropagation();
          if (!pointerDown.current) return;
          const dx = e.clientX - pointerDown.current.x;
          const dy = e.clientY - pointerDown.current.y;
          if (dx * dx + dy * dy > 25) return; // >5px = drag, not click
          onClick?.(building);
        }}
        onPointerOver={introMode ? undefined : () => { document.body.style.cursor = "pointer"; }}
        onPointerOut={introMode ? undefined : () => { document.body.style.cursor = "auto"; }}
      />

      {labelMaterial && (
        <sprite
          ref={spriteRef}
          material={labelMaterial}
          position={[0, building.height + 20, 0]}
          scale={[32, 5, 1]}
        />
      )}

      <BuildingRiseAnimation
        height={building.height}
        meshRef={meshRef}
        spriteRef={spriteRef}
      />

      {/* Skip heavy effects during intro - camera moves too fast to see them */}
      {!introMode && isClaimedOrBeaconed && (
        <ClaimedGlow
          height={building.height}
          width={building.width}
          depth={building.depth}
          color={tierFromLevel(building.xp_level ?? 1).color}
        />
      )}

      {!introMode && focused && <FocusBeacon height={building.height} width={building.width} depth={building.depth} accentColor={accentColor ?? "#c8e64a"} />}

      {!introMode && (
        <BuildingItemEffects building={building} accentColor={accentColor ?? colors.accent ?? "#c8e64a"} focused={focused} />
      )}

      {!introMode && building.app_streak > 0 && (
        <StreakFlame height={building.height} width={building.width} depth={building.depth} streakDays={building.app_streak} color={accentColor ?? colors.accent ?? "#c8e64a"} />
      )}

      {/* XP Tier visual effects */}
      {!introMode && building.xp_level >= 5 && (() => {
        const tier = tierFromLevel(building.xp_level);
        return (
          <>
            {/* Staging (Lv 5-8): Blue neon trim */}
            {tier.id === "staging" && (
              <TierNeonTrim width={building.width} height={building.height} depth={building.depth} color={tier.color} />
            )}
            {/* Production (Lv 9-13): Purple base glow + neon trim */}
            {tier.id === "production" && (
              <>
                <TierBaseGlow width={building.width} depth={building.depth} color={tier.color} />
                <TierNeonTrim width={building.width} height={building.height} depth={building.depth} color={tier.color} />
              </>
            )}
            {/* Open Source (Lv 14-18): Golden base + golden neon trim */}
            {tier.id === "open_source" && (
              <>
                <TierBaseGlow width={building.width} depth={building.depth} color={tier.color} />
                <TierNeonTrim width={building.width} height={building.height} depth={building.depth} color={tier.color} />
              </>
            )}
            {/* Unicorn (Lv 19-23): Cyan sky beam + base glow + neon trim */}
            {tier.id === "unicorn" && (
              <>
                <TierBaseGlow width={building.width} depth={building.depth} color={tier.color} />
                <TierNeonTrim width={building.width} height={building.height} depth={building.depth} color={tier.color} />
                <TierSkyBeam height={building.height} color={tier.color} />
              </>
            )}
            {/* Founder (Lv 24+): Prismatic sky beam + base glow + white neon trim */}
            {tier.id === "founder" && (
              <>
                <TierBaseGlow width={building.width} depth={building.depth} color={tier.color} />
                <TierNeonTrim width={building.width} height={building.height} depth={building.depth} color={tier.color} />
                <TierSkyBeam height={building.height} color={tier.color} prismatic />
              </>
            )}
          </>
        );
      })()}
    </group>
  );
}
