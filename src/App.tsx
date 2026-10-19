import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Axis3D,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Globe2,
  Info,
  Layers3,
  Maximize2,
  Moon,
  Move3D,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import type { ViewMode } from "./components/EarthScene";
import {
  dayLengthHours,
  formatHours,
  hourAngleForLongitude,
  OBLIQUITY,
  SEASONS,
  solarAltitude,
} from "./lib/astronomy";
import type { SeasonId } from "./lib/astronomy";

// Keep WebGL and its dependencies out of the initial interface bundle.
const EarthScene = lazy(() => import("./components/EarthScene"));

class SceneModuleBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback" role="status">
        <strong>無法載入 3D 模組</strong>
        <p>
          預覽可能未能下載繪圖資源。四季與緯度分析仍可使用，請重新載入後再試。
        </p>
        <a href="">重新載入頁面</a>
      </div>
    ) : (
      this.props.children
    );
  }
}

const views: { id: ViewMode; name: string; icon: typeof Orbit }[] = [
  { id: "perspective", name: "自由視角", icon: Orbit },
  { id: "sun", name: "太陽視角", icon: Sun },
  { id: "north", name: "北極俯視", icon: Compass },
  { id: "south", name: "南極俯視", icon: Globe2 },
];
const seasonSymbols = ["✳", "☀", "❋", "❄"];
const latitudeLabel = (latitude: number) =>
  latitude === 0
    ? "赤道 0°"
    : `${latitude > 0 ? "北緯" : "南緯"} ${Number(Math.abs(latitude).toFixed(2))}°`;
const signed = (n: number) =>
  Math.abs(n) < 1e-8
    ? "0.00°"
    : `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}°`;

