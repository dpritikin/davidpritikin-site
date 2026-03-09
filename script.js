const yearNode = document.getElementById("year");
if (yearNode) yearNode.textContent = String(new Date().getFullYear());

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("in-view");
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll(".reveal").forEach((node, idx) => {
  node.style.transitionDelay = `${Math.min(idx * 40, 240)}ms`;
  observer.observe(node);
});

document.querySelectorAll(".logo-tile img").forEach((img) => {
  if (img.complete && img.naturalWidth > 0) img.closest(".logo-tile")?.classList.add("has-image");
  img.addEventListener("load", () => img.closest(".logo-tile")?.classList.add("has-image"));
});

const reelVideo = document.querySelector(".reel-video");
const reelFallback = document.querySelector("[data-reel-fallback]");
if (reelVideo && reelFallback) {
  const hideFallback = () => { reelFallback.hidden = true; };
  if (reelVideo.readyState > 1) hideFallback();
  reelVideo.addEventListener("loadeddata", hideFallback);
}

const creditsModal = document.querySelector("[data-credits-modal]");
const creditsOpenBtn = document.querySelector("[data-credits-open]");
const creditsCloseBtn = document.querySelector("[data-credits-close]");
if (creditsModal && creditsOpenBtn && creditsCloseBtn) {
  const open = () => { creditsModal.hidden = false; document.body.classList.add("modal-open"); };
  const close = () => { creditsModal.hidden = true; document.body.classList.remove("modal-open"); };
  creditsOpenBtn.addEventListener("click", open);
  creditsCloseBtn.addEventListener("click", close);
  creditsModal.addEventListener("click", (e) => { if (e.target === creditsModal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !creditsModal.hidden) close(); });
}

