//#region CONSTANTS ------------------------------------------------------------------
const FPS = 1000 / 60;
const STATES = { MENU: 1, PLAY: 2, GAMEOVER: 3 };

//#endregion

//#region Game variables -------------------------------------------------------------
const scene = document.getElementById("scene");
const brush = getBrush();

let currentState = STATES.IDLE;

let score = 0;
let highScore = 0;
let showingHighScore = false;
let wave = 1;

// ------

const MENU = {
  currentIndex: 0,
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

const projectieWidth = 3;
const projectileHeight = 5;
const projectileSpeed = 2;
const projectileCooldown = 40;
let cooldown = 0;
let projectiles = [];

// ------

const NPC = {
  width: 50,
  height: 20,
  padding: 20,
  sx: 50,
  sy: 20,
  speed: 1,
  direction: 1,
  enteties: [],
};

const UFO = {
  x: 0,
  y: 5,
  width: 60,
  height: 20,
  active: false,
  speed: 2,
  bonus: 200,
};

let ufoSpawnTimer = 0;

const npcPerRow = Math.floor(
  (scene.width - NPC.height) / (NPC.width + NPC.height)
);

// ------

// Movment back and forth of NPC´s are govered by counting up to a level
const maxMovmentSteps = 50;
let movmentSteps = maxMovmentSteps;

// ------
// The following is a simple way of
let controllKeys = {
  ArrowDown: false,
  ArrowUp: false,
  ArrowLeft: false,
  ArrowRight: false,
  " ": false, // space
};

let keyConsumed = {};

window.addEventListener("keydown", function (e) {
  if (!controllKeys[e.key]) {
    controllKeys[e.key] = true;
    keyConsumed[e.key] = false;
  }
});

window.addEventListener("keyup", function (e) {
  controllKeys[e.key] = false;
  keyConsumed[e.key] = false;
});

//#endregion

//#region Game engine ----------------------------------------------------------------

function init() {
  NPC.speed = 1;
  currentState = STATES.MENU;
  update();
}

function buildNewWave() {
  NPC.enteties = [];
  const rowColors = ["Purple", "Red", "Cyan", "Yellow"];

  let y = NPC.sy;

  for (let row = 0; row < 4; row++) {
    let x = NPC.sx;
    for (let i = 0; i < npcPerRow; i++) {
      NPC.enteties.push({
        x,
        y,
        color: rowColors[row],
        active: true,
        width: NPC.width,
        height: NPC.height,
        rowIndex: row,
      });
      x += NPC.width + NPC.padding;
    }
    y += NPC.height + 20;
  }
}

function update(time) {
  if (currentState === STATES.MENU) {
    updateMenu(time);
  } else if (currentState === STATES.PLAY) {
    updateGame(time);
  } else if (currentState === STATES.GAMEOVER) {
    updateGameOver(time);
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
  if (showingHighScore) {
    if (controllKeys[" "] && !keyConsumed[" "]) {
      showingHighScore = false;
      keyConsumed[" "] = true;
    }
    return;
  }

  if (controllKeys[" "] && !keyConsumed[" "]) {
    MENU.buttons[MENU.currentIndex].action();
    keyConsumed[" "] = true;
  }

  if (controllKeys.ArrowUp) {
    MENU.currentIndex--;
  } else if (controllKeys.ArrowDown) {
    MENU.currentIndex++;
  }

  MENU.currentIndex = clamp(MENU.currentIndex, 0, MENU.buttons.length - 1);
}

function drawMenu() {
  clearScreen();
  let sy = 100;

  if (showingHighScore) {
    brush.fillStyle = "black";
    brush.font = "40px Arial";
    brush.fillText("HIGH SCORE", 100, 100);

    brush.font = "30px Arial";
    brush.fillText("Best: " + highScore, 100, 150);

    brush.font = "20px Arial";
    brush.fillText("Press SPACE to return", 100, 250);

    return;
  }

  for (let i = 0; i < MENU.buttons.length; i++) {
    let text = MENU.buttons[i].text;
    if (i == MENU.currentIndex) {
      text = `* ${text} *`;
    }
    brush.fillStyle = "black";
    brush.font = "50px serif";
    brush.fillText(text, 100, sy);
    sy += 50;

    brush.fillStyle = "black";
    brush.font = "50px Arial";
    brush.fillText("SPACE INVADERS - SE", 50, 50);
  }
}

function updateGame(dt) {
  updateShip();
  updateProjectiles();
  updateInvaders();
  updateUFO();
  if (NPC.enteties.every((inv) => !inv.active)) {
    buildNewWave();
    wave++;
    ship.x = scene.width * 0.5 - ship.width * 0.5;
    ship.velocityX = 0;
  }
  if (isGameOver()) {
    keyConsumed[" "] = true;
    currentState = STATES.GAMEOVER;
  }
}

function updateInvaders() {
  let ty = 0;

  if (movmentSteps >= maxMovmentSteps * 2) {
    movmentSteps = 0;
    NPC.direction *= -1;
    ty = NPC.height;
  }

  let tx = NPC.speed * NPC.direction;

  for (let invader of NPC.enteties) {
    if (!invader.active) continue;

    let nextX = invader.x + tx;
    if (nextX < 0 || nextX + NPC.width > scene.width) {
      movmentSteps = maxMovmentSteps * 2;
      return;
    }
  }

  for (let invader of NPC.enteties) {
    if (invader.active) {
      invader.x += tx;
      invader.y += ty;

      if (isShot(invader)) {
        invader.active = false;
      }
    }
  }

  movmentSteps++;
}

function updateUFO() {
  if (!UFO.active) {
    ufoSpawnTimer--;
    if (ufoSpawnTimer <= 0) {
      UFO.active = true;
      UFO.x = -UFO.width;
      ufoSpawnTimer = Math.floor(300 + Math.random() * 600);
    }
    return;
  }

  UFO.x += UFO.speed;

  if (isShot(UFO)) {
    UFO.active = false;
    score += UFO.bonus;
  }

  if (UFO.x > scene.width) {
    UFO.active = false;
  }
}

function updateGameOver(dt) {
  if (score > highScore) highScore = score;

  if (controllKeys[" "] && !keyConsumed[" "]) {
    currentState = STATES.MENU;
    keyConsumed[" "] = true;
  }
}

function isGameOver() {
  for (let invader of NPC.enteties) {
    if (invader.active) {
      if (invader.y + invader.height >= ship.y) {
        return true;
      }
    }
  }
  return false;
}

function isShot(target) {
  for (let i = 0; i < projectiles.length; i++) {
    let projectile = projectiles[i];
    if (
      overlaps(
        target.x,
        target.y,
        target.width,
        target.height,
        projectile.x,
        projectile.y,
        projectile.width,
        projectile.height
      )
    ) {
      projectile.active = false;

      if (target.rowIndex !== undefined) {
        const rowScore = [40, 30, 20, 10];
        score += rowScore[target.rowIndex];
      } else {
        score += UFO.bonus;
      }

      return true;
    }
  }

  return false;
}

function updateShip() {
  if (controllKeys.ArrowLeft) {
    ship.velocityX = -ship.maxVelocity;
  } else if (controllKeys.ArrowRight) {
    ship.velocityX = ship.maxVelocity;
  } else {
    ship.velocityX = 0;
  }

  let tmpX = ship.x + ship.velocityX;
  tmpX = clamp(tmpX, 0, scene.width - ship.width);
  ship.x = tmpX;

  cooldown--;

  if (controllKeys[" "] && cooldown <= 0) {
    projectiles.push({
      x: ship.x + ship.width * 0.5,
      y: ship.y,
      dir: -1,
      active: true,
      width: projectieWidth,
      height: projectileHeight,
    });
    cooldown = projectileCooldown;
  }
}

function updateProjectiles() {
  let activeProjectiles = [];
  for (let i = 0; i < projectiles.length; i++) {
    let projectile = projectiles[i];
    projectile.y += projectileSpeed * projectile.dir;
    if (projectile.y + projectileHeight > 0 && projectile.active) {
      activeProjectiles.push(projectile);
    }
  }
  projectiles = activeProjectiles;
}

function drawGameState() {
  brush.fillStyle = "Black";
  brush.fillRect(ship.x, ship.y, ship.width, ship.height);

  for (let projectile of projectiles) {
    if (projectile.active) {
      brush.fillRect(
        projectile.x,
        projectile.y,
        projectieWidth,
        projectileHeight
      );
    }
  }

  for (let invader of NPC.enteties) {
    if (invader.active) {
      brush.fillStyle = invader.color;
      brush.fillRect(invader.x, invader.y, NPC.width, NPC.height);
    }
  }

  if (UFO.active) {
    brush.fillStyle = "gray";
    brush.fillRect(UFO.x, UFO.y, UFO.width, UFO.height);
  }

  brush.fillStyle = "black";
  brush.font = "20px Arial";
  brush.fillText("Score: " + score, 10, 20);
  brush.fillText("Wave: " + wave, 560, 20);
}

function drawGameOver() {
  clearScreen();

  brush.fillStyle = "black";
  brush.font = "40px Arial";
  brush.fillText("GAME OVER", 100, 100);

  brush.font = "25px Arial";
  brush.fillText("Score: " + score, 100, 150);
  brush.fillText("High Score: " + highScore, 100, 190);
  brush.fillText("Wave reached: " + wave, 100, 230);

  brush.font = "20px Arial";
  brush.fillText("Press SPACE to return to menu", 100, 280);
}

function startPlay() {
  currentState = STATES.PLAY;
  score = 0;
  wave = 1;
  keyConsumed[" "] = false;
  ship.x = scene.width * 0.5 - ship.width * 0.5;
  ship.velocityX = 0;
  projectiles = [];
  buildNewWave();
  movmentSteps = 0;
  NPC.direction = 1;
  UFO.active = false;
  UFO.x = -UFO.width;
  ufoSpawnTimer = 0;
}

function showHigScores() {
  showingHighScore = true;
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
//#endregion
