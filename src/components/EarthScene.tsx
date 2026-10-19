import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Float32BufferAttribute,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  type Mesh,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  OBLIQUITY,
  SEASONS,
  sunDirection,
  surfacePoint,
  terminatorPoints,
  type SeasonId,
} from "../lib/astronomy";

export type ViewMode = "perspective" | "sun" | "north" | "south";

interface EarthSceneProps {
  season: SeasonId;
  rotation: number;
  latitude: number;
  view: ViewMode;
  showGrid: boolean;
  showTerminator: boolean;
  showLatitude: boolean;
  showAxis: boolean;
  resetToken?: number;
  onReady?: () => void;
  onFailure?: () => void;
}

type Point3 = [number, number, number];
const DEG = Math.PI / 180;
const RADIUS = 1.65;
const TILT = -OBLIQUITY * DEG;
const NORTH = new Vector3(0, 1, 0);
const MINT = "#89e6ce";

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D uEarth;
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 normal = normalize(vWorldNormal);
    float incidence = dot(normal, normalize(uSun));
    vec3 surface = texture2D(uEarth, vUv).rgb;
    // A tiny antialiasing band at h = 0; no artificial wide twilight zone.
    float day = smoothstep(-0.002, 0.002, incidence);
    float sunlight = 0.36 + 0.75 * sqrt(max(incidence, 0.0));
    vec3 night = surface * vec3(0.044, 0.062, 0.105);
    vec3 daylight = surface * sunlight;
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float water = smoothstep(0.015, 0.08, surface.b - surface.r);
    float glint = pow(max(dot(reflect(-normalize(uSun), normal), viewDirection), 0.0), 52.0);
    daylight += vec3(0.35, 0.46, 0.54) * glint * water * 0.22;
    gl_FragColor = vec4(mix(night, daylight, day), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float edge = pow(1.0 - abs(dot(normal, viewDirection)), 4.6);
    float sunlight = smoothstep(-0.2, 0.6, dot(normal, uSun));
    vec3 color = mix(vec3(0.11, 0.24, 0.52), vec3(0.30, 0.64, 0.87), sunlight);
    gl_FragColor = vec4(color, edge * (0.17 + sunlight * 0.28));
    #include <colorspace_fragment>
  }