const gameCanvas = document.getElementById("puttingGame");
if (gameCanvas instanceof HTMLCanvasElement) {
  const ctx = gameCanvas.getContext("2d");
  const holeEl = document.getElementById("golfHole");
  const strokesEl = document.getElementById("golfStrokes");
  const powerEl = document.getElementById("golfPower");
  const messageEl = document.getElementById("golfMessage");

  if (ctx && holeEl && strokesEl && powerEl && messageEl) {
    const state = {
      holeNumber: 1, strokes: 0,
      ball: { x: 180, y: 320, r: 8, vx: 0, vy: 0 },
      hole: { x: 710, y: 220, r: 13 },
      golfer: { x: 150, y: 350 }, golferTarget: { x: 150, y: 350 },
      cursor: { x: 250, y: 280 }, hasDraggedAim: false,
      charging: false, charge: 0, moving: false, sunk: false,
      swingPhase: "idle", swingProgress: 0, impactApplied: false,
      shotVector: { x: 0, y: 0, force: 0, angle: 0 },
      confetti: [], trail: [], sceneTime: 0,
      resetTimer: null, lastTime: performance.now()
    };

    const rand = (min, max) => Math.random() * (max - min) + min;
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const setMessage = (text) => { messageEl.textContent = text; };
    const updateHud = () => {
      holeEl.textContent = String(state.holeNumber);
      strokesEl.textContent = String(state.strokes);
      powerEl.textContent = `${Math.round(state.charge * 100)}%`;
    };
    const getAimAngle = () => Math.atan2(state.cursor.y - state.ball.y, state.cursor.x - state.ball.x);
    const setGolferAddress = () => {
      const aim = getAimAngle();
      const standDist = 44;
      const sideOffset = 10;
      state.golferTarget.x = state.ball.x - Math.cos(aim) * standDist + Math.cos(aim + Math.PI / 2) * sideOffset;
      state.golferTarget.y = state.ball.y - Math.sin(aim) * standDist + Math.sin(aim + Math.PI / 2) * sideOffset + 15;
    };

    const resetHole = (nextHole) => {
      state.holeNumber = nextHole;
      state.strokes = 0;
      state.sunk = false;
      state.charge = 0;
      state.charging = false;
      state.moving = false;
      state.hasDraggedAim = false;
      state.swingPhase = "idle";
      state.swingProgress = 0;
      state.impactApplied = false;
      state.shotVector.force = 0;
      state.ball.vx = 0;
      state.ball.vy = 0;
      state.trail = [];

      state.hole.x = rand(110, gameCanvas.width - 110);
      state.hole.y = rand(120, gameCanvas.height - 110);

      let valid = false;
      while (!valid) {
        state.ball.x = rand(90, gameCanvas.width - 90);
        state.ball.y = rand(95, gameCanvas.height - 95);
        const dx = state.ball.x - state.hole.x;
        const dy = state.ball.y - state.hole.y;
        valid = Math.hypot(dx, dy) > 430;
      }

      state.cursor.x = state.ball.x + 70;
      state.cursor.y = state.ball.y;
      setGolferAddress();
      state.golfer.x = state.golferTarget.x;
      state.golfer.y = state.golferTarget.y;
      setMessage("New hole. Drag your aim, then hold space to putt.");
      updateHud();
    };

    gameCanvas.addEventListener("mousemove", (event) => {
      const rect = gameCanvas.getBoundingClientRect();
      const sx = gameCanvas.width / rect.width;
      const sy = gameCanvas.height / rect.height;
      state.cursor.x = (event.clientX - rect.left) * sx;
      state.cursor.y = (event.clientY - rect.top) * sy;
      state.hasDraggedAim = true;
    });

    const beginSwing = () => {
      if (!state.hasDraggedAim) { setMessage("Drag your aim first."); return; }
      const dx = state.cursor.x - state.ball.x;
      const dy = state.cursor.y - state.ball.y;
      const len = Math.hypot(dx, dy);
      if (len < 6) return;
      const force = 120 + state.charge * 780;
      state.charging = false;
      state.swingPhase = "backswing";
      state.swingProgress = 0;
      state.impactApplied = false;
      state.shotVector = { x: dx / len, y: dy / len, force, angle: Math.atan2(dy, dx) };
    };

    document.addEventListener("keydown", (event) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      if (state.moving || state.sunk || state.charging || state.swingPhase !== "idle") return;
      state.charging = true;
    });

    document.addEventListener("keyup", (event) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      if (!state.charging || state.moving || state.sunk || state.swingPhase !== "idle") return;
      beginSwing();
    });

    const updatePhysics = (dt) => {
      if (state.charging && !state.moving) state.charge = clamp(state.charge + dt / 1.35, 0, 1);
      state.sceneTime += dt;

      if (state.swingPhase === "backswing") {
        state.swingProgress = clamp(state.swingProgress + dt / 0.26, 0, 1);
        if (state.swingProgress >= 1) { state.swingPhase = "downswing"; state.swingProgress = 0; }
      } else if (state.swingPhase === "downswing") {
        state.swingProgress = clamp(state.swingProgress + dt / 0.18, 0, 1);
        if (!state.impactApplied && state.swingProgress >= 0.55) {
          state.ball.vx = state.shotVector.x * state.shotVector.force;
          state.ball.vy = state.shotVector.y * state.shotVector.force;
          state.moving = true;
          state.strokes += 1;
          state.impactApplied = true;
          setMessage("Rolling...");
          updateHud();
        }
        if (state.swingProgress >= 1) { state.swingPhase = "idle"; state.swingProgress = 0; state.charge = 0; }
      }

      if (state.moving) {
        state.ball.x += state.ball.vx * dt;
        state.ball.y += state.ball.vy * dt;
        const drag = Math.pow(0.986, dt * 60);
        state.ball.vx *= drag;
        state.ball.vy *= drag;

        if (state.ball.x <= state.ball.r) { state.ball.x = state.ball.r; state.ball.vx *= -0.6; }
        if (state.ball.x >= gameCanvas.width - state.ball.r) { state.ball.x = gameCanvas.width - state.ball.r; state.ball.vx *= -0.6; }
        if (state.ball.y <= state.ball.r) { state.ball.y = state.ball.r; state.ball.vy *= -0.6; }
        if (state.ball.y >= gameCanvas.height - state.ball.r) { state.ball.y = gameCanvas.height - state.ball.r; state.ball.vy *= -0.6; }

        const speed = Math.hypot(state.ball.vx, state.ball.vy);
        const holeDist = Math.hypot(state.ball.x - state.hole.x, state.ball.y - state.hole.y);
        if (!state.sunk && holeDist < state.hole.r - 1 && speed < 240) {
          state.sunk = true;
          state.moving = false;
          state.ball.x = state.hole.x;
          state.ball.y = state.hole.y;
          state.ball.vx = 0;
          state.ball.vy = 0;
          state.trail = [];
          if (state.strokes === 1) {
            setMessage("Hole in one!");
            for (let i = 0; i < 50; i += 1) {
              state.confetti.push({ x: state.hole.x, y: state.hole.y, vx: rand(-140, 140), vy: rand(-280, -90), life: rand(0.8, 1.5), color: ["#ff3b30", "#ffd60a", "#34c759", "#0a84ff", "#ff2d95"][Math.floor(rand(0, 5))] });
            }
          } else {
            setMessage("Great putt. New hole loading...");
          }
          if (state.resetTimer) window.clearTimeout(state.resetTimer);
          state.resetTimer = window.setTimeout(() => resetHole(state.holeNumber + 1), 1200);
        } else if (speed < 7) {
          state.ball.vx = 0;
          state.ball.vy = 0;
          state.moving = false;
          state.trail = [];
          setGolferAddress();
          setMessage("Missed. Walk up and try again.");
        }

        state.trail.push({ x: state.ball.x, y: state.ball.y, life: 0.45 });
        if (state.trail.length > 18) state.trail.shift();
      }

      if (!state.moving && !state.sunk && state.swingPhase === "idle") setGolferAddress();

      const gx = state.golferTarget.x - state.golfer.x;
      const gy = state.golferTarget.y - state.golfer.y;
      const gDist = Math.hypot(gx, gy);
      if (gDist > 2) {
        const gSpeed = 180 * dt;
        state.golfer.x += (gx / gDist) * Math.min(gSpeed, gDist);
        state.golfer.y += (gy / gDist) * Math.min(gSpeed, gDist);
      }

      state.confetti = state.confetti.filter((p) => p.life > 0);
      state.confetti.forEach((p) => { p.life -= dt; p.vy += 380 * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
      state.trail = state.trail.filter((t) => t.life > 0);
      state.trail.forEach((t) => { t.life -= dt; });
      updateHud();
    };

    const drawCourse = () => {
      const grad = ctx.createLinearGradient(0, 0, gameCanvas.width, gameCanvas.height);
      grad.addColorStop(0, "#74c973");
      grad.addColorStop(0.55, "#5fb85e");
      grad.addColorStop(1, "#478f47");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

      const vignette = ctx.createRadialGradient(gameCanvas.width * 0.5, gameCanvas.height * 0.5, gameCanvas.height * 0.25, gameCanvas.width * 0.5, gameCanvas.height * 0.5, gameCanvas.width * 0.66);
      vignette.addColorStop(0, "rgba(255,255,255,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

      for (let i = 0; i < 12; i += 1) {
        const x = (i * gameCanvas.width) / 12;
        const sway = Math.sin(state.sceneTime * 0.45 + i * 0.8) * 9;
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.03)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + sway, gameCanvas.height * 0.35, x - sway, gameCanvas.height * 0.65, x, gameCanvas.height);
        ctx.lineTo(x + gameCanvas.width / 22, gameCanvas.height);
        ctx.bezierCurveTo(x + gameCanvas.width / 22 - sway, gameCanvas.height * 0.65, x + gameCanvas.width / 22 + sway, gameCanvas.height * 0.35, x + gameCanvas.width / 22, 0);
        ctx.closePath();
        ctx.fill();
      }

      const contour = ctx.createRadialGradient(state.hole.x, state.hole.y, 10, state.hole.x, state.hole.y, 130);
      contour.addColorStop(0, "rgba(255,255,255,0.13)");
      contour.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = contour;
      ctx.beginPath();
      ctx.arc(state.hole.x, state.hole.y, 130, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawHole = () => {
      const rim = ctx.createRadialGradient(state.hole.x, state.hole.y, state.hole.r * 0.35, state.hole.x, state.hole.y, state.hole.r + 5);
      rim.addColorStop(0, "#0f0f0f");
      rim.addColorStop(1, "#4a3a2b");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(state.hole.x, state.hole.y, state.hole.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(state.hole.x, state.hole.y + 2, state.hole.r - 3, state.hole.r - 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(state.hole.x, state.hole.y - 3);
      ctx.lineTo(state.hole.x, state.hole.y - 48);
      ctx.stroke();

      const wave = Math.sin(state.sceneTime * 7) * 4;
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath();
      ctx.moveTo(state.hole.x, state.hole.y - 48);
      ctx.quadraticCurveTo(state.hole.x + 18 + wave, state.hole.y - 46, state.hole.x + 27, state.hole.y - 38);
      ctx.lineTo(state.hole.x, state.hole.y - 30);
      ctx.closePath();
      ctx.fill();
    };

    const drawAimCursor = () => {
      if (state.moving || state.sunk) return;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(state.cursor.x, state.cursor.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(state.cursor.x - 13, state.cursor.y);
      ctx.lineTo(state.cursor.x + 13, state.cursor.y);
      ctx.moveTo(state.cursor.x, state.cursor.y - 13);
      ctx.lineTo(state.cursor.x, state.cursor.y + 13);
      ctx.stroke();

      if (state.charging) {
        ctx.strokeStyle = "rgba(255,215,64,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(state.cursor.x, state.cursor.y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.charge);
        ctx.stroke();
      }
    };

    const drawGolfer = () => {
      const golferScale = 2.5; // 150% larger than original size
      const aim = state.shotVector.force > 0 && state.swingPhase !== "idle" ? state.shotVector.angle : getAimAngle();
      let strokeOffset = 0;
      if (state.charging && state.swingPhase === "idle") strokeOffset = -0.35 * state.charge;
      else if (state.swingPhase === "backswing") strokeOffset = -0.85 * state.swingProgress;
      else if (state.swingPhase === "downswing") strokeOffset = -0.85 + 1.5 * state.swingProgress;

      const facing = aim;
      const walkBob = state.moving ? 0 : Math.sin(state.sceneTime * 6) * 0.8;
      ctx.save();
      ctx.translate(state.golfer.x, state.golfer.y);
      ctx.rotate(facing * 0.12);
      ctx.scale(golferScale, golferScale);

      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(0, 22, 15, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tan pants with distinct legs to avoid skirt look.
      ctx.fillStyle = "#c8a27c";
      ctx.fillRect(-7, 5 + walkBob, 6, 19);
      ctx.fillRect(1, 5 - walkBob, 6, 19);
      ctx.fillStyle = "#9e7f60";
      ctx.fillRect(-1, 5, 2, 19);
      ctx.fillStyle = "#f4f7fb";
      ctx.fillRect(-7, 21 + walkBob, 6, 6);
      ctx.fillRect(1, 21 - walkBob, 6, 6);
      ctx.fillStyle = "#404040";
      ctx.fillRect(-8, 26 + walkBob, 7, 4);
      ctx.fillRect(1, 26 - walkBob, 7, 4);

      // Curved red polo silhouette.
      ctx.fillStyle = "#ff1f1f";
      ctx.beginPath();
      ctx.moveTo(-11, -25);
      ctx.quadraticCurveTo(-14, -10, -10, 4);
      ctx.lineTo(10, 4);
      ctx.quadraticCurveTo(14, -10, 11, -25);
      ctx.closePath();
      ctx.fill();
      // Sleeve contours.
      ctx.fillStyle = "#e01212";
      ctx.beginPath();
      ctx.ellipse(-10.5, -15, 3.2, 5.2, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(10.5, -15, 3.2, 5.2, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // Collar and shirt placket.
      ctx.fillStyle = "#b80e0e";
      ctx.beginPath();
      ctx.moveTo(-2, -25);
      ctx.lineTo(0, -17);
      ctx.lineTo(2, -25);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -17);
      ctx.lineTo(0, 4);
      ctx.stroke();

      const skin = ctx.createRadialGradient(2, -38, 1, 0, -36, 9);
      skin.addColorStop(0, "#f4cfad");
      skin.addColorStop(1, "#d8aa83");
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, -36, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#173f66";
      ctx.fillRect(-9, -44, 18, 7);
      ctx.fillRect(-4, -47, 8, 4);
      ctx.fillRect(3, -37, 9, 2);
      ctx.restore();

      const putterAngle = aim + strokeOffset;
      const bodyAngle = facing * 0.12;
      const toWorld = (lx, ly) => {
        const sx = lx * golferScale;
        const sy = ly * golferScale;
        const c = Math.cos(bodyAngle);
        const s = Math.sin(bodyAngle);
        return {
          x: state.golfer.x + sx * c - sy * s,
          y: state.golfer.y + sx * s + sy * c
        };
      };

      const leadShoulder = toWorld(6, -18);
      const trailShoulder = toWorld(-6, -18);
      const gripTop = toWorld(7, -14);
      const shaftLen = 34 * golferScale * 0.95;
      const headWidth = 10 * golferScale * 0.9;
      const headDepth = 3.5 * golferScale * 0.9;
      const handX = gripTop.x;
      const handY = gripTop.y;
      const gripBottom = {
        x: handX + Math.cos(putterAngle) * 10 * golferScale * 0.25,
        y: handY + Math.sin(putterAngle) * 10 * golferScale * 0.25
      };

      // Only keep the putter set behind the ball while idle/aiming.
      // During backswing/downswing, let the club move freely for a real stroke.
      const addressMode = !state.moving && !state.sunk && state.swingPhase === "idle";
      const px = addressMode ? state.ball.x - Math.cos(aim) * (state.ball.r + 2.5) : handX + Math.cos(putterAngle) * shaftLen;
      const py = addressMode ? state.ball.y - Math.sin(aim) * (state.ball.r + 2.5) : handY + Math.sin(putterAngle) * shaftLen;

      // Two-hand putting posture.
      ctx.strokeStyle = "#e3b58c";
      ctx.lineWidth = 4.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(leadShoulder.x, leadShoulder.y);
      ctx.lineTo(gripTop.x, gripTop.y);
      ctx.moveTo(trailShoulder.x, trailShoulder.y);
      ctx.lineTo(gripBottom.x, gripBottom.y);
      ctx.stroke();

      ctx.fillStyle = "#e3b58c";
      ctx.beginPath();
      ctx.arc(gripTop.x, gripTop.y, 2.5 * golferScale * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gripBottom.x, gripBottom.y, 2.6 * golferScale * 0.22, 0, Math.PI * 2);
      ctx.fill();

      const shaftGrad = ctx.createLinearGradient(handX, handY, px, py);
      shaftGrad.addColorStop(0, "#ced5df");
      shaftGrad.addColorStop(1, "#707988");
      ctx.strokeStyle = shaftGrad;
      ctx.lineWidth = 2.6;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(px, py);
      ctx.stroke();

      const hoselX = px + Math.cos(putterAngle + Math.PI / 2) * 1.7;
      const hoselY = py + Math.sin(putterAngle + Math.PI / 2) * 1.7;
      ctx.strokeStyle = "#4e545d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(hoselX, hoselY);
      ctx.stroke();

      ctx.save();
      ctx.translate(hoselX, hoselY);
      ctx.rotate(putterAngle + Math.PI / 2);
      ctx.fillStyle = "#2b3138";
      ctx.fillRect(-headWidth / 2, -headDepth / 2, headWidth, headDepth);
      ctx.restore();
    };

    const drawTrail = () => {
      if (!state.moving) return;
      state.trail.forEach((t, idx) => {
        const alpha = Math.max(0, t.life * 0.4);
        const r = state.ball.r * (0.5 + (idx / Math.max(state.trail.length, 1)) * 0.3);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const drawConfetti = () => {
      state.confetti.forEach((p) => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 5, 8);
      });
      ctx.globalAlpha = 1;
    };

    const drawBall = () => {
      const speed = Math.hypot(state.ball.vx, state.ball.vy);
      const spin = speed * 0.01 + state.sceneTime * 2;

      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(state.ball.x, state.ball.y + state.ball.r + 1.8, state.ball.r * 0.85, 2.7, 0, 0, Math.PI * 2);
      ctx.fill();

      const ballGrad = ctx.createRadialGradient(state.ball.x - 2.2, state.ball.y - 2.8, 1.5, state.ball.x, state.ball.y, state.ball.r + 1.4);
      ballGrad.addColorStop(0, "#ffffff");
      ballGrad.addColorStop(1, "#dfe7ef");
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(20,20,20,0.25)";
      ctx.stroke();

      const dimpleR = 0.84;
      const dimpleOffsets = [];
      for (let ring = 0; ring < 3; ring += 1) {
        const count = 6 + ring * 3;
        const radius = 2 + ring * 2.2;
        for (let i = 0; i < count; i += 1) {
          const a = spin + (Math.PI * 2 * i) / count + ring * 0.3;
          dimpleOffsets.push([Math.cos(a) * radius, Math.sin(a) * radius * 0.92]);
        }
      }
      ctx.fillStyle = "rgba(180,190,200,0.45)";
      dimpleOffsets.forEach(([ox, oy]) => {
        ctx.beginPath();
        ctx.arc(state.ball.x + ox, state.ball.y + oy, dimpleR, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const frame = (now) => {
      const dt = Math.min((now - state.lastTime) / 1000, 0.033);
      state.lastTime = now;
      updatePhysics(dt);
      drawCourse();
      drawHole();
      drawTrail();
      drawConfetti();
      drawAimCursor();
      drawGolfer();
      drawBall();
      window.requestAnimationFrame(frame);
    };

    resetHole(1);
    window.requestAnimationFrame(frame);
  }
}
