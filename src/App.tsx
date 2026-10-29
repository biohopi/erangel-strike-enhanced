import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  Check,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Expand,
  Globe2,
  Headphones,
  HelpCircle,
  MapPin,
  Monitor,
  Radio,
  RotateCcw,
  Settings2,
  Shield,
  SlidersHorizontal,
  Target,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Brand, { Emblem } from "./components/Brand";
import Dialog from "./components/Dialog";
import Loadout from "./components/Loadout";
import Armory from "./components/Armory";
import TacticalMap from "./components/TacticalMap";
import {
  DEFAULT_INVENTORY,
  DEFAULT_SETTINGS,
  readSaved,
  type GameSettings,
  type Inventory,
} from "./game/data";

type Panel =
  "loadout" | "armory" | "guide" | "settings" | "map" | "profile" | null;
type Dropzone = "ERANGEL" | "TRAINING GROUNDS";

function App() {
  const [panel, setPanel] = useState<Panel>(null);
  const [inventory, setInventory] = useState<Inventory>(() =>
    readSaved("erangel-inventory-v1", DEFAULT_INVENTORY),
  );
  const [settings, setSettings] = useState<GameSettings>(() =>
    readSaved("erangel-settings-v1", DEFAULT_SETTINGS),
  );
  const [name, setName] = useState(() =>
    readSaved("erangel-player-name", "GHOST_01"),
  );
  const [nameDraft, setNameDraft] = useState(name);
  const [mode, setMode] = useState<"SOLO" | "SQUAD">("SOLO");
  const [dropzone, setDropzone] = useState<Dropzone>("ERANGEL");
  const [mapDraft, setMapDraft] = useState<Dropzone>("ERANGEL");
  const [playing, setPlaying] = useState(false);
  const [sessionMode, setSessionMode] = useState<"LOCAL" | "MULTIPLAYER">("LOCAL");
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState("");
  const [guideTab, setGuideTab] = useState<
    "MOVEMENT" | "COMBAT" | "LOOT & GEAR"
  >("MOVEMENT");
  const frame = useRef<HTMLIFrameElement>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sendToGame = useCallback(
    (data: Record<string, unknown>) =>
      frame.current?.contentWindow?.postMessage(
        { source: "erangel-lobby", ...data },
        location.origin,
      ),
    [],
  );
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(""), 3200);
  }, []);
  const closePanel = useCallback(() => {
    setPanel(null);
    if (playing) sendToGame({ type: "resume" });
  }, [playing, sendToGame]);
  const changeInventory = useCallback(
    (value: Inventory) => {
      setInventory(value);
      sendToGame({ type: "inventory", inventory: value });
    },
    [sendToGame],
  );

  useEffect(() => {
    localStorage.setItem("erangel-inventory-v1", JSON.stringify(inventory));
  }, [inventory]);
  useEffect(() => {
    localStorage.setItem("erangel-settings-v1", JSON.stringify(settings));
    sendToGame({ type: "settings", settings });
  }, [settings, sendToGame]);
  useEffect(() => {
    localStorage.setItem("erangel-player-name", JSON.stringify(name));
  }, [name]);
  useEffect(() => () => clearTimeout(toastTimeout.current), []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.source !== "erangel-game"
      )
        return;
      if (event.data.inventory) setInventory(event.data.inventory as Inventory);
      if (event.data.type === "ready") {
        setDeploying(false);
        if (sessionMode === "MULTIPLAYER") {
          sendToGame({ type: "room-mode", inventory, settings, name });
        } else {
          sendToGame({ type: "initialize", inventory, settings, mode, dropzone, name });
        }
      }
      if (event.data.type === "inventory-open") setPanel("loadout");
      if (event.data.type === "settings-open") setPanel("settings");
      if (event.data.type === "settings-sync")
        setSettings(event.data.settings as GameSettings);
      if (event.data.type === "return-lobby") {
        setPlaying(false);
        setDeploying(false);
        setPanel(null);
      }
      if (event.data.type === "error") {
        setDeploying(false);
        setPlaying(false);
        notify(
          event.data.message ||
            "Unable to start WebGL. Please try another browser.",
        );
      }
    };
    addEventListener("message", handler);
    return () => removeEventListener("message", handler);
  }, [inventory, settings, mode, dropzone, name, sessionMode, sendToGame, notify]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        playing ||
        panel ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          (event.target as HTMLElement).tagName,
        )
      )
        return;
      if (event.code === "KeyB") {
        event.preventDefault();
        setPanel("loadout");
      }
      if (event.key === "?") setPanel("guide");
      if (event.code === "KeyV")
        setSettings((previous) => ({
          ...previous,
          perspective: previous.perspective === "TPP" ? "FPP" : "TPP",
        }));
    };
    addEventListener("keydown", handleKey);
    return () => removeEventListener("keydown", handleKey);
  }, [playing, panel]);

  const openPanel = (value: Panel) => {
    if (value === "map") setMapDraft(dropzone);
    if (value === "profile") setNameDraft(name);
    setPanel(value);
    if (playing) sendToGame({ type: "pause" });
  };
  const deploy = () => {
    setSessionMode("LOCAL");
    setDeploying(true);
    setPlaying(true);
  };
  const openMultiplayer = () => {
    setSessionMode("MULTIPLAYER");
    setDeploying(true);
    setPlaying(true);
  };
  const leaveMatch = () => {
    sendToGame({ type: "stop" });
    setPlaying(false);
    setDeploying(false);
    setPanel(null);
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify("Fullscreen is not available in this browser.");
    }
  };

  return (
    <div className={`app ${playing ? "in-match" : ""}`}>
      {!playing && (
        <>
          <div className="lobby-scene" aria-hidden="true">
            <motion.img
              src="/images/erangel-lobby.jpg"
              alt=""
              initial={{ scale: 1.045, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                scale: { duration: 18, ease: "easeOut" },
                opacity: { duration: 1 },
              }}
            />
            <div className="scene-shade" />
            <div className="film-grain" />
          </div>
          <motion.header
            className="topbar"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <button
              className="brand-button"
              onClick={() => setPanel(null)}
              aria-label="Erangel Strike home"
            >
              <Brand />
            </button>
            <nav className="main-nav" aria-label="Main navigation">
              {(["PLAY", "LOADOUT", "ARMORY", "FIELD GUIDE"] as const).map(
                (label, index) => (
                  <button
                    key={label}
                    className={index === 0 ? "active" : ""}
                    onClick={() =>
                      index === 0
                        ? setPanel(null)
                        : openPanel(
                            index === 1
                              ? "loadout"
                              : index === 2
                                ? "armory"
                                : "guide",
                          )
                    }
                  >
                    {label}
                    {label === "LOADOUT" && <span className="nav-new-dot" />}
                  </button>
                ),
              )}
            </nav>
            <div className="header-tools">
              <button
                className="icon-button sound-button"
                aria-label={
                  settings.muted ? "Unmute game audio" : "Mute game audio"
                }
                onClick={() =>
                  setSettings({ ...settings, muted: !settings.muted })
                }
              >
                {settings.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button
                className="icon-button"
                aria-label="Open settings"
                onClick={() => openPanel("settings")}
              >
                <Settings2 size={19} />
              </button>
              <span className="header-divider" />
              <button
                className="player-button"
                onClick={() => openPanel("profile")}
              >
                <span className="player-avatar">
                  <Emblem />
                </span>
                <span>
                  <strong>{name}</strong>
                  <span>
                    LEVEL 01 <i />
                  </span>
                </span>
                <ChevronDown size={13} />
              </button>
            </div>
          </motion.header>
          <main className="lobby-main">
            <motion.div
              className="hero-copy"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: {
                  transition: { staggerChildren: 0.12, delayChildren: 0.22 },
                },
              }}
            >
              <motion.div
                className="hero-eyebrow"
                variants={{
                  hidden: { opacity: 0, x: -12 },
                  show: { opacity: 1, x: 0 },
                }}
              >
                <span /> THE ORIGINAL BATTLEGROUND
              </motion.div>
              <motion.h1
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.65 }}
              >
                ERANGEL<span>STRIKE</span>
              </motion.h1>
              <motion.div
                className="hero-description"
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <h2>EVERY DROP. A NEW STORY.</h2>
                <p>
                  Gear up. Trust your instincts.
                  <br />
                  Be the last one standing.
                </p>
              </motion.div>
              <motion.button
                className="loadout-link"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                onClick={() => openPanel("loadout")}
              >
                <Backpack size={17} />
                <span>PREPARE YOUR LOADOUT</span>
                <ArrowRight size={16} />
              </motion.button>
            </motion.div>
            <div className="ambient-dust" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <i
                  key={index}
                  style={{
                    left: `${36 + index * 10}%`,
                    animationDelay: `${index * -2.7}s`,
                    animationDuration: `${12 + index * 3}s`,
                  }}
                />
              ))}
            </div>
            <motion.div
              className="match-dock"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.65 }}
            >
              <button
                className="map-selection"
                onClick={() => openPanel("map")}
              >
                <div className="map-thumbnail">
                  <TacticalMap />
                  <span className="map-pin">
                    <MapPin size={15} />
                  </span>
                </div>
                <div>
                  <span className="field-label">SELECTED MAP</span>
                  <strong>{dropzone}</strong>
                  <span className="map-subtitle">
                    {dropzone === "ERANGEL"
                      ? "The classic battleground"
                      : "Hone your instincts"}
                  </span>
                </div>
                <ChevronDown size={17} />
              </button>
              <div className="match-options">
                <div className="mode-heading">
                  <span className="field-label">GAME MODE</span>
                  <span className="local-match">
                    <span /> LOCAL MATCH
                  </span>
                </div>
                <div className="mode-controls">
                  <span className="battle-royale">
                    {dropzone === "ERANGEL" ? "BATTLE ROYALE" : "TRAINING"}
                  </span>
                  <div className="mode-segment" aria-label="Team mode">
                    {(["SOLO", "SQUAD"] as const).map((value) => (
                      <button
                        key={value}
                        className={mode === value ? "selected" : ""}
                        onClick={() => setMode(value)}
                        title={
                          value === "SOLO"
                            ? "Survive against 18 AI opponents"
                            : "Join 3 AI teammates against 16 opponents"
                        }
                      >
                        {value === "SOLO" ? (
                          <UserRound size={12} />
                        ) : (
                          <UsersRound size={13} />
                        )}
                        {value}
                      </button>
                    ))}
                  </div>
                  <div
                    className="perspective-segment"
                    aria-label="Camera perspective"
                  >
                    {(["TPP", "FPP"] as const).map((value) => (
                      <button
                        key={value}
                        aria-pressed={settings.perspective === value}
                        className={
                          settings.perspective === value ? "selected" : ""
                        }
                        onClick={() =>
                          setSettings({ ...settings, perspective: value })
                        }
                        title={
                          value === "TPP"
                            ? "Third-person perspective"
                            : "First-person perspective"
                        }
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="deploy-group">
                <button className="deploy-button" onClick={deploy}>
                  <span className="deploy-icon">
                    <Crosshair size={23} />
                  </span>
                  <span>DEPLOY</span>
                  <ArrowRight size={24} />
                </button>
                <span className="deploy-caption">
                  {dropzone === "TRAINING GROUNDS"
                    ? "YOUR OWN PACE. NO OPPONENTS."
                    : mode === "SOLO"
                      ? "ONE ISLAND. ONE SURVIVOR."
                      : "DROP TOGETHER. SURVIVE TOGETHER."}
                </span>
                <button className="multiplayer-button" onClick={openMultiplayer}>
                  <UsersRound size={17} /> ONLINE ROOM <ArrowRight size={17} />
                </button>
              </div>
            </motion.div>
          </main>
          <footer className="lobby-footer">
            <div className="system-status">
              <span /> SYSTEMS READY <i /> <Globe2 size={12} />{" "}
              {dropzone === "TRAINING GROUNDS"
                ? "PRACTICE RANGE"
                : "ERANGEL REGION"}
            </div>
            <div className="keyboard-shortcuts">
              <button onClick={() => openPanel("loadout")}>
                <kbd>B</kbd> BACKPACK
              </button>
              <button onClick={() => openPanel("guide")}>
                <kbd>?</kbd> CONTROLS
              </button>
              <button onClick={fullscreen}>
                <Expand size={12} /> FULLSCREEN
              </button>
            </div>
            <span className="build-version">
              EARLY ACCESS <span>V.0.9.4</span>
            </span>
          </footer>
        </>
      )}
      {playing && (
        <div className="game-shell">
          <header className="game-topbar">
            <Brand compact />
            <span className="game-session">
              <Radio size={13} /> {dropzone} / {mode} / {sessionMode === "MULTIPLAYER" ? "ONLINE ROOM" : "LOCAL SESSION"}
            </span>
            <div>
              <button
                className="text-button"
                onClick={() => openPanel("loadout")}
              >
                <Backpack size={16} /> BACKPACK
              </button>
              <button
                className="icon-button"
                aria-label="Match settings"
                onClick={() => openPanel("settings")}
              >
                <Settings2 size={18} />
              </button>
              <button className="return-lobby" onClick={leaveMatch}>
                <ArrowLeft size={15} /> RETURN TO LOBBY
              </button>
            </div>
          </header>
          <iframe
            ref={frame}
            className="game-frame"
            title="Erangel Strike playable battleground"
            src="/game/index.html"
            allow="autoplay; fullscreen"
          />
          {deploying && (
            <div className="deployment-screen">
              <Emblem />
              <span className="eyebrow">ESTABLISHING DROPZONE</span>
              <h2>
                WELCOME TO {dropzone === "ERANGEL" ? "ERANGEL" : "THE RANGE"}.
              </h2>
              <div className="deployment-progress">
                <i />
              </div>
              <p>Preparing terrain, equipment, and your next story.</p>
              <button className="text-button" onClick={leaveMatch}>
                CANCEL DEPLOYMENT
              </button>
            </div>
          )}
        </div>
      )}
      <AnimatePresence>
        {panel && (
          <Dialog
            key="main-panel"
            label={
              panel === "loadout"
                ? "Your loadout and backpack"
                : panel === "armory"
                  ? "Weapon armory"
                  : panel === "guide"
                    ? "Field guide and controls"
                    : panel === "settings"
                      ? "Game settings"
                      : panel === "map"
                        ? "Choose your dropzone"
                        : "Operative profile"
            }
            onClose={closePanel}
            className={`dialog-${panel}`}
          >
            {panel === "loadout" && (
              <Loadout
                inventory={inventory}
                onChange={changeInventory}
                onClose={closePanel}
              />
            )}
            {panel === "armory" && (
              <Armory
                inventory={inventory}
                onChange={changeInventory}
                onClose={closePanel}
                onLoadout={() => setPanel("loadout")}
              />
            )}
            {panel === "settings" && (
              <section className="settings-content">
                <PanelHeading
                  eyebrow="MAKE IT YOURS"
                  title="SETTINGS"
                  description="Fine-tune your field experience."
                  onClose={closePanel}
                />
                <div className="settings-section">
                  <h3>
                    <Headphones size={17} /> AUDIO
                  </h3>
                  <label className="range-setting">
                    <span>
                      Master volume
                      <small>
                        Only active, nearby shooters produce gunfire.
                      </small>
                    </span>
                    <input
                      aria-label="Master volume"
                      type="range"
                      min="0"
                      max="100"
                      value={settings.volume}
                      onChange={(e) =>
                        setSettings({ ...settings, volume: +e.target.value })
                      }
                    />
                    <b>{settings.volume}%</b>
                  </label>
                  <label className="toggle-setting">
                    <span>Mute all audio</span>
                    <input
                      type="checkbox"
                      checked={settings.muted}
                      onChange={(e) =>
                        setSettings({ ...settings, muted: e.target.checked })
                      }
                    />
                    <span className="toggle-track" />
                  </label>
                </div>
                <div className="settings-section">
                  <h3>
                    <SlidersHorizontal size={17} /> CONTROLS
                  </h3>
                  <label className="range-setting">
                    <span>
                      Mouse sensitivity
                      <small>Precision starts with the right feel.</small>
                    </span>
                    <input
                      aria-label="Mouse sensitivity"
                      type="range"
                      min="10"
                      max="100"
                      value={settings.sensitivity}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          sensitivity: +e.target.value,
                        })
                      }
                    />
                    <b>{settings.sensitivity}%</b>
                  </label>
                  <div className="toggle-setting">
                    <span>Default perspective</span>
                    <div className="perspective-segment">
                      {(["TPP", "FPP"] as const).map((value) => (
                        <button
                          key={value}
                          className={
                            settings.perspective === value ? "selected" : ""
                          }
                          onClick={() =>
                            setSettings({ ...settings, perspective: value })
                          }
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="settings-section">
                  <h3>
                    <Monitor size={17} /> GRAPHICS
                  </h3>
                  <label className="toggle-setting">
                    <span>
                      Dynamic shadows
                      <small>Disable for smoother play on older devices.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.shadows}
                      onChange={(e) =>
                        setSettings({ ...settings, shadows: e.target.checked })
                      }
                    />
                    <span className="toggle-track" />
                  </label>
                </div>
                <div className="panel-footer">
                  <button
                    className="text-button"
                    onClick={() => setSettings({ ...DEFAULT_SETTINGS })}
                  >
                    <RotateCcw size={14} /> RESTORE DEFAULTS
                  </button>
                  <button className="amber-button small" onClick={closePanel}>
                    SAVE & CLOSE <Check size={16} />
                  </button>
                </div>
              </section>
            )}
            {panel === "map" && (
              <section className="map-content">
                <PanelHeading
                  eyebrow="PICK YOUR BATTLEGROUND"
                  title="THE DROPZONE"
                  description="Every place has a story. Make this one yours."
                  onClose={closePanel}
                />
                <div className="dropzone-layout">
                  <div className="large-map">
                    <TacticalMap large />
                    <span>
                      <MapPin size={14} />{" "}
                      {mapDraft === "ERANGEL"
                        ? "ERANGEL ISLAND"
                        : "ISOLATED TRAINING SECTOR"}
                    </span>
                  </div>
                  <div className="dropzone-choices">
                    {(["ERANGEL", "TRAINING GROUNDS"] as const).map((value) => (
                      <button
                        className={mapDraft === value ? "selected" : ""}
                        key={value}
                        onClick={() => setMapDraft(value)}
                      >
                        {value === "ERANGEL" ? (
                          <Globe2 size={23} />
                        ) : (
                          <Target size={23} />
                        )}
                        <div>
                          <h3>{value}</h3>
                          <p>
                            {value === "ERANGEL"
                              ? "An open-world fight for survival. Explore towns, find your gear, and outlast the zone."
                              : "No enemies. No pressure. Test weapons, explore buildings, and perfect your aim."}
                          </p>
                          <span>
                            {value === "ERANGEL"
                              ? "180+ BUILDINGS / DYNAMIC ZONE"
                              : "ALL WEAPONS / FREE EXPLORATION"}
                          </span>
                        </div>
                        {mapDraft === value && <Check size={18} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="panel-footer">
                  <span>
                    <Shield size={14} /> PLAYABLE LOCALLY. NO ACCOUNT NEEDED.
                  </span>
                  <button
                    className="amber-button small"
                    onClick={() => {
                      setDropzone(mapDraft);
                      closePanel();
                    }}
                  >
                    CONFIRM DROPZONE <ArrowRight size={17} />
                  </button>
                </div>
              </section>
            )}
            {panel === "guide" && (
              <section className="guide-content">
                <PanelHeading
                  eyebrow="KNOW THE BATTLEGROUND"
                  title="FIELD GUIDE"
                  description="A little preparation goes a long way."
                  onClose={closePanel}
                />
                <div className="guide-tabs">
                  {(["MOVEMENT", "COMBAT", "LOOT & GEAR"] as const).map(
                    (tab) => (
                      <button
                        className={guideTab === tab ? "selected" : ""}
                        onClick={() => setGuideTab(tab)}
                        key={tab}
                      >
                        {tab}
                      </button>
                    ),
                  )}
                </div>
                <div className="controls-list">
                  {(guideTab === "MOVEMENT"
                    ? [
                        [
                          "W A S D",
                          "Move",
                          "Navigate the island and explore buildings.",
                        ],
                        [
                          "MOUSE",
                          "Look around",
                          "Click the game to capture your cursor. Press Escape to release.",
                        ],
                        [
                          "SHIFT",
                          "Sprint",
                          "Hold while moving forward to pick up speed.",
                        ],
                        [
                          "SPACE",
                          "Jump",
                          "Clear obstacles and reach new ground.",
                        ],
                        [
                          "C",
                          "Crouch",
                          "Lower your profile and steady your aim.",
                        ],
                        [
                          "V",
                          "Change perspective",
                          "Switch between first-person and third-person views.",
                        ],
                      ]
                    : guideTab === "COMBAT"
                      ? [
                          [
                            "LMB",
                            "Fire weapon",
                            "Hold for automatic fire on compatible weapons.",
                          ],
                          [
                            "RMB",
                            "Aim down sights",
                            "Look through your equipped optic with real magnification.",
                          ],
                          [
                            "R",
                            "Reload",
                            "Refill your magazine from backpack ammunition.",
                          ],
                          [
                            "1 / 2",
                            "Select main weapon",
                            "Switch only between your two equipped main weapons.",
                          ],
                          [
                            "Q",
                            "Quick switch",
                            "Cycle between your primary and secondary weapons.",
                          ],
                          [
                            "H",
                            "First aid",
                            "Use a first aid kit to restore 50 health.",
                          ],
                        ]
                      : [
                          [
                            "F",
                            "Pick up loot",
                            "Collect weapons, scopes, ammunition, and first aid.",
                          ],
                          [
                            "B / TAB",
                            "Open backpack",
                            "Keep as many weapons as you can find. No capacity limit.",
                          ],
                          [
                            "1 / 2",
                            "Equip from backpack",
                            "Use the slot buttons in your backpack to assign main weapons.",
                          ],
                          [
                            "OPTICS",
                            "Attach a scope",
                            "Choose any looted optic from the weapon scope selector.",
                          ],
                          [
                            "AUTO",
                            "Ammo & first aid",
                            "Small supplies are collected automatically when you walk over them.",
                          ],
                          [
                            "ESC",
                            "Release cursor",
                            "Open your backpack or use the on-screen pause button.",
                          ],
                        ]
                  ).map(([key, title, desc]) => (
                    <div className="control-row" key={title}>
                      <kbd>{key}</kbd>
                      <div>
                        <h3>{title}</h3>
                        <p>{desc}</p>
                      </div>
                      <ChevronRight size={15} />
                    </div>
                  ))}
                </div>
                <div className="guide-tip">
                  <HelpCircle size={19} />
                  <p>
                    {guideTab === "LOOT & GEAR"
                      ? "Found something better? Your old main weapon is safely returned to your backpack when you replace it."
                      : guideTab === "COMBAT"
                        ? "Gunfire is positional. Listen carefully: every shot comes from a real, active combatant in your match."
                        : "Two- and three-story buildings have open doorways, interior stairs, and loot on every floor."}
                  </p>
                </div>
              </section>
            )}
            {panel === "profile" && (
              <section className="profile-content">
                <PanelHeading
                  eyebrow="YOUR FIELD IDENTITY"
                  title="OPERATIVE"
                  description="A name the battleground will remember."
                  onClose={closePanel}
                />
                <div className="profile-emblem">
                  <Emblem />
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = nameDraft
                      .trim()
                      .replace(/[^a-zA-Z0-9_]/g, "")
                      .slice(0, 16);
                    if (value) {
                      setName(value);
                      closePanel();
                      notify("Operative identity updated.");
                    }
                  }}
                >
                  <label className="profile-name">
                    CALLSIGN
                    <input
                      autoComplete="off"
                      value={nameDraft}
                      maxLength={16}
                      onChange={(event) => setNameDraft(event.target.value)}
                      required
                      pattern="[a-zA-Z0-9_]+"
                      aria-label="Operative callsign"
                    />
                  </label>
                  <p className="profile-hint">
                    Up to 16 letters, numbers, or underscores.
                  </p>
                  <button className="amber-button" type="submit">
                    SAVE CALLSIGN <Check size={17} />
                  </button>
                </form>
              </section>
            )}
          </Dialog>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <Check size={16} />
            {toast}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  description,
  onClose,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="panel-heading">
      <div>
        <span className="eyebrow">
          <span className="tiny-line" /> {eyebrow}
        </span>
        <h2>
          {title}
          <span className="heading-dot">.</span>
        </h2>
        <p>{description}</p>
      </div>
      <button
        className="icon-button close-button"
        aria-label={`Close ${title.toLowerCase()}`}
        onClick={onClose}
      >
        <X size={22} />
      </button>
    </div>
  );
}

export default App;
