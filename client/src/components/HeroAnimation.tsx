import { useEffect, useRef, useState } from "react";

interface TimelineStep {
  time: number;
  action: () => void;
}

export default function HeroAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const stage = stageRef.current;
    if (!container || !stage) return;

    let animationFrame: number;
    let startTime = 0;
    let stepIndex = 0;
    let playing = false;
    const duration = 17800;

    const $ = (selector: string) => stage.querySelector(selector);
    const $$ = (selector: string) => stage.querySelectorAll(selector);

    // Camera state
    let currentScale = 1;
    let currentX = 0;
    let currentY = 0;

    // Smooth camera movement - uneingeschränkt
    const setCamera = (x: number, y: number, scale: number) => {
      currentX = x;
      currentY = y;
      currentScale = scale;
      
      // Translation: positive x = nach rechts schauen, positive y = nach unten schauen
      const tx = -x;
      const ty = -y;
      
      stage.style.transition = "transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)";
      stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    };

    const click = () => {
      const cursor = $(".ha-cursor") as HTMLElement;
      if (cursor) {
        cursor.classList.add("click");
        setTimeout(() => cursor.classList.remove("click"), 250);
      }
    };

    const moveTo = (selector: string) => {
      const el = $(selector) as HTMLElement;
      const cursor = $(".ha-cursor") as HTMLElement;
      if (!el || !cursor) return;
      
      const stageRect = stage.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      
      // Calculate position relative to stage (accounting for current transform)
      const x = (elRect.left - stageRect.left) / currentScale + elRect.width / 2 / currentScale;
      const y = (elRect.top - stageRect.top) / currentScale + elRect.height / 2 / currentScale;
      
      cursor.style.transition = "left 0.8s cubic-bezier(0.4,0,0.2,1), top 0.8s cubic-bezier(0.4,0,0.2,1)";
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    };

    const typeIn = (selector: string, targetWidth: number) => {
      const el = $(selector) as HTMLElement;
      if (!el) return;
      let w = 0;
      const interval = setInterval(() => {
        w += 4;
        el.style.width = `${w}%`;
        if (w >= targetWidth) clearInterval(interval);
      }, 40);
    };

    const timeline: TimelineStep[] = [
      // Start: Übersicht - Cursor kommt von links rein
      { time: 0, action: () => setCamera(0, 0, 1) },
      { time: 50, action: () => {
        const cursor = $(".ha-cursor") as HTMLElement;
        if (cursor) {
          cursor.classList.add("show");
          cursor.style.transition = "left 0.6s cubic-bezier(0.4,0,0.2,1), top 0.6s cubic-bezier(0.4,0,0.2,1)";
          cursor.style.left = "80px";
          cursor.style.top = "100px";
        }
      }},
      
      // Navigation aktivieren - Zoom auf Sidebar
      { time: 500, action: () => setCamera(-30, -20, 1.15) },
      { time: 600, action: () => moveTo(".ha-nav-item:nth-child(2)") },
      { time: 1200, action: () => click() },
      { time: 1300, action: () => {
        $$(".ha-nav-item").forEach(e => e.classList.remove("active"));
        ($(".ha-nav-item:nth-child(2)") as HTMLElement)?.classList.add("active");
      }},
      
      // Header und Panel einblenden
      { time: 1500, action: () => setCamera(20, 0, 1.05) },
      { time: 1600, action: () => ($(".ha-header") as HTMLElement)?.classList.add("show") },
      { time: 1900, action: () => ($(".ha-tabs") as HTMLElement)?.classList.add("show") },
      { time: 2200, action: () => ($(".ha-panel") as HTMLElement)?.classList.add("show") },
      
      // Tab aktivieren
      { time: 2500, action: () => setCamera(25, -10, 1.12) },
      { time: 2600, action: () => moveTo(".ha-tab:first-child") },
      { time: 3200, action: () => click() },
      { time: 3300, action: () => {
        $$(".ha-tab").forEach(e => e.classList.remove("active"));
        ($(".ha-tab:first-child") as HTMLElement)?.classList.add("active");
        ($(".ha-panel") as HTMLElement)?.classList.add("active");
      }},
      
      // Mode Button
      { time: 3600, action: () => setCamera(40, -5, 1.18) },
      { time: 3700, action: () => moveTo(".ha-mode-btn:first-child") },
      { time: 4300, action: () => click() },
      { time: 4400, action: () => {
        $$(".ha-mode-btn").forEach(e => e.classList.remove("active"));
        ($(".ha-mode-btn:first-child") as HTMLElement)?.classList.add("active");
      }},
      
      // Input-Feld
      { time: 4700, action: () => setCamera(25, 15, 1.15) },
      { time: 4800, action: () => moveTo(".ha-field-input") },
      { time: 5400, action: () => click() },
      { time: 5500, action: () => ($(".ha-field-input") as HTMLElement)?.classList.add("focus") },
      { time: 5700, action: () => typeIn(".ha-field-bar", 80) },
      
      // Toggle - Kamera folgt nach unten
      { time: 6700, action: () => setCamera(20, 40, 1.12) },
      { time: 6800, action: () => moveTo(".ha-toggle") },
      { time: 7100, action: () => click() },
      { time: 7200, action: () => ($(".ha-toggle") as HTMLElement)?.classList.add("active") },
      
      // Search Button
      { time: 7400, action: () => setCamera(35, 45, 1.18) },
      { time: 7500, action: () => moveTo(".ha-search-btn") },
      { time: 7900, action: () => ($(".ha-search-btn") as HTMLElement)?.classList.add("hover") },
      { time: 8200, action: () => click() },
      { time: 8300, action: () => {
        const btn = $(".ha-search-btn") as HTMLElement;
        btn?.classList.add("click");
        setTimeout(() => btn?.classList.remove("click"), 200);
      }},
      { time: 8500, action: () => ($(".ha-search-btn") as HTMLElement)?.classList.add("load") },
      
      // Tabelle erscheint - Kamera scrollt smooth nach unten zur Tabelle
      { time: 9100, action: () => setCamera(20, 120, 1.0) },
      { time: 9300, action: () => ($(".ha-search-btn") as HTMLElement)?.classList.remove("load") },
      { time: 9600, action: () => ($(".ha-results") as HTMLElement)?.classList.add("show") },
      
      // Rows einblenden - Kamera bleibt auf Tabelle fokussiert
      { time: 10000, action: () => ($(".ha-row:nth-child(1)") as HTMLElement)?.classList.add("show") },
      { time: 10300, action: () => ($(".ha-row:nth-child(2)") as HTMLElement)?.classList.add("show") },
      { time: 10600, action: () => ($(".ha-row:nth-child(3)") as HTMLElement)?.classList.add("show") },
      
      // Cursor hovert über Rows - Kamera folgt dem Cursor smooth nach unten
      { time: 10800, action: () => setCamera(20, 140, 1.1) },
      { time: 11000, action: () => moveTo(".ha-row:nth-child(1)") },
      { time: 11400, action: () => ($(".ha-row:nth-child(1)") as HTMLElement)?.classList.add("hl") },
      
      { time: 11800, action: () => setCamera(20, 160, 1.1) },
      { time: 12000, action: () => moveTo(".ha-row:nth-child(2)") },
      { time: 12300, action: () => {
        ($(".ha-row:nth-child(2)") as HTMLElement)?.classList.add("hl");
        ($(".ha-row:nth-child(1)") as HTMLElement)?.classList.remove("hl");
      }},
      
      { time: 12700, action: () => setCamera(20, 180, 1.1) },
      { time: 12900, action: () => moveTo(".ha-row:nth-child(3)") },
      { time: 13200, action: () => {
        ($(".ha-row:nth-child(3)") as HTMLElement)?.classList.add("hl");
        ($(".ha-row:nth-child(2)") as HTMLElement)?.classList.remove("hl");
      }},
      
      // Zurück nach oben - Cursor bewegt sich zum linken Nav-Item
      { time: 13900, action: () => setCamera(-30, -20, 1.15) },
      { time: 14100, action: () => moveTo(".ha-nav-item:nth-child(3)") },
      { time: 14600, action: () => click() },
      { time: 14700, action: () => {
        // Neuen Nav-Item aktivieren
        $$(".ha-nav-item").forEach(e => e.classList.remove("active"));
        ($(".ha-nav-item:nth-child(3)") as HTMLElement)?.classList.add("active");
        // Alles ausblenden
        ($(".ha-results") as HTMLElement)?.classList.remove("show");
        $$(".ha-row").forEach(e => e.classList.remove("show", "hl"));
      }},
      
      // Panel und Tabs verschwinden
      { time: 15200, action: () => {
        ($(".ha-panel") as HTMLElement)?.classList.remove("show", "active");
        ($(".ha-tabs") as HTMLElement)?.classList.remove("show");
      }},
      { time: 15600, action: () => ($(".ha-header") as HTMLElement)?.classList.remove("show") },
      
      // Reset für Loop
      { time: 16200, action: () => setCamera(0, 0, 1) },
      { time: 16400, action: () => ($(".ha-cursor") as HTMLElement)?.classList.remove("show") },
      { time: 17000, action: () => $$(".ha-nav-item").forEach(e => e.classList.remove("active")) },
      { time: 17300, action: () => {
        // Reset alle States für sauberen Loop
        $$(".ha-tab").forEach(e => e.classList.remove("active"));
        $$(".ha-mode-btn").forEach(e => e.classList.remove("active"));
        ($(".ha-toggle") as HTMLElement)?.classList.remove("active");
        ($(".ha-search-btn") as HTMLElement)?.classList.remove("hover", "load");
        ($(".ha-field-input") as HTMLElement)?.classList.remove("focus");
        const bar = $(".ha-field-bar") as HTMLElement;
        if (bar) bar.style.width = "0%";
      }},
    ];

    const reset = () => {
      const cursor = $(".ha-cursor") as HTMLElement;
      if (cursor) {
        cursor.classList.remove("show", "click");
        cursor.style.left = "-40px";
        cursor.style.top = "120px";
        cursor.style.transition = "none";
      }
      
      // Reset camera
      stage.style.transition = "none";
      stage.style.transform = "translate(0, 0) scale(1)";
      currentScale = 1;
      currentX = 0;
      currentY = 0;
      
      $$(".ha-nav-item").forEach(e => e.classList.remove("active"));
      ($(".ha-header") as HTMLElement)?.classList.remove("show");
      ($(".ha-tabs") as HTMLElement)?.classList.remove("show");
      ($(".ha-panel") as HTMLElement)?.classList.remove("show", "active");
      $$(".ha-tab").forEach(e => e.classList.remove("active"));
      $$(".ha-mode-btn").forEach(e => e.classList.remove("active", "click"));
      ($(".ha-field-input") as HTMLElement)?.classList.remove("focus");
      const fieldBar = $(".ha-field-bar") as HTMLElement;
      if (fieldBar) fieldBar.style.width = "0%";
      ($(".ha-toggle") as HTMLElement)?.classList.remove("active");
      ($(".ha-search-btn") as HTMLElement)?.classList.remove("hover", "click", "load");
      ($(".ha-results") as HTMLElement)?.classList.remove("show");
      $$(".ha-row").forEach(e => e.classList.remove("show", "hl"));
    };

    const tick = () => {
      if (!playing) return;
      
      const elapsed = Date.now() - startTime;
      
      while (stepIndex < timeline.length && timeline[stepIndex].time <= elapsed) {
        timeline[stepIndex].action();
        stepIndex++;
      }
      
      if (elapsed < duration) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        playing = false;
        setTimeout(play, 600);
      }
    };

    const play = () => {
      if (playing) return;
      playing = true;
      startTime = Date.now();
      stepIndex = 0;
      reset();
      
      requestAnimationFrame(() => {
        const cursor = $(".ha-cursor") as HTMLElement;
        if (cursor) cursor.style.transition = "";
        stage.style.transition = "";
        tick();
      });
    };

    // Start animation
    const timeout = setTimeout(play, 800);
    setIsPlaying(true);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animationFrame);
      playing = false;
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="ha-container"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "580px",
        aspectRatio: "4/3",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 30px 100px rgba(0,0,0,0.5), 0 15px 40px rgba(0,0,0,0.3), 0 0 60px rgba(23,195,206,0.1)",
        border: "1px solid rgba(255,255,255,0.1)",
        animation: "ha-fadeIn 1s ease-out 0.5s both",
        background: "#050d18",
      }}
    >
      {/* Stage - viel größer als Container für freie Kamera-Bewegung */}
      <div
        ref={stageRef}
        className="ha-stage"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "150%",
          height: "280%",
          background: "linear-gradient(135deg, #0c2443 0%, #050d18 100%)",
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
      {/* Sidebar */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "13%",
        height: "36%",
        background: "rgba(8,16,28,0.98)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        padding: "8px 5px",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "24px",
          padding: "6px 8px",
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            background: "linear-gradient(135deg, #17c3ce, #c8fa64)",
            borderRadius: "6px",
          }} />
          <div style={{
            height: "8px",
            width: "50px",
            background: "rgba(255,255,255,0.85)",
            borderRadius: "3px",
          }} />
        </div>
        
        {/* Nav Items */}
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i}
            className="ha-nav-item"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 10px",
              marginBottom: "4px",
              borderRadius: "8px",
              transition: "all 0.4s ease",
            }}
          >
            <div className="ha-nav-icon" style={{
              width: "14px",
              height: "14px",
              background: "rgba(255,255,255,0.25)",
              borderRadius: "4px",
              transition: "all 0.4s ease",
            }} />
            <div className="ha-nav-text" style={{
              height: "7px",
              width: "45px",
              background: "rgba(255,255,255,0.25)",
              borderRadius: "3px",
              transition: "all 0.4s ease",
            }} />
          </div>
        ))}
      </div>

      {/* Main Content - volle Höhe der Stage für Tabellen */}
      <div style={{
        position: "absolute",
        left: "13%",
        top: 0,
        width: "55%",
        height: "100%",
        padding: "6px 10px",
      }}>
        {/* Header */}
        <div className="ha-header" style={{
          marginBottom: "16px",
          opacity: 0,
          transform: "translateY(-15px)",
          transition: "all 0.5s ease",
        }}>
          <div style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#fff",
            marginBottom: "6px",
            fontFamily: "inherit",
          }}>Datenboost</div>
          <div style={{
            height: "8px",
            width: "180px",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "3px",
          }} />
        </div>

        {/* Tabs */}
        <div className="ha-tabs" style={{
          display: "flex",
          gap: "6px",
          marginBottom: "16px",
          background: "rgba(0,0,0,0.4)",
          padding: "4px",
          borderRadius: "10px",
          width: "fit-content",
          opacity: 0,
          transform: "translateY(-15px)",
          transition: "all 0.5s ease 0.1s",
        }}>
          {[1, 2].map((i) => (
            <div 
              key={i}
              className="ha-tab"
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.4s ease",
              }}
            >
              <div style={{
                width: "12px",
                height: "12px",
                background: "rgba(255,255,255,0.4)",
                borderRadius: "3px",
                position: "relative",
                zIndex: 1,
              }} />
              <div style={{
                height: "7px",
                width: "35px",
                background: "rgba(255,255,255,0.4)",
                borderRadius: "3px",
                position: "relative",
                zIndex: 1,
              }} />
            </div>
          ))}
        </div>

        {/* Panel - kompakter */}
        <div className="ha-panel" style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "10px 12px",
          position: "relative",
          opacity: 0,
          transform: "translateY(15px)",
          transition: "all 0.6s ease 0.2s",
          flex: "0 0 auto",
        }}>
          {/* Top accent line */}
          <div className="ha-panel-accent" style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "linear-gradient(90deg, #17c3ce, #c8fa64)",
            transform: "scaleX(0)",
            transformOrigin: "left",
            transition: "transform 0.5s ease",
          }} />

          {/* Mode Toggle */}
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "6px",
            marginBottom: "14px",
          }}>
            {[1, 2].map((i) => (
              <div 
                key={i}
                className="ha-mode-btn"
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  transition: "all 0.4s ease",
                }}
              >
                <div style={{
                  width: "10px",
                  height: "10px",
                  background: "rgba(255,255,255,0.5)",
                  borderRadius: "3px",
                }} />
                <div style={{
                  height: "6px",
                  width: "28px",
                  background: "rgba(255,255,255,0.5)",
                  borderRadius: "2px",
                }} />
              </div>
            ))}
          </div>

          {/* Input Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "14px",
            padding: "12px",
            background: "rgba(0,0,0,0.35)",
            borderRadius: "10px",
          }}>
            <div style={{
              width: "32px",
              height: "32px",
              background: "linear-gradient(135deg, #c8fa64, #84cc16)",
              borderRadius: "8px",
              boxShadow: "0 3px 12px rgba(200,250,100,0.3)",
            }} />
            <div>
              <div style={{
                height: "8px",
                width: "120px",
                background: "rgba(255,255,255,0.9)",
                borderRadius: "3px",
                marginBottom: "5px",
              }} />
              <div style={{
                height: "6px",
                width: "160px",
                background: "rgba(255,255,255,0.3)",
                borderRadius: "2px",
              }} />
            </div>
          </div>

          {/* Form Field */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{
              height: "6px",
              width: "70px",
              background: "rgba(255,255,255,0.5)",
              borderRadius: "3px",
              marginBottom: "8px",
            }} />
            <div 
              className="ha-field-input"
              style={{
                height: "36px",
                background: "rgba(0,0,0,0.45)",
                border: "2px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                transition: "all 0.4s ease",
              }}
            >
              <div 
                className="ha-field-bar"
                style={{
                  height: "8px",
                  width: "0%",
                  background: "#fff",
                  borderRadius: "3px",
                  transition: "width 0.05s linear",
                }}
              />
              <div className="ha-field-cursor" style={{
                width: "2px",
                height: "14px",
                background: "#17c3ce",
                marginLeft: "3px",
                opacity: 0,
                animation: "ha-blink 0.8s infinite",
              }} />
            </div>
          </div>

          {/* Options Row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "14px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <div style={{
                height: "6px",
                width: "35px",
                background: "rgba(255,255,255,0.4)",
                borderRadius: "3px",
              }} />
              <div 
                className="ha-toggle"
                style={{
                  width: "32px",
                  height: "18px",
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: "9px",
                  position: "relative",
                  transition: "all 0.4s ease",
                }}
              >
                <div className="ha-toggle-knob" style={{
                  position: "absolute",
                  top: "3px",
                  left: "3px",
                  width: "12px",
                  height: "12px",
                  background: "#fff",
                  borderRadius: "50%",
                  transition: "all 0.4s ease",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }} />
              </div>
            </div>

            <div 
              className="ha-search-btn"
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #c8fa64, #9ae62d)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 3px 12px rgba(200,250,100,0.3)",
                transition: "all 0.4s ease",
              }}
            >
              <div className="ha-btn-content" style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                position: "relative",
                zIndex: 1,
                transition: "opacity 0.3s ease",
              }}>
                <div style={{
                  width: "12px",
                  height: "12px",
                  background: "#0c2443",
                  borderRadius: "3px",
                }} />
                <div style={{
                  height: "8px",
                  width: "70px",
                  background: "#0c2443",
                  borderRadius: "3px",
                }} />
              </div>
              <div className="ha-spinner" style={{
                position: "absolute",
                width: "16px",
                height: "16px",
                border: "2px solid #0c2443",
                borderTopColor: "transparent",
                borderRadius: "50%",
                opacity: 0,
                animation: "ha-spin 0.8s linear infinite",
              }} />
            </div>
          </div>
        </div>

        {/* Results - Tabelle im unteren Bereich */}
        <div 
          className="ha-results"
          style={{
            marginTop: "10px",
            background: "rgba(0,0,0,0.4)",
            border: "2px solid rgba(23,195,206,0.3)",
            borderRadius: "10px",
            overflow: "hidden",
            maxHeight: 0,
            opacity: 0,
            transition: "all 0.6s ease",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3), 0 0 15px rgba(23,195,206,0.1)",
          }}
        >
          {/* Results Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid rgba(200,250,100,0.2)",
            background: "linear-gradient(90deg, rgba(23,195,206,0.15), rgba(200,250,100,0.1))",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <div style={{
                width: "3px",
                height: "14px",
                background: "linear-gradient(180deg, #17c3ce, #c8fa64)",
                borderRadius: "2px",
              }} />
              <div style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#fff",
              }}>Ergebnisse</div>
              <div style={{
                padding: "2px 8px",
                background: "rgba(200,250,100,0.25)",
                borderRadius: "8px",
                fontSize: "9px",
                fontWeight: 600,
                color: "#c8fa64",
              }}>3 Treffer</div>
            </div>
          </div>

          {/* Table - Kompakt */}
          <div style={{ padding: "8px" }}>
            {/* Rows */}
            {[
              { id: "01", product: "Kaminofen XL", status: "Aktiv" },
              { id: "02", product: "Pelletofen Pro", status: "Aktiv" },
              { id: "03", product: "Holzofen Basic", status: "Neu" },
            ].map((row, i) => (
              <div 
                key={i}
                className="ha-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "8px",
                  marginBottom: "4px",
                  border: "2px solid transparent",
                  opacity: 0,
                  transform: "translateY(10px)",
                  transition: "all 0.4s ease",
                }}
              >
                <div style={{
                  width: "22px",
                  height: "22px",
                  background: "linear-gradient(135deg, #17c3ce, #0d8a94)",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}>{row.id}</div>
                <div style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#fff",
                  flex: 1,
                }}>{row.product}</div>
                <div style={{
                  padding: "3px 8px",
                  background: row.status === "Neu" ? "rgba(200,250,100,0.25)" : "rgba(23,195,206,0.2)",
                  borderRadius: "6px",
                  fontSize: "8px",
                  fontWeight: 700,
                  color: row.status === "Neu" ? "#c8fa64" : "#17c3ce",
                  flexShrink: 0,
                }}>{row.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cursor */}
      <div 
        className="ha-cursor"
        style={{
          position: "absolute",
          width: "20px",
          height: "20px",
          zIndex: 1000,
          pointerEvents: "none",
          opacity: 0,
          left: "60px",
          top: "80px",
          transition: "opacity 0.4s ease",
          filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.4))",
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" style={{
          width: "100%",
          height: "100%",
          transition: "transform 0.15s ease",
        }}>
          <path 
            d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z" 
            fill="#fff"
            stroke="#0c2443"
            strokeWidth="1.5"
          />
        </svg>
        <div className="ha-cursor-ring" style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "36px",
          height: "36px",
          border: "2px solid #c8fa64",
          borderRadius: "50%",
          transform: "translate(-8px, -8px) scale(0)",
          opacity: 0,
        }} />
      </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        .ha-nav-item.active {
          background: linear-gradient(135deg, rgba(23,195,206,0.15), rgba(200,250,100,0.1)) !important;
          border: 1px solid rgba(200,250,100,0.25);
        }
        .ha-nav-item.active .ha-nav-icon {
          background: #c8fa64 !important;
        }
        .ha-nav-item.active .ha-nav-text {
          background: rgba(255,255,255,0.9) !important;
        }
        .ha-header.show {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .ha-tabs.show {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .ha-panel.show {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .ha-panel.active .ha-panel-accent {
          transform: scaleX(1) !important;
        }
        .ha-tab.active {
          background: linear-gradient(135deg, #17c3ce, #c8fa64) !important;
        }
        .ha-tab.active > div {
          background: #0c2443 !important;
        }
        .ha-mode-btn.active {
          background: #c8fa64 !important;
          border-color: #c8fa64 !important;
        }
        .ha-mode-btn.active > div {
          background: #0c2443 !important;
        }
        .ha-field-input.focus {
          border-color: #17c3ce !important;
          box-shadow: 0 0 0 3px rgba(23,195,206,0.2) !important;
        }
        .ha-field-input.focus .ha-field-cursor {
          opacity: 1 !important;
        }
        .ha-toggle.active {
          background: #c8fa64 !important;
          box-shadow: 0 0 14px rgba(200,250,100,0.4) !important;
        }
        .ha-toggle.active .ha-toggle-knob {
          left: 17px !important;
        }
        .ha-search-btn.hover {
          transform: scale(1.02);
          box-shadow: 0 5px 20px rgba(200,250,100,0.4) !important;
        }
        .ha-search-btn.click {
          transform: scale(0.95) !important;
        }
        .ha-search-btn.load .ha-btn-content {
          opacity: 0 !important;
        }
        .ha-search-btn.load .ha-spinner {
          opacity: 1 !important;
        }
        .ha-results.show {
          max-height: 200px !important;
          opacity: 1 !important;
        }
        .ha-row.show {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .ha-row.hl {
          border-color: rgba(23,195,206,0.4) !important;
          background: rgba(23,195,206,0.1) !important;
        }
        .ha-cursor.show {
          opacity: 1 !important;
        }
        .ha-cursor.click svg {
          transform: scale(0.8) rotate(-5deg) !important;
        }
        .ha-cursor.click .ha-cursor-ring {
          animation: ha-ring 0.6s ease-out !important;
        }
        @keyframes ha-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes ha-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ha-ring {
          0% { transform: translate(-8px, -8px) scale(0); opacity: 1; }
          100% { transform: translate(-8px, -8px) scale(2); opacity: 0; }
        }
        @keyframes ha-fadeIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
