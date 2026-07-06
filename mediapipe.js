window.onload = function () {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  // Resize canvas to full screen
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener("resize", resizeCanvas);
  video.addEventListener("loadedmetadata", resizeCanvas);

  // Setup MediaPipe Hands
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2, // enable both hands
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  // Finger tip indices: Thumb, Index, Middle, Ring, Pinky
  const fingerTips = [4, 8, 12, 16, 20];
  const trailLength = 5;
  const fingerHistory = {}; // history for all fingers on all hands
  const particles = []; // active fingertip particles

  // Particle constructor for fingertip sparkles
  function Particle(x, y, hue) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.life = 60;
    this.hue = hue;
  }

  Particle.prototype.update = function () {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05; // gravity
    this.life -= 1;
  };

  Particle.prototype.draw = function (ctx) {
    ctx.fillStyle = `hsla(${this.hue}, 100%, 70%, ${this.life / 60})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
  };

  hands.onResults((results) => {
    // Clear with slow black fade for trailing effect
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = "lighter"; // for glow

    // Process particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw(ctx);
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Process each detected hand
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks, handIndex) => {
        fingerTips.forEach((tipIndex, fingerIndex) => {
          const tip = landmarks[tipIndex];
          const x = canvas.width - (tip.x * canvas.width);
          const y = tip.y * canvas.height;
          const id = `${handIndex}-${fingerIndex}`;
          const hue = (fingerIndex * 72 + handIndex * 30) % 360;

          // Store finger trail
          if (!fingerHistory[id]) fingerHistory[id] = [];
          const trail = fingerHistory[id];
          trail.push({ x, y });
          if (trail.length > trailLength) trail.shift();

          // Draw directional strokes
          for (let i = 1; i < trail.length; i++) {
            const p1 = trail[i - 1];
            const p2 = trail[i];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const angle = Math.atan2(dy, dx);

            const alpha = 1 - i / trail.length;
            const length = Math.hypot(dx, dy);

            ctx.save();
            ctx.translate(p1.x, p1.y);
            ctx.rotate(angle);

            ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
            ctx.lineWidth = 5 + (1 - i / trail.length) * 3;
            ctx.shadowBlur = 12;
            ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha})`;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(length, 0);
            ctx.stroke();
            ctx.restore();
          }

          // Add fingertip particles
          for (let i = 0; i < 4; i++) {
            particles.push(new Particle(x, y, hue));
          }
        });
      });
    }
  });

  // Start camera
  const cam = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480
  });

  cam.start();
};
