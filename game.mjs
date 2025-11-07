//#region CONSTANTS ------------------------------------------------------------------
const FPS = 1000 / 60;
const STATES = { MENU: 1, PLAY: 2, GAMEOVER: 3 };

//#endregion

//#region Game variables -------------------------------------------------------------
const scene = document.getElementById("scene");
const brush = getBrush();

let currentState = STATES.MENU; // start in menu

// ------

const MENU = {
  currentIndex: 0,
  showingHighScore: false,
  buttons: [
    { text: "Play", action: startPlay },
    { text: "High Scores", action: showHigScores },
  ],
};

// ------

const ship = {
  x: scene.width * 0.5 - 50,
  y: scene.height - 30,
  width: 50,
  height: 20,
  velocityX: 0,
  velocityY: 0,
  maxVelocity: 3,
};

// ------

const projectileWidth = 3;
const projectileHeight = 5;
const projectileSpeed = 4;
const projectileCooldown = 14;
let cooldown = 0;
let projectiles = [];

// ------ NPC / Invaders -----------------------------------------------------------
const NPC = {
  width: 40,
  height: 18,
  padding: 14,
  sx: 40,
  sy: 40,
  speed: 0.8,
  direction: 1,
  entities: [],
};

let npcPerRow = Math.floor((scene.width - NPC.sx) / (NPC.width + NPC.padding));

// rows
let npcRows = 4; // requirement: at least 4 rows
let rowColors = ["red", "orange", "yellow", "green", "cyan", "magenta"];

// Movment back and forth of NPC´s are governed by counting steps
const maxMovmentSteps = 120;
let movmentSteps = 0;

// waves, scoring, highscores
let waveNumber = 0;
let score = 0;
let highScore = Number(localStorage.getItem("space_invaders_highscore") || 0);

// UFO bonus
let ufo = {
  active: false,
  x: -100,
  y: 20,
  width: 46,
  height: 14,
  speed: 2,
  dir: 1,
};
let ufoSpawnTimer = 0; // counts frames until possible spawn
let ufoSpawnIntervalMin = 4 * 60; // 4 seconds
let ufoSpawnIntervalMax = 12 * 60; // 12 seconds

// The following is a simple way of
let controllKeys = {
  ArrowDown: false,
  ArrowUp: false,
  ArrowLeft: false,
  ArrowRight: false,
  " ": false, // space
};

window.addEventListener("keydown", function (e) {
  controllKeys[e.key] = true;
});

window.addEventListener("keyup", function (e) {
  controllKeys[e.key] = false;
});

//#endregion

//#region Game engine ----------------------------------------------------------------

function init() {
  // seed first wave
  resetForNewWave();

  currentState = STATES.MENU;
  update();
}

function update(time) {
  if (currentState === STATES.MENU) {
    updateMenu(time);
  } else if (currentState === STATES.PLAY) {
    updateGame(time);
  } else if (currentState === STATES.GAMEOVER) {
    // show score for a short while then return to menu - but per instructions we return to menu after display
    // we'll allow player to press space to return to menu
    if (controllKeys[" "]) {
      currentState = STATES.MENU;
    }
  }

  draw();
  requestAnimationFrame(update);
}

function draw() {
  clearScreen();

  if (currentState === STATES.MENU) {
    drawMenu();
  } else if (currentState === STATES.PLAY) {
    drawGameState();
  } else if (currentState === STATES.GAMEOVER) {
    drawGameOver();
  }
}

init(); // Starts the game

//#endregion

//#region Game functions

function updateMenu(dt) {
  if (controllKeys[" "]) {
    // if showing highscores, space returns to normal menu
    if (MENU.showingHighScore) {
      MENU.showingHighScore = false;
    } else {
      MENU.buttons[MENU.currentIndex].action();
    }
    // prevent repeated immediate triggers
    controllKeys[" "] = false;
  }

  if (controllKeys.ArrowUp) {
    MENU.currentIndex--;
    controllKeys.ArrowUp = false;
  } else if (controllKeys.ArrowDown) {
    MENU.currentIndex++;
    controllKeys.ArrowDown = false;
  }

  MENU.currentIndex = clamp(MENU.currentIndex, 0, MENU.buttons.length - 1);
}