export default function App() {
  const [seasonId, setSeasonId] = useState<SeasonId>("june");
  const [view, setView] = useState<ViewMode>("perspective");
  const [latitude, setLatitude] = useState(25);
  const [rotation, setRotation] = useState(240);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [grid, setGrid] = useState(true);
  const [terminator, setTerminator] = useState(true);
  const [parallel, setParallel] = useState(true);
  const [axis, setAxis] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [mountScene, setMountScene] = useState(false);
  const [slowScene, setSlowScene] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const scenePanel = useRef<HTMLElement>(null);
  const handleSceneSettled = useCallback(() => setReady(true), []);
  const season = SEASONS.find((item) => item.id === seasonId)!;
  const daylight = dayLengthHours(latitude, season.declination);
  const hourAngle = hourAngleForLongitude(120, rotation);
  const altitude = solarAltitude(latitude, season.declination, hourAngle);
  const noonAltitude = solarAltitude(latitude, season.declination, 0);
  const solarTime = (12 + hourAngle / 15 + 24) % 24;
  const clockMinutes = Math.floor(solarTime * 60) % 1440;
  const clockLabel = `${Math.floor(clockMinutes / 60)
    .toString()
    .padStart(2, "0")}:${(clockMinutes % 60).toString().padStart(2, "0")}`;
  const polarEquinox =
    Math.abs(latitude) === 90 && Math.abs(season.declination) < 1e-8;
  const isDay = altitude > 1e-7;
  const isHorizon = Math.abs(altitude) <= 1e-7;
  const insight = polarEquinox
    ? "分點時，兩極的太陽整日位於地平線。這是理想模型的退化情況，不適用一般日出、日落與晝長定義。"
    : daylight === 24
      ? "這個緯度的太陽整日不會降到地平線下方，形成極晝；自轉一圈也不會進入黑夜。"
      : daylight === 0
        ? "這個緯度整日沒有太陽升到地平線上方，形成極夜；自轉一圈也看不到日出。"
        : Math.abs(season.declination) < 1e-8
          ? "太陽直射赤道。除了兩極的特殊情況，各緯度的晨昏線都將緯圈均分，理論上晝夜各 12 小時。"
          : latitude === 0
            ? "赤道的緯圈始終被晨昏線均分。即使四季更替，理論晝長仍為 12 小時。"
            : `此處${latitude * season.declination > 0 ? "所在半球朝向太陽，日行軌跡位於白晝區的比例較高" : "所在半球背向太陽，日行軌跡位於白晝區的比例較低"}。拖曳地球，觀察緯圈如何穿過晨昏線。`;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;
    function tick(time: number) {
      if (last)
        setRotation(
          (value) =>
            (value + Math.min((time - last) / 1000, 0.1) * 8 * speed) % 360,
        );
      last = time;
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  useEffect(() => {
    // Give the controls a chance to paint before initializing a GPU context.
    const timer = window.setTimeout(() => setMountScene(true), 100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => setSlowScene(true), 12_000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = "hidden";
    scenePanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key === "Tab") {
        const focusable = scenePanel.current?.querySelectorAll<HTMLElement>(
          "button, input, select, a[href]",
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [expanded]);

  function reset() {
    setSeasonId("june");
    setLatitude(25);
    setRotation(240);
    setPlaying(false);
    setSpeed(1);
    setView("perspective");
    setGrid(true);
    setTerminator(true);
    setParallel(true);
    setAxis(true);
    setResetKey((key) => key + 1);
    setExpanded(false);
  }

  function toggleFullscreen() {
    // In-page expansion also works in iframes without fullscreen permission.
    setExpanded((value) => !value);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="地球日照與四季首頁">
          <span className="brand-mark">
            <Orbit size={27} strokeWidth={1.5} />
          </span>
          <span>
            <strong>地球日照與四季</strong>
            <small>EARTH & SEASONS LAB</small>
          </span>
        </a>
        <nav className="top-nav" aria-label="主選單">
          <span className="nav-active">
            <span className="tiny-dot" />
            互動探索
          </span>
          <button onClick={() => dialog.current?.showModal()}>
            <BookOpen size={15} />
            科學原理
          </button>
        </nav>
        <div className="topbar-end">
          <span className="version-badge">
            高中地球科學 <span>／</span> v1.0
          </span>
          <button className="reset-button" onClick={reset}>
            <RotateCcw size={14} />
            <span>重設實驗</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">
              <span />A LITTLE TILT. A WORLD OF CHANGE.
            </div>
            <h1>
              地球的傾斜，<span>寫下四季。</span>
            </h1>
            <p>轉動地球，追隨陽光。從不同的視角，探索晝夜與四季的關係。</p>
          </div>
          <div className="hero-note">
            <span className="hero-note-icon">
              <Axis3D size={24} strokeWidth={1.3} />
            </span>
            <div>
              <strong>
                23.44<span>°</span>
              </strong>
              <small>一個傾角，四季的起點</small>
            </div>
          </div>
        </section>

        <div className="workspace">
          <aside className="control-panel panel" aria-label="實驗控制">
            <div className="panel-heading">
              <span className="section-number">01</span>
              <h2>探索設定</h2>
              <SlidersHorizontal size={15} />
            </div>
            <section className="control-section">
              <div className="field-heading">
                <h3>選擇節氣</h3>
                <span>以北半球四季為例</span>
              </div>
              <div className="season-grid">
                {SEASONS.map((item, i) => (
                  <button
                    key={item.id}
                    className={`season-button ${seasonId === item.id ? "selected" : ""}`}
                    aria-pressed={seasonId === item.id}
                    onClick={() => setSeasonId(item.id)}
                  >
                    <span className={`season-symbol season-${item.id}`}>
                      {seasonSymbols[i]}
                    </span>
                    <strong>{item.label}</strong>
                    <small>{item.date}</small>
                    {seasonId === item.id && (
                      <span className="season-check">
                        <Check size={10} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="declination-row">
                <span>太陽赤緯 δ</span>
                <strong data-testid="declination">
                  {signed(season.declination)}
                </strong>
              </div>
            </section>
            <section className="control-section views-section">
              <div className="field-heading">
                <h3>觀察視角</h3>
                <span>4 個觀察位置</span>
              </div>
              <div className="view-grid">
                {views.map(({ id, name, icon: Icon }) => (
                  <button
                    className={view === id ? "active" : ""}
                    key={id}
                    aria-pressed={view === id}
                    onClick={() => {
                      setView(id);
                      setResetKey((key) => key + 1);
                    }}
                  >
                    <Icon size={16} />
                    {name}
                  </button>
                ))}
              </div>
            </section>
            <section className="control-section layers-section">
              <div className="field-heading">
                <h3>輔助圖層</h3>
                <Layers3 size={13} />
              </div>
              {[
                {
                  label: "經緯網格",
                  value: grid,
                  change: setGrid,
                  color: "grid",
                },
                {
                  label: "晨昏線",
                  value: terminator,
                  change: setTerminator,
                  color: "terminator",
                },
                {
                  label: "觀測緯圈",
                  value: parallel,
                  change: setParallel,
                  color: "latitude",
                },
                {
                  label: "地軸與極點",
                  value: axis,
                  change: setAxis,
                  color: "axis",
                },
              ].map((item) => (
                <label className="toggle-row" key={item.label}>
                  <span>
                    <i className={`layer-symbol ${item.color}`} />
                    {item.label}
                  </span>
                  <input
                    className="toggle-input"
                    type="checkbox"
                    checked={item.value}
                    onChange={(event) => item.change(event.target.checked)}
                  />
                  <span className="toggle-track" aria-hidden="true" />
                </label>
              ))}
            </section>
            <div className="control-tip">
              <Move3D size={17} />
              <p>
                拖曳旋轉視角
                <br />
                <span>滾輪或雙指縮放地球</span>
              </p>
            </div>
          </aside>

          {expanded && (
            <div
              className="scene-backdrop"
              onClick={() => setExpanded(false)}
              aria-hidden="true"
            />
          )}
          <section
            id="earth-scene"
            className={`scene-panel panel ${expanded ? "is-fullscreen" : ""}`}
            ref={scenePanel}
            aria-label="互動 3D 地球"
            role={expanded ? "dialog" : undefined}
            aria-modal={expanded ? true : undefined}
          >
            <div className="scene-top">
              <div>
                <span className="live-indicator" />
                <span>LIVE SIMULATION</span>
              </div>
              <button
                className={`icon-button ${expanded ? "scene-close-button" : ""}`}
                onClick={toggleFullscreen}
                title={expanded ? "關閉放大畫面" : "放大地球畫面"}
                aria-label={expanded ? "關閉放大畫面" : "放大地球畫面"}
                aria-expanded={expanded}
                aria-controls="earth-scene"
              >
                {expanded ? (
                  <>
                    <X size={16} />
                    <span>關閉放大畫面</span>
                    <kbd>Esc</kbd>
                  </>
                ) : (
                  <Maximize2 size={16} />
                )}
              </button>
            </div>
            <div className="scene-context">
              <h2>
                {season.label}
                <span>{season.date}</span>
              </h2>
              <p>{season.description}</p>
            </div>
            <div className="globe-canvas" data-testid="globe">
              {mountScene && (
                <SceneModuleBoundary onFailure={handleSceneSettled}>
                  <Suspense fallback={null}>
                    <EarthScene
                      resetToken={resetKey}
                      season={seasonId}
                      rotation={rotation}
                      latitude={latitude}
                      view={view}
                      showGrid={grid}
                      showTerminator={terminator}
                      showLatitude={parallel}
                      showAxis={axis}
                      onReady={handleSceneSettled}
                      onFailure={handleSceneSettled}
                    />
                  </Suspense>
                </SceneModuleBoundary>
              )}
            </div>
            {!ready && (
              <div className="scene-loading">
                <Orbit size={26} />
                <span>
                  {slowScene
                    ? "3D 載入較久；操作與分析仍可使用，或重新載入頁面。"
                    : "正在準備地球…"}
                </span>
              </div>
            )}
            <div className="scene-legend">
              <span>
                <i className="legend-line terminator" />
                晨昏線
              </span>
              <span>
                <i className="legend-line latitude" />
                觀測緯圈
              </span>
              <span className="model-scale">地球與光線非等比例</span>
            </div>
            <div className="rotation-controls">
              <div className="rotation-control-top">
                <span>
                  <Globe2 size={14} />
                  地球自轉 <span className="direction-tag">由西向東</span>
                </span>
                <div className="time-label">
                  120°E 地方太陽時{" "}
                  <strong data-testid="solar-time">{clockLabel}</strong>
                </div>
              </div>
              <div className="rotation-control-bottom">
                <button
                  className={`play-button ${playing ? "playing" : ""}`}
                  aria-label={playing ? "暫停自轉" : "開始自轉"}
                  onClick={() => setPlaying((value) => !value)}
                >
                  {playing ? (
                    <Pause size={17} fill="currentColor" />
                  ) : (
                    <Play size={17} fill="currentColor" />
                  )}
                </button>
                <div className="rotation-slider-wrap">
                  <input
                    type="range"
                    aria-label="自轉角度"
                    min="0"
                    max="360"
                    step="0.1"
                    value={rotation}
                    onChange={(event) =>
                      setRotation(Number(event.target.value))
                    }
                  />
                  <div className="rotation-ticks">
                    <span>0°</span>
                    <span>180°</span>
                    <span>360°</span>
                  </div>
                </div>
                <label className="speed-control">
                  <span className="sr-only">自轉速度</span>
                  <select
                    aria-label="自轉速度"
                    value={speed}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                  >
                    <option value={0.25}>0.25×</option>
                    <option value={1}>1×</option>
                    <option value={4}>4×</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <aside className="analysis-panel panel" aria-label="緯度分析">
            <div className="panel-heading">
              <span className="section-number">02</span>
              <h2>緯度分析</h2>
              <span className="data-dot" />
            </div>
            <div className="latitude-selector">
              <div className="field-heading">
                <h3>觀測位置</h3>
                <span>120°E</span>
              </div>
              <div className="latitude-value">
                <span>
                  {latitude === 0 ? "赤道" : latitude > 0 ? "北緯" : "南緯"}
                </span>
                <label>
                  <span className="sr-only">緯度數值</span>
                  <input
                    aria-label="緯度數值"
                    type="number"
                    min="-90"
                    max="90"
                    step="0.01"
                    value={latitude}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value))
                        setLatitude(Math.min(90, Math.max(-90, value)));
                    }}
                  />
                  <span>°</span>
                </label>
              </div>
              <input
                className="latitude-slider"
                type="range"
                aria-label="分析緯度"
                min="-90"
                max="90"
                step="0.01"
                value={latitude}
                onChange={(event) => setLatitude(Number(event.target.value))}
              />
              <div className="latitude-scale">
                <span>90°S</span>
                <span>赤道</span>
                <span>90°N</span>
              </div>
              <div className="latitude-presets">
                {[
                  { name: "赤道", value: 0 },
                  { name: "臺北附近", value: 25 },
                  { name: "北回歸線", value: OBLIQUITY },
                  { name: "北極圈", value: 90 - OBLIQUITY },
                ].map((item) => (
                  <button
                    className={
                      Math.abs(latitude - item.value) < 0.001 ? "active" : ""
                    }
                    key={item.name}
                    onClick={() => setLatitude(item.value)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="daylight-section">
              <div className="field-heading">
                <h3>理論晝夜長度</h3>
                <span className="unit-tag">24 H</span>
              </div>
              <div
                className={`daylight-ring ${polarEquinox ? "undefined-ring" : ""}`}
              >
                <svg viewBox="0 0 180 180" aria-hidden="true">
                  <circle className="ring-track" cx="90" cy="90" r="73" />
                  <circle
                    className="ring-day"
                    cx="90"
                    cy="90"
                    r="73"
                    pathLength="100"
                    strokeDasharray={`${polarEquinox ? 0 : (daylight / 24) * 100} 100`}
                    transform="rotate(-90 90 90)"
                  />
                </svg>
                <div className="ring-center">
                  <Sun size={19} />
                  <small>
                    {polarEquinox
                      ? "兩極分點特例"
                      : daylight === 24
                        ? "極晝"
                        : daylight === 0
                          ? "極夜"
                          : "白晝時間"}
                  </small>
                  <strong data-testid="day-length">
                    {polarEquinox ? "晝長未定" : formatHours(daylight)}
                  </strong>
                  <span>{latitudeLabel(latitude)}</span>
                </div>
              </div>
              <div className="day-night-values">
                <span>
                  <Sun size={13} />
                  白晝
                  <strong>{polarEquinox ? "—" : formatHours(daylight)}</strong>
                </span>
                <span>
                  <Moon size={13} />
                  黑夜
                  <strong>
                    {polarEquinox ? "—" : formatHours(24 - daylight)}
                  </strong>
                </span>
              </div>
            </div>
            <div className="altitude-values">
              <div>
                <span>正午太陽高度</span>
                <strong data-testid="noon-altitude">
                  {noonAltitude.toFixed(2)}
                  <small>°</small>
                </strong>
              </div>
              <div>
                <span>此刻太陽高度</span>
                <strong>
                  {altitude.toFixed(1)}
                  <small>°</small>
                  <i className={`altitude-status ${isDay ? "day" : ""}`}>
                    {isHorizon ? "地平線" : isDay ? "白晝" : "黑夜"}
                  </i>
                </strong>
              </div>
            </div>
            <div className="analysis-footnote">
              <Info size={12} />
              <span>理想球形地球，不含大氣折射</span>
            </div>
          </aside>
        </div>

        <section className="discovery-row" aria-label="觀察與原理">
          <div className="discovery-card">
            <div className="discovery-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <span className="micro-label">WHAT TO NOTICE</span>
              <h2>此刻，值得觀察的事</h2>
              <p data-testid="season-insight">{insight}</p>
            </div>
          </div>
          <button
            className="principle-card"
            onClick={() => dialog.current?.showModal()}
          >
            <div className="principle-diagram">
              <Sun size={22} />
              <span />
              <Globe2 size={28} />
            </div>
            <div>
              <small>想一想</small>
              <strong>為什麼夏天白晝比較長？</strong>
              <span>
                從晨昏線與緯圈找到答案 <ArrowUpRight size={13} />
              </span>
            </div>
            <ChevronRight size={17} />
          </button>
        </section>
        <footer>
          <span>
            <span className="footer-dot" />
            為理解而探索，讓科學看得見。
          </span>
          <button onClick={() => dialog.current?.showModal()}>
            模型假設與科學說明 <ArrowUpRight size={12} />
          </button>
          <span>
            EARTH & SEASONS LAB <span className="footer-year">© 2026</span>
          </span>
        </footer>
      </main>

      <dialog
        ref={dialog}
        className="science-dialog"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="dialog-top">
          <span>
            <BookOpen size={17} />
            模型與科學原理
          </span>
          <button
            className="icon-button"
            aria-label="關閉科學說明"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <div className="dialog-content">
          <div className="eyebrow">THE SCIENCE BEHIND THE SEASONS</div>
          <h2>四季，來自地軸的傾斜。</h2>
          <p>
            地軸與公轉軌道面的法線夾角約為
            23.44°。地球公轉時，直射緯度在南北回歸線間移動，同時改變各緯度的日照角度與晝長。南北半球的季節相反。
          </p>
          <div className="formula-card">
            <span>太陽赤緯</span>
            <code>sin δ = sin ε · sin λ☉</code>
            <small>
              ε：地軸傾角 23.44°；λ☉：太陽視黃經（春分 0°、夏至 90°、秋分
              180°、冬至 270°）
            </small>
          </div>
          <div className="formula-card">
            <span>太陽高度與理論晝長</span>
            <code>sin h = sin φ sin δ + cos φ cos δ cos H</code>
            <code>D = (24 / π) · arccos(−tan φ tan δ)</code>
            <small>
              φ：緯度；H：地方時角（正午為
              0°）；D：小時。反餘弦的結果以弧度代入，超出升落範圍時須另判定極晝與極夜。
            </small>
          </div>
          <h3>
            <Sun size={16} />
            晨昏線如何形成？
          </h3>
          <p>
            太陽光視為平行光。球面外法線 n 與指向太陽的單位向量 s 若滿足 n · s
            &gt; 0，該處為白晝；n · s = 0
            的大圓就是晨昏線。觀測緯圈落在日照區的比例，乘以 24
            小時，就是理論晝長。
          </p>
          <h3>
            <Axis3D size={16} />
            這個模型的邊界
          </h3>
          <ul>
            <li>
              理想球形地球、固定傾角、點狀太陽，不計大氣折射、太陽視半徑、地形與軌道離心率。
            </li>
            <li>
              節氣日期為常見近似值，每年與時區可能有差異；日期不是指定年份的星曆計算。
            </li>
            <li>
              畫面以地球參考座標呈現四個代表赤緯，將參考正午方向固定以便比較，並非完整公轉軌道動畫。
            </li>
            <li>
              自轉角度控制東經 120°
              觀測點的地方太陽時；它不是臺灣民用鐘錶時間，未納入均時差。
            </li>
            <li>
              極圈在至日時是極晝／極夜的相切邊界；兩極分點時太陽整日在地平線，晝長未定。計算核心的
              12 小時回傳值僅為對稱慣例，介面不將其視為一般晝長。
            </li>
          </ul>
          <div className="science-note">
            <Info size={16} />
            <p>
              實際觀測的日出、日落會受到大氣折射與太陽視半徑影響。因此，分點當天的實際白晝通常稍長於
              12 小時；此工具呈現的是幾何模型的理論值。
            </p>
          </div>
          <button
            className="dialog-done"
            onClick={() => dialog.current?.close()}
          >
            開始觀察 <ArrowDown size={15} />
          </button>
        </div>
      </dialog>
    </div>
  );
}
