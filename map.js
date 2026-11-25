// MapLibre GL JS v5 3D World Globe & Route Controller for Travel With Jahronimo
(function () {
  "use strict";

  const STATUS_COLORS = {
    current: "#0f766e",
    next: "#d97706",
    visited: "#16a34a",
    planned: "#c2410c"
  };

  const STATUS_LABELS = {
    current: "📍 Current Base",
    next: "🧭 Next Stop",
    visited: "✅ Visited",
    planned: "🗺️ Planned"
  };

  window.initTravelMap = function initTravelMap(routeData) {
    const container = document.getElementById("worldMap3D");
    const stageWrap = document.getElementById("mapStageWrap");
    const statusEl = document.getElementById("mapStatus");
    if (!container || typeof maplibregl === "undefined") {
      if (statusEl) statusEl.textContent = "3D Map library loading — refresh if offline.";
      return null;
    }

    const stops = Array.isArray(routeData?.stops) ? routeData.stops : [];
    const currentStop = stops.find((s) => s.key === routeData?.currentStopKey) || stops[0] || {
      key: "brighton",
      label: "Brighton, UK",
      coords: [-0.1372, 50.8225],
      dates: "Home Base",
      notes: "Starting point on the UK South Coast."
    };

    const map = new maplibregl.Map({
      container: "worldMap3D",
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors"
          }
        },
        layers: [
          {
            id: "osm-base",
            type: "raster",
            source: "osm-tiles",
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: currentStop.coords || [-0.1372, 50.8225],
      zoom: 2.1,
      pitch: 46,
      bearing: -12,
      cooperativeGestures: false,
      touchZoomRotate: false,
      touchPitch: false,
      dragPan: true,
      dragRotate: true,
      doubleClickZoom: true,
      attributionControl: true
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    const markers = new Map();
    let userMarker = null;
    let watchId = null;
    let is3D = true;

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg;
    }

    function buildRouteGeoJSON(stopList) {
      const coords = stopList.filter((s) => Array.isArray(s.coords) && s.coords.length === 2).map((s) => s.coords);
      return {
        type: "FeatureCollection",
        features: coords.length > 1
          ? [
              {
                type: "Feature",
                geometry: { type: "LineString", coordinates: coords },
                properties: {}
              }
            ]
          : []
      };
    }

    function renderPins(stopList) {
      markers.forEach((m) => m.remove());
      markers.clear();

      stopList.forEach((stop) => {
        if (!Array.isArray(stop.coords) || stop.coords.length !== 2) return;
        const color = STATUS_COLORS[stop.status] || STATUS_COLORS.planned;

        const el = document.createElement("button");
        el.type = "button";
        el.className = "map-pin" + (stop.status === "current" ? " is-current" : "") + (stop.status === "next" ? " is-next" : "");
        el.setAttribute("aria-label", `${stop.label} (${stop.dates || ""})`);
        el.style.cssText = [
          "width:18px",
          "height:18px",
          "border-radius:999px",
          `background:${color}`,
          "border:2.5px solid #fffdf9",
          "box-shadow:0 3px 10px rgba(0,0,0,0.35)",
          "cursor:pointer",
          "padding:0",
          "transition:transform 0.18s ease"
        ].join(";");

        const popupHtml = `
          <div style="font-family:inherit;min-width:160px;color:#112321;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:${color};margin-bottom:3px;">
              ${STATUS_LABELS[stop.status] || "Stop"}
            </div>
            <div style="font-size:14px;font-weight:900;margin-bottom:2px;">${stop.label}</div>
            ${stop.dates ? `<div style="font-size:12px;font-weight:700;color:#4f6461;margin-bottom:4px;">${stop.dates}</div>` : ""}
            ${stop.notes ? `<div style="font-size:12px;line-height:1.4;color:#2e3f3d;">${stop.notes}</div>` : ""}
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 18, closeButton: true }).setHTML(popupHtml);

        el.addEventListener("click", () => {
          window.SFX?.tap?.();
          flyToStop(stop.key);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(stop.coords)
          .setPopup(popup)
          .addTo(map);

        markers.set(stop.key, marker);
      });
    }

    function flyToStop(stopKey) {
      const stop = stops.find((s) => s.key === stopKey);
      if (!stop || !Array.isArray(stop.coords)) return;

      if (!stageWrap?.classList.contains("is-fullscreen")) {
        enterFullscreen();
      }

      map.flyTo({
        center: stop.coords,
        zoom: stop.key === "brighton" ? 6.2 : 5.2,
        pitch: is3D ? 50 : 0,
        bearing: 0,
        duration: 1400,
        essential: true
      });

      const marker = markers.get(stop.key);
      if (marker) {
        markers.forEach((m, k) => {
          if (k !== stop.key && m.getPopup()?.isOpen()) m.togglePopup();
        });
        if (!marker.getPopup()?.isOpen()) marker.togglePopup();
      }

      document.querySelectorAll("#stopPills .stop-pill").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.stop === stop.key);
      });

      setStatus(`${STATUS_LABELS[stop.status] || "📍"} · ${stop.label} (${stop.dates || "Planned"}) — ${stop.notes || ""}`);
      const hudEl = document.getElementById("mapFsHudText");
      if (hudEl && currentStop?.coords && stop.coords) {
        const km = haversineKm(currentStop.coords, stop.coords);
        hudEl.textContent = stop.key === currentStop.key ? `📍 Base: ${stop.label}` : `✈️ ${stop.label} · ${km.toLocaleString()} km from ${currentStop.label}`;
      }
    }

    function haversineKm(c1, c2) {
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(c2[1] - c1[1]);
      const dLon = toRad(c2[0] - c1[0]);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(c1[1])) * Math.cos(toRad(c2[1])) * Math.sin(dLon / 2) ** 2;
      return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    let currentTourIdx = Math.max(0, stops.findIndex((s) => s.key === currentStop.key));
    let routeVisible = true;

    function stepTour(delta) {
      if (!stops.length) return;
      currentTourIdx = (currentTourIdx + delta + stops.length) % stops.length;
      window.SFX?.nav?.(currentTourIdx);
      flyToStop(stops[currentTourIdx].key);
    }

    document.getElementById("mapPrevStopHudBtn")?.addEventListener("click", () => stepTour(-1));
    document.getElementById("mapNextStopHudBtn")?.addEventListener("click", () => stepTour(1));
    document.getElementById("mapNorthHudBtn")?.addEventListener("click", () => {
      window.SFX?.tap?.();
      map.easeTo({ bearing: 0, pitch: is3D ? 46 : 0, duration: 600 });
      setStatus("Compass reset to North.");
    });
    document.getElementById("mapRouteToggleBtn")?.addEventListener("click", (e) => {
      window.SFX?.tap?.();
      routeVisible = !routeVisible;
      e.currentTarget.classList.toggle("active", routeVisible);
      const vis = routeVisible ? "visible" : "none";
      if (map.getLayer("travel-route-line")) map.setLayoutProperty("travel-route-line", "visibility", vis);
      if (map.getLayer("travel-route-glow")) map.setLayoutProperty("travel-route-glow", "visibility", vis);
      setStatus(routeVisible ? "Route path visible." : "Route path hidden.");
    });

    map.on("load", () => {
      try {
        map.setProjection({ type: "globe" });
      } catch (e) {
        // Fallback silently on older WebGL drivers
      }

      map.addSource("travel-route", {
        type: "geojson",
        data: buildRouteGeoJSON(stops)
      });

      map.addLayer({
        id: "travel-route-glow",
        type: "line",
        source: "travel-route",
        paint: {
          "line-color": "#fbbf24",
          "line-width": 6,
          "line-opacity": 0.28
        }
      });

      map.addLayer({
        id: "travel-route-line",
        type: "line",
        source: "travel-route",
        paint: {
          "line-color": "#0f766e",
          "line-width": 3,
          "line-dasharray": [2.2, 1.6]
        }
      });

      renderPins(stops);
    });

    // 2D / 3D Mode Toggle
    const btn3d = document.getElementById("btn3d");
    const btn2d = document.getElementById("btn2d");

    function setMapMode(enable3D) {
      is3D = enable3D;
      btn3d?.classList.toggle("active", enable3D);
      btn2d?.classList.toggle("active", !enable3D);
      try {
        map.setProjection({ type: enable3D ? "globe" : "mercator" });
      } catch (e) {}
      map.easeTo({ pitch: enable3D ? 46 : 0, duration: 700 });
      setStatus(enable3D ? "3D Globe mode active · Drag to spin, pinch/scroll to zoom." : "2D Flat Map mode active.");
    }

    btn3d?.addEventListener("click", () => {
      window.SFX?.tap?.();
      setMapMode(true);
    });
    btn2d?.addEventListener("click", () => {
      window.SFX?.tap?.();
      setMapMode(false);
    });

    // +15° Pitch / Tilt Step
    const tiltBtn = document.getElementById("mapTiltBtn");
    tiltBtn?.addEventListener("click", () => {
      window.SFX?.tap?.();
      const nextPitch = Math.round(map.getPitch()) >= 58 ? 0 : Math.min(60, Math.round(map.getPitch()) + 15);
      map.easeTo({ pitch: nextPitch, duration: 450 });
      setStatus(`Map tilt: ${nextPitch}°`);
    });

    // Full World Reset
    const worldBtn = document.getElementById("mapWorldBtn");
    worldBtn?.addEventListener("click", () => {
      window.SFX?.tap?.();
      map.flyTo({
        center: [22, 24],
        zoom: 1.5,
        pitch: is3D ? 42 : 0,
        bearing: -10,
        duration: 1300
      });
      setStatus("Full World view · All 13 target countries on the 2027 horizon.");
    });

    // Fullscreen Toggle (launched from #openWorldCardBtn or stop pills)
    const openCardBtn = document.getElementById("openWorldCardBtn");
    const fsExitBtn = document.getElementById("mapFsExitBtn");

    function applyFullscreenState(active) {
      if (!stageWrap) return;
      stageWrap.classList.toggle("is-fullscreen", active);
      document.body.style.overflow = active ? "hidden" : "";
      if (active) {
        map.dragPan.enable();
        map.scrollZoom.enable();
        setTimeout(() => map.resize(), 60);
        setTimeout(() => map.resize(), 280);
      }
    }

    function enterFullscreen() {
      window.SFX?.open?.();
      applyFullscreenState(true);
      setStatus("3D World Visualiser open · Tap ✕ Exit Fullscreen (top-left) to return.");
    }

    function exitFullscreen() {
      window.SFX?.close?.();
      applyFullscreenState(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setStatus("Tap the World Card or any stop pill below to open the 3D World Visualiser.");
    }

    openCardBtn?.addEventListener("click", enterFullscreen);
    [fsExitBtn, document.getElementById("mapFsExitBtn2")].forEach((btn) => {
      if (!btn) return;
      ["pointerdown", "touchstart"].forEach((evt) => {
        btn.addEventListener(evt, (e) => {
          e.stopPropagation();
        }, { passive: true });
      });
      ["click", "touchend"].forEach((evt) => {
        btn.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          exitFullscreen();
        });
      });
    });

    document.addEventListener("fullscreenchange", () => {
      const fsActive = document.fullscreenElement === stageWrap;
      if (!fsActive && stageWrap?.classList.contains("is-fullscreen")) {
        applyFullscreenState(false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && stageWrap?.classList.contains("is-fullscreen")) {
        exitFullscreen();
      }
    });

    // Unified Mobile 1F, 2F & 3F Gestures inside Fullscreen 3D Globe:
    // - 1-Finger: MapLibre dragPan rotates/spins the 3D world
    // - 2-Finger: Pinch in/out zoom + twist clockwise/anticlockwise rotate + pan
    // - 3-Finger: 3D camera rotation (bearing & pitch), quick 3-finger tap = Full World reset
    let touchState = null;

    function getTouchMetrics(touches) {
      const n = touches.length;
      let sx = 0, sy = 0;
      for (let i = 0; i < n; i++) {
        sx += touches[i].clientX;
        sy += touches[i].clientY;
      }
      const cx = sx / n;
      const cy = sy / n;
      let dist = 0;
      let angle = 0;
      if (n >= 2) {
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        dist = Math.hypot(dx, dy);
        angle = Math.atan2(dy, dx);
      }
      return { cx, cy, dist, angle };
    }

    function syncTouchState(touches) {
      const n = touches.length;
      const m = getTouchMetrics(touches);
      touchState = {
        fingers: n,
        lastX: m.cx,
        lastY: m.cy,
        lastDist: m.dist || 1,
        lastAngle: m.angle || 0,
        moved: 0,
        t: Date.now()
      };
    }

    container.addEventListener(
      "touchstart",
      (e) => {
        if (!stageWrap?.classList.contains("is-fullscreen")) return;
        const n = e.touches.length;
        if (n === 1) {
          map.dragPan.enable();
          touchState = null;
        } else if (n === 2 || n === 3) {
          e.preventDefault();
          map.dragPan.disable();
          syncTouchState(e.touches);
        }
      },
      { passive: false }
    );

    container.addEventListener(
      "touchmove",
      (e) => {
        if (!stageWrap?.classList.contains("is-fullscreen")) return;
        const n = e.touches.length;
        if (n < 2) return;
        e.preventDefault();

        if (!touchState || n !== touchState.fingers) {
          syncTouchState(e.touches);
          return;
        }

        const m = getTouchMetrics(e.touches);
        const dx = m.cx - touchState.lastX;
        const dy = m.cy - touchState.lastY;
        touchState.moved += Math.hypot(dx, dy);

        if (n === 2) {
          // 2-Finger Twist Rotation (clockwise & anticlockwise)
          const dAngleRad = Math.atan2(
            Math.sin(m.angle - touchState.lastAngle),
            Math.cos(m.angle - touchState.lastAngle)
          );
          const dAngleDeg = (dAngleRad * 180) / Math.PI;
          if (Math.abs(dAngleDeg) > 0.15) {
            map.setBearing(map.getBearing() - dAngleDeg);
          }

          // 2-Finger Pinch In/Out Zoom
          if (m.dist > 10 && touchState.lastDist > 10) {
            const zoomDelta = Math.log2(m.dist / touchState.lastDist);
            if (Math.abs(zoomDelta) > 0.002) {
              const nextZoom = Math.max(0.8, Math.min(18, map.getZoom() + zoomDelta));
              map.setZoom(nextZoom);
            }
          }

          // 2-Finger Pan
          if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
            map.panBy([-dx, -dy], { animate: false });
          }
        } else if (n === 3) {
          // 3-Finger 3D Rotation (Bearing left/right + Pitch up/down)
          map.setBearing(map.getBearing() - dx * 0.55);
          map.setPitch(Math.max(0, Math.min(60, map.getPitch() - dy * 0.4)));
        }

        touchState.lastX = m.cx;
        touchState.lastY = m.cy;
        touchState.lastDist = m.dist || touchState.lastDist;
        touchState.lastAngle = m.angle;
      },
      { passive: false }
    );

    function handleTouchLift(e) {
      if (!stageWrap?.classList.contains("is-fullscreen")) return;
      const n = e.touches.length;
      if (n >= 2) {
        syncTouchState(e.touches);
        return;
      }
      if (n <= 1) {
        map.dragPan.enable();
      }
      if (!touchState) return;
      if (n === 0) {
        const dt = Date.now() - touchState.t;
        const moved = touchState.moved;
        const fingers = touchState.fingers;
        touchState = null;

        if (fingers === 3 && dt < 340 && moved < 22) {
          window.SFX?.tap?.();
          map.flyTo({
            center: [22, 24],
            zoom: 1.5,
            pitch: is3D ? 42 : 0,
            bearing: -10,
            duration: 1100
          });
          setStatus("3-Finger Tap: Full World reset.");
        }
      }
    }

    container.addEventListener("touchend", handleTouchLift, { passive: true });
    container.addEventListener("touchcancel", handleTouchLift, { passive: true });

    // User GPS Pin Helper
    function updateUserPin(lng, lat, fly = true) {
      if (!userMarker) {
        const el = document.createElement("div");
        el.style.cssText = "width:16px;height:16px;border-radius:999px;background:#2563eb;border:3px solid #ffffff;box-shadow:0 0 0 6px rgba(37,99,235,0.28);";
        userMarker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML("<strong>📍 Your Location</strong>"))
          .addTo(map);
      } else {
        userMarker.setLngLat([lng, lat]);
      }
      if (fly) {
        map.flyTo({ center: [lng, lat], zoom: 6.5, duration: 1300 });
      }
    }

    // Single-tap Connect Phone Location
    const connectLocBtn = document.getElementById("connectLocBtn");
    connectLocBtn?.addEventListener("click", () => {
      window.SFX?.tap?.();
      if (!navigator.geolocation) {
        setStatus("Geolocation is not supported by this browser.");
        return;
      }
      setStatus("Requesting phone GPS location…");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.SFX?.mapPing?.();
          const { latitude, longitude } = pos.coords;
          updateUserPin(longitude, latitude, true);
          setStatus(`Connected! Your coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        },
        (err) => {
          setStatus(`Location unavailable (${err.message}).`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    // Live Follow Me (watchPosition)
    const followBtn = document.getElementById("mapFollowBtn");
    followBtn?.addEventListener("click", () => {
      window.SFX?.tap?.();
      if (!navigator.geolocation) {
        setStatus("Geolocation is not supported by this browser.");
        return;
      }
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        followBtn.classList.remove("active");
        followBtn.textContent = "📡 Follow Me";
        setStatus("Live Follow Me paused.");
        return;
      }

      let firstLock = true;
      followBtn.classList.add("active");
      followBtn.textContent = "📡 Following… (Tap to Stop)";
      setStatus("Starting live GPS tracking…");

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (firstLock) {
            window.SFX?.mapPing?.();
            firstLock = false;
          }
          updateUserPin(longitude, latitude, true);
          setStatus(`Live GPS lock: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        },
        (err) => {
          setStatus(`Follow Me error: ${err.message}`);
          followBtn.classList.remove("active");
          followBtn.textContent = "📡 Follow Me";
          watchId = null;
        },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    });

    return {
      flyToStop,
      refreshRoute(newRoute) {
        if (!newRoute?.stops) return;
        stops.length = 0;
        stops.push(...newRoute.stops);
        if (map.getSource("travel-route")) {
          map.getSource("travel-route").setData(buildRouteGeoJSON(stops));
        }
        renderPins(stops);
      }
    };
  };
})();