function drawMenu() {
  let sy = 100;
  brush.font = "30px serif";
  brush.fillStyle = "#000";
  brush.fillText("SPACE - INVADERS (variation)", 60, 60);

  for (let i = 0; i < MENU.buttons.length; i++) {
    let text = MENU.buttons[i].text;
    if (i == MENU.currentIndex) {
      text = `* ${text} *`;
    }

    brush.font = "36px serif";
    brush.fillText(text, 100, sy);
    sy += 50;
  }

  if (MENU.showingHighScore) {
    brush.font = "28px serif";
    brush.fillText(`High score: ${highScore}`, 100, sy + 30);
    brush.fillText("Press SPACE to return", 100, sy + 70);
  }
}

function updateGame(dt) {
  updateShip();
  updateProjectiles();
  updateInvaders();
  updateUFO();

  // Check for game over: any invader reaches defender level
  if (checkInvaderReachedDefender()) {
    // game over: show final score and highscore and return to menu when player presses space
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("space_invaders_highscore", String(highScore));
    }
    currentState = STATES.GAMEOVER;
  }
}

function resetForNewWave() {
  NPC.entities = [];
  npcPerRow = Math.floor((scene.width - NPC.sx) / (NPC.width + NPC.padding));

  let startX = NPC.sx;
  let y = NPC.sy;
  // create multiple rows
  for (let r = 0; r < npcRows; r++) {
    let x = startX;
    for (let i = 0; i < npcPerRow; i++) {
      let color = rowColors[r % rowColors.length];
      NPC.entities.push({
        x,
        y,
        color,
        active: true,
        width: NPC.width,
        height: NPC.height,
        row: r,
      });
      x += NPC.width + NPC.padding;
    }
    y += NPC.height + 12; // vertical spacing between rows
  }

  // reset movement and speed tweaks
  movmentSteps = 0;
  NPC.direction = 1;
  NPC.speed = 0.8 + waveNumber * 0.12;

  // reset ship position
  ship.x = scene.width * 0.5 - ship.width * 0.5;
  ship.velocityX = 0;

  // reset projectiles
  projectiles = [];

  // reset UFO timer
  ufo.active = false;
  ufoSpawnTimer = randRange(ufoSpawnIntervalMin, ufoSpawnIntervalMax);
}

function updateInvaders() {
  // movement: move horizontally, when steps exceed threshold reverse and move down
  movmentSteps++;
  let tx = NPC.speed * NPC.direction;
  let ty = 0;

  if (movmentSteps >= maxMovmentSteps) {
    movmentSteps = 0;
    NPC.direction *= -1;
    ty = NPC.height; // move down one row-height when reversing
  }

  for (let invader of NPC.entities) {
    if (!invader.active) continue;
    invader.x += tx;
    invader.y += ty;
    // keep them inside horizontal bounds; simple approach: if any invader hits edge, reverse next frame
    if (invader.x < 0) invader.x = 0;
    if (invader.x + invader.width > scene.width)
      invader.x = scene.width - invader.width;

    // shot detection
    if (isShot(invader)) {
      invader.active = false;
      // award points depending on row - higher rows give more
      let points = 10 + (npcRows - 1 - invader.row) * 5;
      score += points;
    }
  }

  // if all invaders dead -> spawn next wave
  if (NPC.entities.every((e) => !e.active)) {
    waveNumber++;
    resetForNewWave();
  }
}

function checkInvaderReachedDefender() {
  for (let invader of NPC.entities) {
    if (!invader.active) continue;
    if (invader.y + invader.height >= ship.y) {
      return true;
    }
  }
  return false;
}

function isShot(target) {
  for (let i = 0; i < projectiles.length; i++) {
    let projectile = projectiles[i];
    if (!projectile.active) continue;
    if (
      overlaps(
        target.x,
        target.y,
        target.width,
        target.height,
        projectile.x - projectileWidth / 2,
        projectile.y,
        projectile.width,
        projectile.height
      )
    ) {
      projectile.active = false;
      return true;
    }
  }

  // check UFO too
  if (
    ufo.active &&
    overlaps(
      target.x,
      target.y,
      target.width,
      target.height,
      ufo.x,
      ufo.y,
      ufo.width,
      ufo.height
    )
  ) {
    // allow invader to be killed by UFO collision? uncommon - ignore
  }

  return false;
}

