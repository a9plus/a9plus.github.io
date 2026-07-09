const main = document.getElementById("main");
const uiText = document.getElementById("uiText");
const uiGif = document.getElementById("uiGif");
const btn = document.getElementById("actionBtn");

let state = "idle";
let startTime = 0;
let greenStart = 0;
let greenEnd = 0;
let timingTimeout = null;

// NEW: money system
let money = 120;

function updateMoney() {
  uiText.innerText = "$" + money;
}

btn.onclick = () => {
  if (state === "idle") {
    startCast();
  } else if (state === "timing") {
    tryReel();
  }
};

function startCast() {
  state = "casting";
  main.src = "cast.gif";

  uiText.style.display = "block";
  uiGif.style.display = "none";

  const castLength = 600;

  setTimeout(() => {
    if (state === "casting") {
      main.src = "castline.png";
    }
  }, castLength);

  const wait = castLength + (Math.random() * 2000);

  setTimeout(() => {
    startTimingBar();
  }, wait);
}

function startTimingBar() {
  state = "timing";

  uiText.style.display = "none";
  uiGif.style.display = "block";

  startTime = performance.now();

  const frameDuration = 75;
  const totalFrames = 16;
  const totalDuration = frameDuration * totalFrames;

  greenStart = 7 * frameDuration;
  greenEnd   = 11 * frameDuration;

  timingTimeout = setTimeout(() => {
    if (state === "timing") {
      failReel();
    }
  }, totalDuration);
}

function tryReel() {
  if (state !== "timing") return;

  clearTimeout(timingTimeout);

  const now = performance.now();
  const elapsed = now - startTime;

  uiGif.style.display = "none";
  uiText.style.display = "block";

  if (elapsed >= greenStart && elapsed <= greenEnd) {
    main.src = "caught.png";

    // NEW: reward for good timing
    let reward = Math.floor(Math.random() * 20) + 10; // $10–$30
    money += reward;
    updateMoney();

  } else {
    main.src = "miss.png";
  }

  endReel();
}

function failReel() {
  uiGif.style.display = "none";
  uiText.style.display = "block";

  main.src = "miss.png";

  endReel();
}

function endReel() {
  state = "idle";

  setTimeout(() => {
    main.src = "idle.png";
  }, 1500);
}

// show starting money
updateMoney();