`;

function transformed(point: Vector3) {
  return point.clone().applyAxisAngle(new Vector3(0, 0, 1), TILT);
}

function latitudePoints(latitude: number, radius = RADIUS + 0.009): Point3[] {
  return Array.from({ length: 241 }, (_, i) =>
    surfacePoint(latitude, i * 1.5, radius),
  );
}

function StarField() {
  const geometry = useMemo(() => {
    let seed = 73547;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const positions: number[] = [];
    const colors: number[] = [];
    for (let i = 0; i < 720; i++) {
      const z = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const radial = Math.sqrt(1 - z * z);
      positions.push(
        42 * radial * Math.cos(angle),
        42 * z,
        42 * radial * Math.sin(angle),
      );
      const intensity = 0.22 + random() * 0.53;
      colors.push(intensity * 0.8, intensity * 0.88, intensity);
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.065}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  );
}

function Grid() {
  const parallels = useMemo(
    () =>
      [-66.56, -OBLIQUITY, 0, OBLIQUITY, 66.56].map((latitude) => ({
        latitude,
        points: latitudePoints(latitude),
      })),
    [],
  );
  const meridians = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        Array.from({ length: 121 }, (_, j) =>
          surfacePoint(-90 + j * 1.5, i * 30, RADIUS + 0.006),
        ),
      ),
    [],
  );
  return (
    <group>
      {parallels.map(({ latitude, points }) => (
        <Line
          key={latitude}
          points={points}
          color={latitude === 0 ? "#c1dfd7" : "#a6bdc7"}
          lineWidth={latitude === 0 ? 0.75 : 0.6}
          transparent
          opacity={latitude === 0 ? 0.39 : 0.24}
          dashed={latitude !== 0}
          dashSize={0.035}
          gapSize={0.025}
        />
      ))}
      {meridians.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#a6bdc7"
          lineWidth={0.55}
          transparent
          opacity={0.18}
        />
      ))}
    </group>
  );
}

function Axis({ earthRef }: { earthRef: RefObject<Mesh> }) {
  const labelStyle = {
    color: "#b4c6d2",
    fontSize: "11px",
    fontFamily: "inherit",
    fontWeight: 500,
    letterSpacing: "0.13em",
    whiteSpace: "nowrap" as const,
    pointerEvents: "none" as const,
  };
  return (
    <group>
      <Line
        points={[
          [0, -2.12, 0],
          [0, 2.17, 0],
        ]}
        color="#d2d9e7"
        lineWidth={0.8}
        transparent
        opacity={0.57}
      />
      <mesh position={[0, 2.16, 0]}>
        <sphereGeometry args={[0.025, 12, 8]} />
        <meshBasicMaterial color="#b9d8d7" />
      </mesh>
      <Html
        position={[0, 2.3, 0]}
        center
        occlude={[earthRef]}
        style={labelStyle}
      >
        N <span style={{ opacity: 0.52, fontSize: "9px" }}>北極</span>
      </Html>
      <Html
        position={[0, -2.26, 0]}
        center
        occlude={[earthRef]}
        style={labelStyle}
      >
        S <span style={{ opacity: 0.52, fontSize: "9px" }}>南極</span>
      </Html>
    </group>
  );
}

function SunRays({ sun }: { sun: Vector3 }) {
  const compact = useThree((state) => state.size.width < 500);
  const tangent = new Vector3(-sun.y, sun.x, 0);
  const arrowRotation = new Quaternion().setFromUnitVectors(
    NORTH,
    sun.clone().negate(),
  );
  return (
    <group>
      {[-0.52, 0, 0.52].map((offset) => {
        const start = sun
          .clone()
          .multiplyScalar(3.3)
          .addScaledVector(tangent, offset);
        const end = sun
          .clone()
          .multiplyScalar(2.16)
          .addScaledVector(tangent, offset);
        return (
          <group key={offset}>
            <Line
              points={[start, end]}
              color="#e4bc78"
              lineWidth={0.85}
              transparent
              opacity={offset === 0 ? 0.71 : 0.4}
            />
            <mesh position={end} quaternion={arrowRotation}>
              <coneGeometry args={[0.037, 0.13, 8]} />
              <meshBasicMaterial
                color="#e4bc78"
                transparent
                opacity={offset === 0 ? 0.85 : 0.5}
              />
            </mesh>
          </group>
        );
      })}
      <Html
        position={sun
          .clone()
          .multiplyScalar(compact ? 2.1 : 2.75)
          .addScaledVector(tangent, compact ? 0.65 : 0.8)}
        center
        calculatePosition={(element, camera, size): [number, number] => {
          const point = new Vector3()
            .setFromMatrixPosition(element.matrixWorld)
            .project(camera);
          const x = (point.x * 0.5 + 0.5) * size.width;
          const y = (-point.y * 0.5 + 0.5) * size.height;
          return [compact ? Math.max(33, Math.min(size.width - 33, x)) : x, y];
        }}
        style={{
          pointerEvents: "none",
          whiteSpace: "nowrap",
          color: "#d6b982",
          fontSize: compact ? "8px" : "10px",
          letterSpacing: "0.1em",
          opacity: 0.85,
        }}
      >
        太陽平行光
      </Html>
    </group>
  );
}

function Earth({
  season,
  rotation,
  latitude,
  showGrid,
  showTerminator,
  showLatitude,
  showAxis,
  onReady,
}: EarthSceneProps) {
  const texture = useTexture(
    `${import.meta.env.BASE_URL}textures/earth-day.jpg`,
  );
  const earthRef = useRef<Mesh>(null!);
  const seasonData = SEASONS.find((item) => item.id === season) ?? SEASONS[0];
  const localSun = useMemo(
    () => new Vector3(...sunDirection(seasonData.longitude)),
    [seasonData.longitude],
  );
  const worldSun = useMemo(() => transformed(localSun), [localSun]);
  const terminator = useMemo(
    () => terminatorPoints(localSun.toArray() as Point3, 240, RADIUS + 0.012),
    [localSun],
  );
  const selectedParallel = useMemo(
    () => latitudePoints(latitude, RADIUS + 0.017),
    [latitude],
  );
  const marker = surfacePoint(latitude, 120, RADIUS + 0.035);
  const label = surfacePoint(latitude, 120, RADIUS + 0.17);
  const material = useMemo(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return new ShaderMaterial({
      uniforms: { uEarth: { value: texture }, uSun: { value: worldSun } },
      vertexShader: earthVertex,
      fragmentShader: earthFragment,
    });
  }, [texture, worldSun]);
  const atmosphere = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uSun: { value: worldSun } },
        vertexShader: earthVertex,
        fragmentShader: atmosphereFragment,
        side: BackSide,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [worldSun],
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => atmosphere.dispose(), [atmosphere]);
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <group rotation={[0, 0, TILT]}>
      <group rotation={[0, rotation * DEG, 0]}>
        <mesh ref={earthRef} material={material}>
          <sphereGeometry args={[RADIUS, 112, 80]} />
        </mesh>
        {showGrid && <Grid />}
        {showLatitude && (
          <>
            <mesh position={marker}>
              <sphereGeometry args={[0.037, 18, 12]} />
              <meshBasicMaterial color={MINT} />
            </mesh>
            <Html
              position={label}
              center
              occlude={[earthRef]}
              style={{
                pointerEvents: "none",
                whiteSpace: "nowrap",
                color: "#b3f2df",
                fontSize: "10px",
                padding: "5px 8px",
                background: "#0b1b24cc",
                border: "1px solid #83e4cc44",
                borderRadius: "4px",
                backdropFilter: "blur(8px)",
              }}
            >
              120°E 觀測點
            </Html>
          </>
        )}
      </group>
      <mesh material={atmosphere} renderOrder={2}>
        <sphereGeometry args={[RADIUS * 1.025, 80, 56]} />
      </mesh>
      {showLatitude && (
        <Line
          points={selectedParallel}
          color={MINT}
          lineWidth={1.55}
          transparent
          opacity={0.94}
        />
      )}
      {showTerminator && (
        <Line
          points={terminator}
          color="#b7abf4"
          lineWidth={1.25}
          transparent
          opacity={0.93}
        />
      )}
      {showAxis && <Axis earthRef={earthRef} />}
      <SunRays sun={localSun} />
    </group>
  );
}

function CameraRig({
  view,
  season,
  resetToken,
}: Pick<EarthSceneProps, "view" | "season" | "resetToken">) {
  const { camera, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<{ position: Vector3; up: Vector3 } | null>(null);
  const previous = useRef<{ view: ViewMode; resetToken?: number } | null>(null);
  const seasonData = SEASONS.find((item) => item.id === season) ?? SEASONS[0];
  useEffect(() => {
    if (
      previous.current?.view === view &&
      previous.current?.resetToken === resetToken &&
      view !== "sun"
    )
      return;
    previous.current = { view, resetToken };
    let position: Vector3;
    let up = new Vector3(0, 1, 0);
    if (view === "sun") {
      position = new Vector3(
        ...sunDirection(seasonData.longitude),
      ).multiplyScalar(6.35);
    } else if (view === "north") {
      position = new Vector3(0, 6.35, 0.006);
      up = new Vector3(0, 0, -1);
    } else if (view === "south") {
      position = new Vector3(0, -6.35, 0.006);
      up = new Vector3(0, 0, 1);
    } else {
      position = new Vector3(3.6, 1.3, 5.1);
    }
    goal.current = {
      position: transformed(position),
      up: view === "north" || view === "south" ? transformed(up) : up,
    };
    invalidate();
  }, [view, seasonData.longitude, resetToken, invalidate]);
  useFrame((_, delta) => {
    if (!goal.current) return;
    const target = goal.current;
    const step = 1 - Math.exp(-delta * 6);
    // Interpolate directions at a safe orbital radius, never through the globe.
    const distance =
      camera.position.length() +
      (target.position.length() - camera.position.length()) * step;
    const direction = camera.position
      .clone()
      .normalize()
      .lerp(target.position.clone().normalize(), step)
      .normalize();
    camera.position.copy(direction.multiplyScalar(distance));
    camera.up.lerp(target.up, step).normalize();
    camera.lookAt(0, 0, 0);
    controls.current?.update();
    if (
      camera.position.distanceTo(target.position) < 0.004 &&
      camera.up.distanceTo(target.up) < 0.004
    )
      goal.current = null;
    else invalidate();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.075}
      minDistance={3.3}
      maxDistance={11}
      rotateSpeed={0.65}
      zoomSpeed={0.7}
      onStart={() => {
        goal.current = null;
      }}
    />
  );
}

function SceneFailure({
  onFailure,
  children,
}: {
  onFailure?: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    onFailure?.();
  }, [onFailure]);
  return (
    <div className="scene-fallback webgl-fallback" role="status">
      {children}
    </div>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; onFailure?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure?.();
  }
  render() {
    return this.state.failed ? (
      <SceneFailure>
        無法啟動 3D 畫面。請確認瀏覽器已啟用 WebGL
        與硬體加速，再重新整理；右側天文計算仍可使用。
      </SceneFailure>
    ) : (
      this.props.children
    );
  }
}

export default function EarthScene(props: EarthSceneProps) {
  return (
    <SceneBoundary onFailure={props.onFailure}>
      <Canvas
        camera={{
          position: transformed(new Vector3(3.6, 1.3, 5.1)).toArray(),
          fov: 40,
          near: 0.1,
          far: 100,
        }}
        frameloop="demand"
        dpr={[1, 1.25]}
        gl={{ antialias: true, alpha: true, powerPreference: "default" }}
        fallback={
          <SceneFailure onFailure={props.onFailure}>
            此瀏覽器無法啟動 WebGL。請開啟硬體加速後重新整理。
          </SceneFailure>
        }
        role="img"
        aria-label="可拖曳旋轉、以滾輪縮放的三維地球日照模型"
      >
        <StarField />
        <Suspense fallback={null}>
          <Earth {...props} />
        </Suspense>
        <CameraRig
          view={props.view}
          season={props.season}
          resetToken={props.resetToken}
        />
      </Canvas>
    </SceneBoundary>
  );
}