function updateShip() {
  if (controllKeys.ArrowLeft) {
    ship.velocityX = Math.max(ship.velocityX - 0.2, -ship.maxVelocity);
  } else if (controllKeys.ArrowRight) {
    ship.velocityX = Math.min(ship.velocityX + 0.2, ship.maxVelocity);
  } else {
    // friction
    ship.velocityX *= 0.9;
    if (Math.abs(ship.velocityX) < 0.01) ship.velocityX = 0;
  }

  let tmpX = ship.x + ship.velocityX;
  tmpX = clamp(tmpX, 0, scene.width - ship.width);

  ship.x = tmpX;

  cooldown--;

  if (controllKeys[" "] && cooldown <= 0) {
    projectiles.push({
      x: ship.x + ship.width * 0.5 - projectileWidth / 2,
      y: ship.y - projectileHeight,
      dir: -1,
      active: true,
      width: projectileWidth,
      height: projectileHeight,
    });
    cooldown = projectileCooldown;
    // prevent holding space from spamming immediate multiple shots (space must be released)
    controllKeys[" "] = false;
  }
}

function updateProjectiles() {
  let activeProjectiles = [];
  for (let i = 0; i < projectiles.length; i++) {
    let projectile = projectiles[i];
    projectile.y += projectileSpeed * projectile.dir;
    if (projectile.y + projectile.height > 0 && projectile.active) {
      activeProjectiles.push(projectile);
    }
  }
  projectiles = activeProjectiles;

  // also check projectiles hitting UFO
  for (let p of projectiles) {
    if (!p.active) continue;
    if (
      ufo.active &&
      overlaps(ufo.x, ufo.y, ufo.width, ufo.height, p.x, p.y, p.width, p.height)
    ) {
      p.active = false;
      // big bonus
      score += 200;
      ufo.active = false;
    }
  }
}

function updateUFO() {
  // spawn timer
  if (!ufo.active) {
    ufoSpawnTimer--;
    if (ufoSpawnTimer <= 0) {
      ufo.active = true;
      // start from left or right randomly
      if (Math.random() < 0.5) {
        ufo.x = -ufo.width;
        ufo.dir = 1;
      } else {
        ufo.x = scene.width + ufo.width;
        ufo.dir = -1;
      }
      ufo.y = 14;
      ufo.speed = 1.8 + waveNumber * 0.12;
    }
  } else {
    ufo.x += ufo.speed * ufo.dir;
    // if off screen -> deactivate and reset timer
    if (ufo.x < -ufo.width - 10 || ufo.x > scene.width + ufo.width + 10) {
      ufo.active = false;
      ufoSpawnTimer = randRange(ufoSpawnIntervalMin, ufoSpawnIntervalMax);
    }
  }
}

function drawGameState() {
  // draw ship
  brush.fillStyle = "Black";
  brush.fillRect(ship.x, ship.y, ship.width, ship.height);

  // draw projectiles
  brush.fillStyle = "Black";
  for (let projectile of projectiles) {
    if (projectile.active) {
      brush.fillRect(
        projectile.x,
        projectile.y,
        projectile.width,
        projectile.height
      );
    }
  }

  // draw invaders
  for (let invader of NPC.entities) {
    if (invader.active) {
      brush.fillStyle = invader.color;
      brush.fillRect(invader.x, invader.y, NPC.width, NPC.height);
    }
  }

  // draw UFO
  if (ufo.active) {
    brush.fillStyle = "purple";
    brush.fillRect(ufo.x, ufo.y, ufo.width, ufo.height);
  }

  // draw HUD: score and wave
  brush.fillStyle = "black";
  brush.font = "18px serif";
  brush.fillText(`Score: ${score}`, 10, 20);
  brush.fillText(`High: ${highScore}`, 110, 20);
  brush.fillText(`Wave: ${waveNumber + 1}`, 220, 20);
}

function drawGameOver() {
  brush.font = "40px serif";
  brush.fillStyle = "black";
  brush.fillText("GAME OVER", 100, 120);

  brush.font = "24px serif";
  brush.fillText(`Final score: ${score}`, 100, 160);
  brush.fillText(`High score: ${highScore}`, 100, 200);

  brush.font = "18px serif";
  brush.fillText("Press SPACE to return to menu", 100, 240);
}

function startPlay() {
  // reset score and wave
  score = 0;
  waveNumber = 0;
  resetForNewWave();
  currentState = STATES.PLAY;
}

function showHigScores() {
  // toggle the menu flag to show high score overlay
  MENU.showingHighScore = true;
}

//#endregion

//#region Utility functions ----------------------------------------------------------

function getBrush() {
  return scene.getContext("2d");
}

function clearScreen() {
  if (brush) {
    brush.clearRect(0, 0, scene.width, scene.height);
  }
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function overlaps(x1, y1, w1, h1, x2, y2, w2, h2) {
  if (x1 + w1 < x2 || x2 + w2 < x1) {
    return false;
  }

  if (y1 + h1 < y2 || y2 + h2 < y1) {
    return false;
  }

  return true;
}

function randRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

//#endregion
