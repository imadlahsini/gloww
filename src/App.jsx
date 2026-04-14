import React, { useState, useEffect, useRef, useCallback } from "react";

/* ─── Data loading — fetches from data.json, filters hidden items ─── */
let salonData = { categories: [] };

function useLoadData() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/data.json?" + Date.now())
      .then(r => r.json())
      .then(data => {
        // Filter out hidden categories and services
        data.categories = (data.categories || [])
          .filter(c => c.visible !== false)
          .map(c => ({
            ...c,
            services: (c.services || []).filter(s => s.visible !== false)
          }))
          .filter(c => c.services.length > 0);
        salonData = data;
        setLoaded(true);
      })
      .catch(e => setError(e.message));
  }, []);

  return { loaded, error };
}


/* ─── Responsive radius + node size ─── */
function useResponsiveRadius() {
  const [radius, setRadius] = useState(170);
  const [nodeSize, setNodeSize] = useState(58);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1024) { setRadius(240); setNodeSize(72); }
      else if (w >= 768) { setRadius(210); setNodeSize(66); }
      else if (w >= 480) { setRadius(180); setNodeSize(60); }
      else { setRadius(145); setNodeSize(52); }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return { radius, nodeSize };
}

/* ─── Safe image with loading/error states ─── */
function SafeImage({ src, alt, style, ...props }) {
  const [status, setStatus] = useState("loading");
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}>
      {status === "loading" && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            width: "20px", height: "20px",
            border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.4)",
            borderRadius: "50%", animation: "spin 0.8s linear infinite"
          }} />
        </div>
      )}
      {status === "error" ? (
        <div style={{
          width: "100%", height: "100%",
          background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", color: "rgba(255,255,255,0.25)"
        }}>✦</div>
      ) : (
        <img src={src} alt={alt}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          draggable={false}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            opacity: status === "loaded" ? 1 : 0, transition: "opacity 0.3s ease"
          }}
          {...props}
        />
      )}
    </div>
  );
}

/* ─── Generate image variants from a service's seed URL ─── */
function getServiceImages(imageUrl, count = 4) {
  // Extract seed from URL like "https://picsum.photos/seed/royalespa/400/300"
  const match = imageUrl.match(/\/seed\/([^/]+)\//);
  if (!match) return [imageUrl];
  const baseSeed = match[1];
  return Array.from({ length: count }, (_, i) =>
    imageUrl.replace(`/seed/${baseSeed}/`, `/seed/${baseSeed}${i === 0 ? "" : "v" + (i + 1)}/`)
  );
}

/* ─── Stories-style service viewer ─── */
const STORY_DURATION = 5000;

function StoryViewer({ service, categoryName, onClose }) {
  const images = getServiceImages(service.image, 4);
  const count = images.length;

  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const dragStartY = useRef(0);
  const isDraggingRef = useRef(false);
  const dismissedRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { dismissedRef.current = dismissed; }, [dismissed]);

  // Animate info in
  useEffect(() => {
    const t = setTimeout(() => setInfoVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Progress animation loop — reads drag/dismiss from refs, not deps
  useEffect(() => {
    startTimeRef.current = Date.now();
    setProgress(0);
    let pausedAt = 0;

    const tick = () => {
      if (isDraggingRef.current || dismissedRef.current) {
        // Pause — remember where we stopped
        if (pausedAt === 0) pausedAt = Date.now() - startTimeRef.current;
        timerRef.current = requestAnimationFrame(tick);
        return;
      }

      // Resume — shift start time to account for paused duration
      if (pausedAt > 0) {
        startTimeRef.current = Date.now() - pausedAt;
        pausedAt = 0;
      }

      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(elapsed / STORY_DURATION, 1);
      setProgress(p);

      if (p >= 1) {
        if (current < count - 1) {
          goTo(current + 1);
        }
        return;
      }
      timerRef.current = requestAnimationFrame(tick);
    };

    timerRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timerRef.current);
  }, [current, count]);

  const goTo = (idx) => {
    if (idx < 0 || idx >= count || transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrent(idx);
      setProgress(0);
      startTimeRef.current = Date.now();
      setTransitioning(false);
    }, 150);
  };

  // Tap zones — left 30% = prev, right 70% = next
  const handleTap = (e) => {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX || e.changedTouches?.[0]?.clientX) - rect.left;
    const ratio = x / rect.width;

    if (ratio < 0.3) {
      goTo(current - 1);
    } else {
      if (current < count - 1) {
        goTo(current + 1);
      } else {
        onClose();
      }
    }
  };

  // Swipe down to dismiss
  const handleTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(false);
  };

  const handleTouchMove = (e) => {
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 10) {
      setIsDragging(true);
      setDragY(Math.max(0, dy));
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 120) {
      setDismissed(true);
      setTimeout(onClose, 350);
    } else {
      setDragY(0);
    }
    setTimeout(() => setIsDragging(false), 50);
  };

  const dismissProgress = Math.min(dragY / 300, 1);
  const scale = 1 - dismissProgress * 0.12;
  const borderRadius = dismissProgress * 28;
  const opacity = dismissed ? 0 : 1;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: `rgba(0,0,0,${1 - dismissProgress * 0.5})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: dismissed ? "opacity 0.35s ease" : "none",
        opacity,
      }}
    >
      <div style={{
        position: "relative",
        width: "100%", height: "100%",
        transform: `translateY(${dragY}px) scale(${scale})`,
        borderRadius: `${borderRadius}px`,
        overflow: "hidden",
        transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.35s ease",
      }}>
        {/* ── Progress bars at top ── */}
        <div style={{
          position: "absolute", top: "16px", left: "12px", right: "12px",
          display: "flex", gap: "4px", height: "3px", zIndex: 20,
        }}>
          {images.map((_, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: "2px",
              background: "rgba(255,255,255,0.25)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: "2px",
                background: "#fff",
                transformOrigin: "left",
                transform: i < current
                  ? "scaleX(1)"
                  : i === current
                    ? `scaleX(${progress})`
                    : "scaleX(0)",
                transition: i === current ? "none" : "transform 0.2s ease",
              }} />
            </div>
          ))}
        </div>

        {/* ── Close button ── */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            position: "absolute", top: "32px", right: "14px", zIndex: 20,
            width: "36px", height: "36px", borderRadius: "50%",
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff", fontSize: "18px", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>

        {/* ── Category label ── */}
        <div style={{
          position: "absolute", top: "36px", left: "14px", zIndex: 20,
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{
            fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.7)",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}>{categoryName}</span>
        </div>

        {/* ── Image (portrait, full bleed) ── */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: transitioning ? 0.6 : 1,
          transition: "opacity 0.15s ease",
        }}>
          <img
            src={images[current]}
            alt=""
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center",
              display: "block",
            }}
          />
        </div>

        {/* ── Bottom gradient ── */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: "60%",
          background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.95) 100%)",
          pointerEvents: "none",
        }} />

        {/* ── Service info overlay ── */}
        <div style={{
          position: "absolute", bottom: "0", left: 0, right: 0,
          padding: "0 20px 44px",
          zIndex: 10,
          opacity: infoVisible ? 1 : 0,
          transform: infoVisible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
        }}>
          {/* Price + duration — bold and clear */}
          <div style={{
            display: "flex", gap: "10px", marginBottom: "18px",
            alignItems: "baseline",
          }}>
            <span style={{
              fontSize: "36px", fontWeight: 800, letterSpacing: "-1.5px",
              lineHeight: 1,
              textShadow: "0 2px 16px rgba(0,0,0,0.5)",
            }}>
              {service.price} <span style={{ fontSize: "20px", fontWeight: 600, opacity: 0.7 }}>DH</span>
            </span>
            <div style={{
              width: "1.5px", height: "22px", background: "rgba(255,255,255,0.25)",
              margin: "0 4px",
            }} />
            <span style={{
              fontSize: "18px", fontWeight: 600, color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.3px",
            }}>
              {service.duration}
            </span>
          </div>

          {/* Service name */}
          <h1 style={{
            fontSize: "32px", fontWeight: 700, margin: "0 0 10px",
            letterSpacing: "-1px", lineHeight: 1.1,
            textShadow: "0 2px 12px rgba(0,0,0,0.4)",
          }}>
            {service.name}
          </h1>

          {/* Description */}
          <p style={{
            fontSize: "15px", color: "rgba(255,255,255,0.55)",
            margin: "0 0 20px", lineHeight: 1.6, maxWidth: "320px",
          }}>
            {service.description}
          </p>

          {/* Image counter */}
          <span style={{
            fontSize: "12px", color: "rgba(255,255,255,0.3)", fontWeight: 500,
            letterSpacing: "1px",
          }}>
            {String(current + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
        </div>

        {/* ── Tap zone hints (shown briefly on open) ── */}
        <TapHints />
      </div>
    </div>
  );
}

/* Brief flash of tap zone hints on first open */
function TapHints() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 15,
      display: "flex", pointerEvents: "none",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.6s ease",
    }}>
      <div style={{
        flex: "0 0 30%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.03)",
      }}>
        <span style={{ fontSize: "24px", opacity: 0.3 }}>‹</span>
      </div>
      <div style={{ flex: 1, background: "transparent" }} />
    </div>
  );
}

/* ─── Preview card — animates from node position to center ─── */
function PreviewCard({ category, origin, onConfirm, onDismiss }) {
  const [phase, setPhase] = useState("entering"); // entering → open → exiting
  const cardRef = useRef(null);

  // Calculate offset from viewport center to node origin
  const offsetX = origin ? origin.x - window.innerWidth / 2 : 0;
  const offsetY = origin ? origin.y - window.innerHeight / 2 : 0;

  // Frame 1: render at origin. Frame 2: flip to center (triggers CSS transition)
  useEffect(() => {
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setPhase("open");
      });
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, []);

  const handleDismiss = () => {
    setPhase("exiting");
    setTimeout(() => onDismiss(), 350);
  };

  const handleConfirm = () => {
    setPhase("exiting");
    setTimeout(() => onConfirm(), 300);
  };

  const isAtOrigin = phase === "entering" || phase === "exiting";

  return (
    <div onClick={handleDismiss} style={{
      position: "fixed", inset: 0, zIndex: 500,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: isAtOrigin ? "transparent" : "rgba(0,0,0,0.3)",
      transition: "background 0.4s ease",
    }}>
      <div
        ref={cardRef}
        onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
        style={{
          background: "rgba(20,20,20,0.95)", backdropFilter: "blur(40px)",
          borderRadius: isAtOrigin ? "50%" : "32px",
          border: "1px solid rgba(255,255,255,0.12)",
          padding: isAtOrigin ? "0px" : "28px",
          width: isAtOrigin ? "60px" : "260px",
          height: isAtOrigin ? "60px" : "auto",
          textAlign: "center", cursor: "pointer",
          overflow: "hidden",
          transform: isAtOrigin
            ? `translate(${offsetX}px, ${offsetY}px) scale(0.9)`
            : "translate(0, 0) scale(1)",
          opacity: phase === "entering" ? 0.5 : phase === "exiting" ? 0 : 1,
          transition: [
            "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            "opacity 0.35s ease",
            "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            "height 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            "border-radius 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            "padding 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          ].join(", "),
          boxShadow: isAtOrigin
            ? "0 0 0 rgba(0,0,0,0)"
            : "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        <div style={{
          opacity: phase === "open" ? 1 : 0,
          transition: "opacity 0.3s ease 0.15s",
          pointerEvents: phase === "open" ? "auto" : "none",
        }}>
          <div style={{
            width: "88px", height: "88px", borderRadius: "50%", overflow: "hidden",
            margin: "0 auto 18px", border: "3px solid rgba(255,255,255,0.5)",
            boxShadow: "0 0 40px rgba(255,255,255,0.15)"
          }}>
            <SafeImage src={category.image} alt={category.name} />
          </div>
          <h3 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px", color: "#fff" }}>{category.name}</h3>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: "0 0 22px" }}>
            {category.services.length} services
          </p>
          <div style={{
            padding: "14px 28px", borderRadius: "16px", background: "#fff", color: "#000",
            fontSize: "15px", fontWeight: 600, display: "inline-block"
          }}>
            Découvrir →
          </div>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", margin: "16px 0 0", letterSpacing: "0.5px" }}>
            TOUCHER POUR OUVRIR
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Menu item — scannable, polished ─── */
function MenuItem({ service, index, onClick }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold: 0.1, rootMargin: "0px 0px -20px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const delay = index * 0.06;

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onTouchCancel={() => setPressed(false)}
      style={{
        display: "flex",
        gap: "16px",
        padding: "12px",
        marginBottom: "10px",
        borderRadius: "20px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        cursor: "pointer",
        opacity: visible ? 1 : 0,
        transform: visible
          ? (pressed ? "scale(0.98)" : "scale(1)")
          : "translateY(20px)",
        boxShadow: pressed
          ? "0 2px 8px rgba(0,0,0,0.3)"
          : "0 4px 20px rgba(0,0,0,0.1)",
        transition: pressed
          ? "transform 0.15s ease, box-shadow 0.15s ease"
          : `transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, opacity 0.5s ease ${delay}s, box-shadow 0.3s ease`,
      }}
    >
      {/* Image */}
      <div style={{
        width: "88px", height: "88px",
        borderRadius: "16px", overflow: "hidden",
        flexShrink: 0, position: "relative",
      }}>
        <SafeImage src={service.image} alt={service.name} />
        <div style={{
          position: "absolute", inset: 0, borderRadius: "16px",
          boxShadow: "inset 0 0 12px rgba(0,0,0,0.25)",
          pointerEvents: "none",
        }} />
      </div>

      {/* Info */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", minWidth: 0,
      }}>
        <h3 style={{
          fontSize: "16px", fontWeight: 600, margin: 0,
          lineHeight: 1.3, color: "rgba(255,255,255,0.9)",
          letterSpacing: "-0.1px",
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {service.name}
        </h3>

        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          marginTop: "10px",
        }}>
          <span style={{
            fontSize: "18px", fontWeight: 700, color: "#fff",
            letterSpacing: "-0.5px",
          }}>
            {service.price}
            <span style={{
              fontSize: "11px", fontWeight: 500,
              color: "rgba(255,255,255,0.35)", marginLeft: "2px",
            }}>DH</span>
          </span>

          <div style={{
            padding: "4px 10px", borderRadius: "100px",
            background: "rgba(255,255,255,0.06)",
            fontSize: "12px", fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.3px",
          }}>
            {service.duration}
          </div>
        </div>
      </div>

      {/* Chevron */}
      <div style={{
        display: "flex", alignItems: "center", paddingRight: "4px",
        fontSize: "16px",
        color: pressed ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)",
        transition: "color 0.2s ease",
      }}>›</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ─── Services View — Hero Banner Header ───
   ═══════════════════════════════════════════ */
function ServicesView({ category, isExiting, onBack, onSelectService, backPressed, setBackPressed }) {
  const scrollRef = useRef(null);
  const [entered, setEntered] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const services = category?.services || [];
  const heroH = 240;

  // Entrance trigger
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Scroll tracking for parallax
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollY(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollRatio = Math.min(scrollY / heroH, 1);
  const imgScale = 1.05 + scrollRatio * 0.1;
  const imgBrightness = 0.45 - scrollRatio * 0.2;
  const titleY = scrollRatio * -20;
  const titleOpacity = 1 - scrollRatio * 1.2;

  return (
    <div style={{
      height: "100vh",
      position: "relative",
      zIndex: 2,
      animation: isExiting ? "categoryExit 0.4s cubic-bezier(0.4, 0, 1, 1) forwards" : "zoomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      {/* Scrollable content */}
      <div
        ref={scrollRef}
        data-scroll-container="true"
        style={{
          height: "100%", overflowY: "auto", overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* ── Hero Banner ── */}
        <div style={{
          height: `${heroH}px`, position: "relative", overflow: "hidden",
        }}>
          {/* Background image — parallax zoom */}
          <div style={{
            position: "absolute", inset: "-30px",
            transform: `scale(${imgScale})`,
            filter: `brightness(${imgBrightness})`,
            willChange: "transform",
            opacity: entered ? 1 : 0,
            transition: "opacity 0.8s ease",
          }}>
            <SafeImage src={category?.heroImage} alt="" />
          </div>

          {/* Gradient fade to black */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: "70%",
            background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 40%, #000 100%)",
            pointerEvents: "none",
          }} />

          {/* Back button — floating top left */}
          <button
            onClick={onBack}
            onTouchStart={() => setBackPressed(true)}
            onTouchEnd={() => setBackPressed(false)}
            onTouchCancel={() => setBackPressed(false)}
            onMouseDown={() => setBackPressed(true)}
            onMouseUp={() => setBackPressed(false)}
            style={{
              position: "absolute",
              top: "max(20px, env(safe-area-inset-top, 12px) + 8px)",
              left: "16px",
              zIndex: 10,
              width: "42px", height: "42px", borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.3)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              color: "#fff", fontSize: "20px",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: backPressed ? "scale(0.88)" : "scale(1)",
              transition: "transform 0.15s ease",
              opacity: entered ? 1 : 0,
              transitionDelay: "0.15s",
            }}
          >←</button>

          {/* Title block — bottom of hero */}
          <div style={{
            position: "absolute",
            bottom: "24px", left: "20px", right: "20px",
            transform: `translateY(${titleY}px)`,
            opacity: Math.max(0, titleOpacity),
            willChange: "transform, opacity",
          }}>
            {/* Category name */}
            <h1 style={{
              fontSize: "clamp(28px, 7vw, 40px)",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-1px",
              lineHeight: 1.1,
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(14px)",
              transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
              textShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}>
              {category?.name}
            </h1>

            {/* Service count */}
            <p style={{
              fontSize: "clamp(12px, 2.8vw, 14px)",
              color: "rgba(255,255,255,0.4)",
              margin: "8px 0 0",
              fontWeight: 500,
              letterSpacing: "0.5px",
              opacity: entered ? 1 : 0,
              transition: "opacity 0.6s ease 0.4s",
            }}>
              {services.length} soins
            </p>
          </div>
        </div>

        {/* ── Menu items ── */}
        <div style={{ padding: "16px 12px 80px" }}>
          {services.map((service, index) => (
            <MenuItem
              key={service.id}
              service={service}
              index={index}
              onClick={() => onSelectService(service)}
            />
          ))}

          {/* End marker */}
          <div style={{
            textAlign: "center", padding: "20px 0 10px",
          }}>
            <div style={{
              width: "32px", height: "1px",
              background: "rgba(255,255,255,0.08)",
              margin: "0 auto",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ─── Main component ───
   ═══════════════════════════════════════════ */
export default function SalonMenu() {
  const { loaded, error } = useLoadData();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);
  const [isExiting, setIsExiting] = useState(false);
  const [orbitalExiting, setOrbitalExiting] = useState(false);
  const [backPressed, setBackPressed] = useState(false);
  const [previewCategory, setPreviewCategory] = useState(null);
  const [previewOrigin, setPreviewOrigin] = useState(null);

  const { radius, nodeSize } = useResponsiveRadius();
  const currentCategory = salonData.categories.find(c => c.id === selectedCategory);

  /* ─── Drag-to-rotate + momentum + snap ─── */
  const orbitRef = useRef(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartAngle = useRef(0);
  const dragStartRotation = useRef(0);
  const lastDragAngle = useRef(0);
  const lastDragTime = useRef(0);
  const momentumRaf = useRef(null);
  const didDrag = useRef(false);
  const isMovingRef = useRef(false);

  useEffect(() => { angleRef.current = rotationAngle; }, [rotationAngle]);

  const getAngleFromCenter = useCallback((clientX, clientY) => {
    if (!orbitRef.current) return 0;
    const rect = orbitRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }, []);

  // Track touch start position to measure distance traveled
  const touchStartPos = useRef({ x: 0, y: 0 });
  const touchDistRef = useRef(0);
  const DRAG_THRESHOLD = 12; // pixels — below this counts as a tap
  const pointerIdRef = useRef(null);
  const capturedRef = useRef(false);
  const lastPointerType = useRef("mouse");

  const handlePointerDown = useCallback((e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;

    pointerIdRef.current = e.pointerId;
    capturedRef.current = false;
    lastPointerType.current = e.pointerType || "mouse";

    // Always start tracking, even on nodes
    isDraggingRef.current = true;
    isMovingRef.current = true;
    didDrag.current = false;
    touchStartPos.current = { x: clientX, y: clientY };
    touchDistRef.current = 0;
    velocityRef.current = 0;
    if (momentumRaf.current) cancelAnimationFrame(momentumRaf.current);

    dragStartAngle.current = getAngleFromCenter(clientX, clientY);
    dragStartRotation.current = angleRef.current;
    lastDragAngle.current = dragStartAngle.current;
    lastDragTime.current = Date.now();
    setAutoRotate(false);
  }, [getAngleFromCenter]);

  const handlePointerMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.clientX;
    const clientY = e.clientY;

    // Track total pixel distance to distinguish drag from tap
    const dx = clientX - touchStartPos.current.x;
    const dy = clientY - touchStartPos.current.y;
    touchDistRef.current = Math.sqrt(dx * dx + dy * dy);

    if (touchDistRef.current > DRAG_THRESHOLD) {
      didDrag.current = true;
      // Capture after threshold so short taps still fire click on the node
      if (!capturedRef.current && e.currentTarget && pointerIdRef.current !== null) {
        try { e.currentTarget.setPointerCapture(pointerIdRef.current); capturedRef.current = true; } catch {}
      }
    }

    const currentAngle = getAngleFromCenter(clientX, clientY);
    let delta = currentAngle - dragStartAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const newAngle = (dragStartRotation.current + delta + 360) % 360;
    setRotationAngle(Number(newAngle.toFixed(3)));

    // Track velocity
    const now = Date.now();
    const dt = now - lastDragTime.current;
    if (dt > 0) {
      let angleDelta = currentAngle - lastDragAngle.current;
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;
      velocityRef.current = (angleDelta / dt) * 16;
    }
    lastDragAngle.current = currentAngle;
    lastDragTime.current = now;
  }, [getAngleFromCenter]);

  const snapToNearest = useCallback(() => {
    const total = salonData.categories.length;
    const step = 360 / total;

    const spring = () => {
      const current = angleRef.current;
      const target = Math.round(current / step) * step;
      let d = target - current;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;

      if (Math.abs(d) < 0.15) {
        setRotationAngle(Number(((target + 360) % 360).toFixed(3)));
        isMovingRef.current = false;
        if (!isDraggingRef.current) setAutoRotate(true);
        return;
      }
      const newA = (current + d * 0.14 + 360) % 360;
      setRotationAngle(Number(newA.toFixed(3)));
      momentumRaf.current = requestAnimationFrame(spring);
    };
    spring();
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    capturedRef.current = false;

    const vel = velocityRef.current;

    if (Math.abs(vel) > 0.3) {
      // Momentum phase
      let v = vel;
      const tick = () => {
        v *= 0.93;
        if (Math.abs(v) < 0.08) { snapToNearest(); return; }
        const newAngle = (angleRef.current + v + 360) % 360;
        setRotationAngle(Number(newAngle.toFixed(3)));
        momentumRaf.current = requestAnimationFrame(tick);
      };
      tick();
    } else {
      snapToNearest();
    }
  }, [snapToNearest]);

  useEffect(() => { return () => { if (momentumRaf.current) cancelAnimationFrame(momentumRaf.current); }; }, []);

  /* ─── Slow auto-rotate when idle ─── */
  useEffect(() => {
    let timer;
    if (autoRotate && !selectedCategory && !previewCategory) {
      timer = setInterval(() => {
        if (!isDraggingRef.current) {
          setRotationAngle(prev => Number(((prev + 0.3) % 360).toFixed(3)));
        }
      }, 50);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [autoRotate, selectedCategory, previewCategory]);

  /* ─── Position calculator ─── */
  const calculateNodePosition = useCallback((index, total) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.sin(radian));
    // sin goes from -1 (top/back) to +1 (bottom/front)
    const depthFactor = (1 + Math.sin(radian)) / 2; // 0 = back, 1 = front
    const scale = 0.7 + depthFactor * 0.45; // 0.7 at back, 1.15 at front
    const opacity = Math.max(0.35, Math.min(1, 0.35 + depthFactor * 0.65));
    return { x, y, angle, zIndex, scale, opacity, depthFactor };
  }, [rotationAngle, radius]);

  /* ─── Touch device detection ─── */
  const isTouchDevice = useRef(false);
  useEffect(() => { isTouchDevice.current = "ontouchstart" in window || navigator.maxTouchPoints > 0; }, []);

  /* ─── Navigate to category with zoom transition ─── */
  const navigateToCategory = useCallback((categoryId) => {
    setHoveredId(null);
    setOrbitalExiting(true);
    setAutoRotate(false);
    setTimeout(() => {
      setSelectedCategory(categoryId);
      setOrbitalExiting(false);
    }, 350);
  }, []);

  /* ─── Node tap: preview on touch, direct on desktop ─── */
  const handleNodeClick = (category, e) => {
    if (didDrag.current) return;
    if (lastPointerType.current === "touch" || lastPointerType.current === "pen") {
      // Get the image circle's screen position for animation origin
      const nodeEl = e.currentTarget.querySelector("[data-node-image]") || e.currentTarget;
      const rect = nodeEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      setAutoRotate(false);
      setPreviewOrigin({ x: cx, y: cy });
      setPreviewCategory(category);
    } else {
      navigateToCategory(category.id);
    }
  };

  const handlePreviewConfirm = () => {
    if (previewCategory) {
      const id = previewCategory.id;
      setPreviewCategory(null);
      setPreviewOrigin(null);
      navigateToCategory(id);
    }
  };
  const handlePreviewDismiss = () => { setPreviewCategory(null); setPreviewOrigin(null); setAutoRotate(true); };

  const handleBack = () => {
    setBackPressed(false);
    setIsExiting(true);
    setTimeout(() => {
      setSelectedCategory(null);
      setSelectedService(null);
      setIsExiting(false);
      setAutoRotate(true);
    }, 400);
  };

  /* ═══════════════════════════════════════════ */
  if (!loaded) return (
    <div style={{
      height: "100vh", background: "#000", color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    }}>
      {error ? (
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Erreur: {error}</p>
      ) : (
        <>
          <div style={{
            width: "24px", height: "24px",
            border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.5)",
            borderRadius: "50%", animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", marginTop: "16px", letterSpacing: "2px" }}>
            GLOW BEAUTY
          </p>
        </>
      )}
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#000",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
      color: "#fff", overflow: "hidden",
      touchAction: selectedCategory ? "auto" : "none"
    }}>

      {/* ════════ Orbital View ════════ */}
      {!selectedCategory && (
        <div style={{
          width: "100%", height: "100vh", minHeight: "580px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          position: "relative",
          animation: orbitalExiting ? "orbitDepart 0.35s cubic-bezier(0.4, 0, 1, 1) forwards"
            : "orbitReturn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          userSelect: "none", WebkitUserSelect: "none",
        }}>
          {/* Header */}
          <div style={{ position: "absolute", top: "60px", textAlign: "center", zIndex: 10 }}>
            <p style={{
              fontSize: "11px", color: "rgba(255,255,255,0.35)",
              letterSpacing: "4px", marginBottom: "8px", fontWeight: 500
            }}>BIENVENUE</p>
            <h1 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>Glow Beauty</h1>
          </div>

          {/* Orbital Container — drag surface */}
          <div
            ref={orbitRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: "relative",
              width: `${radius * 2 + nodeSize + 100}px`,
              maxWidth: "100%",
              height: `${radius * 2 + nodeSize + 100}px`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "grab",
              touchAction: "none",
            }}
          >
            {/* Center Hub */}
            <div style={{
              position: "absolute",
              width: "64px", height: "64px", borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10, pointerEvents: "none"
            }}>
              <div style={{
                position: "absolute", width: "80px", height: "80px", borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.2)",
                animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite"
              }} />
              <div style={{
                position: "absolute", width: "96px", height: "96px", borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.1)",
                animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite", animationDelay: "0.5s"
              }} />
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)"
              }} />
            </div>

            {/* Orbit Ring */}
            <div style={{
              position: "absolute",
              width: `${radius * 2}px`, height: `${radius * 2}px`,
              borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)",
              pointerEvents: "none"
            }} />

            {/* Orbital Nodes */}
            {(() => {
              const total = salonData.categories.length;
              const positions = salonData.categories.map((_, i) => calculateNodePosition(i, total));
              const frontIndex = positions.reduce((best, pos, i) => pos.depthFactor > positions[best].depthFactor ? i : best, 0);

              return salonData.categories.map((category, index) => {
              const position = positions[index];
              const isActive = hoveredId === category.id || previewCategory?.id === category.id;
              const isFront = index === frontIndex;
              const scaledSize = nodeSize * position.scale;
              const borderWidth = isFront ? 3 : position.depthFactor > 0.5 ? 2 : 1.5;

              const finalX = position.x;
              const finalY = position.y;

              return (
                <div
                  key={category.id}
                  data-node="true"
                  onClick={(e) => handleNodeClick(category, e)}
                  onMouseEnter={() => { setHoveredId(category.id); setAutoRotate(false); }}
                  onMouseLeave={() => { setHoveredId(null); setAutoRotate(true); }}
                  style={{
                    position: "absolute",
                    transform: `translate(${finalX}px, ${finalY}px)`,
                    zIndex: isActive ? 200 : position.zIndex,
                    opacity: isActive ? 1 : position.opacity,
                    transition: isMovingRef.current ? "none" : "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                    cursor: "pointer",
                    padding: "16px", margin: "-16px",
                  }}
                >
                  {/* Spotlight glow — always rendered, opacity-driven */}
                  <div style={{
                    position: "absolute",
                    width: `${scaledSize * 2}px`, height: `${scaledSize * 2}px`,
                    top: "50%", left: "50%",
                    marginTop: `${-scaledSize}px`, marginLeft: `${-scaledSize}px`,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 70%)",
                    pointerEvents: "none",
                    opacity: isFront ? 1 : 0,
                    transition: isMovingRef.current ? "none" : "opacity 0.3s ease",
                  }} />

                  {/* Image Node — size driven by depth */}
                  <div data-node-image="true" style={{
                    width: `${scaledSize}px`, height: `${scaledSize}px`,
                    borderRadius: "50%", overflow: "hidden",
                    border: `${borderWidth}px solid ${isFront ? "rgba(255,255,255,0.9)" : `rgba(255,255,255,${0.15 + position.depthFactor * 0.2})`}`,
                    boxShadow: isFront
                      ? "0 0 24px rgba(255,255,255,0.2), 0 8px 32px rgba(0,0,0,0.4)"
                      : `0 4px ${6 + position.depthFactor * 10}px rgba(0,0,0,0.3)`,
                    transition: isMovingRef.current ? "none" : "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}>
                    <SafeImage src={category.image} alt={category.name} />
                  </div>

                  {/* Label — only on front node */}
                  <div style={{
                    position: "absolute",
                    top: `calc(50% + ${scaledSize / 2 + 12}px)`,
                    left: "50%", transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    fontSize: "13px",
                    fontWeight: 600, letterSpacing: "0.5px",
                    color: "#fff",
                    opacity: isFront ? 1 : 0,
                    transition: isMovingRef.current ? "none" : "opacity 0.3s ease",
                    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    pointerEvents: "none"
                  }}>
                    {category.name}
                  </div>
                </div>
              );
            });
            })()}
          </div>

          {/* Bottom hint */}
          <div style={{ position: "absolute", bottom: "50px", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", letterSpacing: "1px", margin: "0 0 8px" }}>
              Glissez pour explorer
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "4px", opacity: 0.2 }}>
              <div style={{ width: "20px", height: "2px", background: "#fff", borderRadius: "1px" }} />
              <div style={{ width: "6px", height: "2px", background: "#fff", borderRadius: "1px" }} />
            </div>
          </div>
        </div>
      )}

      {/* ════════ Tap-to-Preview ════════ */}
      {previewCategory && (
        <PreviewCard category={previewCategory} origin={previewOrigin} onConfirm={handlePreviewConfirm} onDismiss={handlePreviewDismiss} />
      )}

      {/* ════════ Services View ════════ */}
      {selectedCategory && (
        <ServicesView
          category={currentCategory}
          isExiting={isExiting}
          onBack={handleBack}
          onSelectService={setSelectedService}
          backPressed={backPressed}
          setBackPressed={setBackPressed}
        />
      )}

      {/* ════════ Service Detail — Stories Viewer ════════ */}
      {selectedService && (
        <StoryViewer
          service={selectedService}
          categoryName={currentCategory?.name}
          onClose={() => setSelectedService(null)}
        />
      )}

      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(1.1); } to { opacity: 1; transform: scale(1); } }
        @keyframes categoryExit {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.92); }
        }
        @keyframes orbitReturn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes orbitDepart { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.15); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes ping { 75%, 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
