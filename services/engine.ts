
import { 
  GameState, Player, Bullet, Vector2, Team, WeaponType, 
  GameMode, ControlPoint, Obstacle, GameSetup, GameSettings, Difficulty, LootItem, Zone, FireMode 
} from '../types';
import { 
  WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS, PLAYER_SPEED, SPRINT_MULTIPLIER,
  WEAPONS, TEAM_COLORS, CANVAS_WIDTH, CANVAS_HEIGHT, OPERATORS, GUN_GAME_ORDER 
} from '../constants';
import { generateMap, getSpawnPoint } from './mapGenerator';
import { soundManager } from './soundManager';

// --- MATH HELPERS ---
const dist = (v1: Vector2, v2: Vector2) => Math.sqrt((v1.x - v2.x)**2 + (v1.y - v2.y)**2);
const normalize = (v: Vector2) => {
  const d = Math.sqrt(v.x**2 + v.y**2);
  return d === 0 ? {x:0, y:0} : {x: v.x/d, y: v.y/d};
};
const checkRectCollide = (circle: {x: number, y: number, r: number}, rect: Obstacle) => {
  const testX = circle.x < rect.x ? rect.x : circle.x > rect.x + rect.w ? rect.x + rect.w : circle.x;
  const testY = circle.y < rect.y ? rect.y : circle.y > rect.y + rect.h ? rect.y + rect.h : circle.y;
  const distX = circle.x - testX;
  const distY = circle.y - testY;
  return (distX*distX + distY*distY) <= (circle.r*circle.r);
};

// --- INITIAL STATE ---
export const createInitialState = (setup: GameSetup, settings: GameSettings): GameState => {
  // GENERATE MAP BASED ON SELECTION
  const mapData = generateMap(setup.mapId, setup.mode);
  
  const players: Player[] = [];
  const selectedOperator = OPERATORS.find(op => op.id === setup.operatorId) || OPERATORS[0];
  
  const isSoloMode = setup.mode === GameMode.FFA || setup.mode === GameMode.GUN_GAME || setup.mode === GameMode.BATTLE_ROYALE;
  const isBR = setup.mode === GameMode.BATTLE_ROYALE;
  const isFFA = isSoloMode;

  // DETERMINE BOT COUNTS
  // If Solo Mode (BR, FFA), use the generic 'botCount' setting as the total number of enemies.
  // If Team Mode, use the specific ally/enemy sliders.
  let targetAllyCount = 0;
  let targetEnemyCount = 0;

  if (isSoloMode) {
      targetAllyCount = 0;
      targetEnemyCount = settings.botCount;
  } else {
      targetAllyCount = settings.allyCount;
      targetEnemyCount = settings.enemyCount;
  }

  // Helper to ensure valid spawn
  const getSafeSpawn = (team: Team): Vector2 => {
      let attempts = 0;
      let pos = getSpawnPoint(team, mapData.mapWidth, mapData.mapHeight);
      
      while (attempts < 20) {
          let collided = false;
          // Check against obstacles
          for (const obs of mapData.obstacles) {
              if (checkRectCollide({x: pos.x, y: pos.y, r: PLAYER_RADIUS + 5}, obs)) {
                  collided = true;
                  break;
              }
          }
          // Check against existing players (prevent stacking)
          if (!collided) {
              for (const p of players) {
                  if (dist(pos, p.pos) < PLAYER_RADIUS * 3) {
                      collided = true;
                      break;
                  }
              }
          }
          
          if (!collided) return pos;
          pos = getSpawnPoint(team, mapData.mapWidth, mapData.mapHeight);
          attempts++;
      }
      return pos; // Fallback to random if failed
  };

  // Create Human Player
  players.push({
    id: 'player',
    pos: getSafeSpawn(isFFA ? Team.NONE : Team.ALLIED),
    radius: PLAYER_RADIUS,
    active: true,
    team: isFFA ? Team.NONE : Team.ALLIED,
    angle: 0,
    health: 100 * selectedOperator.healthMult,
    maxHealth: 100 * selectedOperator.healthMult,
    speed: PLAYER_SPEED * selectedOperator.speedMult,
    weapon: isBR ? WeaponType.KNIFE : (setup.mode === GameMode.GUN_GAME ? GUN_GAME_ORDER[0] : setup.weapon),
    ammo: isBR ? 0 : WEAPONS[setup.mode === GameMode.GUN_GAME ? GUN_GAME_ORDER[0] : setup.weapon].magSize,
    isReloading: false,
    reloadTimer: 0,
    lastShotTime: 0,
    kills: 0,
    deaths: 0,
    isBot: false
  });

  // Helper to create a single bot
  const createBot = (id: string, team: Team) => {
    // Randomize Bot Weapons
    const botWeapons = [WeaponType.RIFLE, WeaponType.SMG, WeaponType.SHOTGUN];
    let weapon = botWeapons[Math.floor(Math.random() * botWeapons.length)];
    if (setup.mode === GameMode.GUN_GAME) weapon = GUN_GAME_ORDER[0];
    if (isBR) weapon = WeaponType.KNIFE;
    
    // Adjust bot stats based on difficulty
    let botHealth = 100;
    let botSpeed = PLAYER_SPEED * 0.9;
    
    if (settings.difficulty === Difficulty.RECRUIT) {
        botHealth = 80;
        botSpeed = PLAYER_SPEED * 0.7;
    } else if (settings.difficulty === Difficulty.ELITE) {
        botHealth = 120;
        botSpeed = PLAYER_SPEED * 1.0;
    }

    players.push({
      id: id,
      pos: getSafeSpawn(isFFA ? Team.NONE : team),
      radius: PLAYER_RADIUS,
      active: true,
      team: isFFA ? Team.NONE : team,
      angle: Math.random() * Math.PI * 2,
      health: botHealth,
      maxHealth: botHealth,
      speed: botSpeed,
      weapon: weapon,
      ammo: isBR ? 0 : 100,
      isReloading: false,
      reloadTimer: 0,
      lastShotTime: 0,
      kills: 0,
      deaths: 0,
      isBot: true,
      state: 'PATROL',
      target: null
    });
  };

  // Create Ally Bots
  for (let i = 0; i < targetAllyCount; i++) {
      createBot(`bot-ally-${i}`, Team.ALLIED);
  }

  // Create Enemy Bots
  for (let i = 0; i < targetEnemyCount; i++) {
      // In FFA/BR, createBot forces Team.NONE, so passing AXIS here is fine as a placeholder
      createBot(`bot-axis-${i}`, Team.AXIS);
  }

  // Handle Hardpoint setup
  if (setup.mode === GameMode.HARDPOINT) {
      mapData.controlPoints.forEach(cp => cp.active = false);
      if (mapData.controlPoints.length > 0) mapData.controlPoints[0].active = true;
  }

  // Handle BR Zone
  let zone: Zone | undefined;
  if (isBR) {
      zone = {
          x: mapData.mapWidth / 2,
          y: mapData.mapHeight / 2,
          radius: mapData.mapWidth * 0.8,
          targetRadius: mapData.mapWidth * 0.5,
          shrinkTimer: 30, // Initial safe time
          state: 'WAITING',
          damagePerTick: 0.5
      };
  }

  return {
    mode: setup.mode,
    difficulty: settings.difficulty,
    mapId: setup.mapId,
    mapTheme: mapData.mapTheme,
    players,
    bullets: [],
    obstacles: mapData.obstacles,
    buildings: mapData.buildings,
    controlPoints: mapData.controlPoints,
    loot: mapData.loot,
    zone,
    mapWidth: mapData.mapWidth,
    mapHeight: mapData.mapHeight,
    camera: { x: 0, y: 0 },
    scores: { [Team.ALLIED]: 0, [Team.AXIS]: 0, [Team.NONE]: 0 },
    timeRemaining: 1080, // 18 minutes (1080 seconds)
    killFeed: [],
    hardpointTimer: 1800 // 30 seconds @ 60fps
  };
};

// --- GAME LOGIC LOOP ---
export const updateGame = (state: GameState, input: any, dt: number, settings: GameSettings, viewW: number = CANVAS_WIDTH, viewH: number = CANVAS_HEIGHT): GameState => {
  const newState = { ...state };
  const now = Date.now();
  
  // Update Game Clock
  newState.timeRemaining = Math.max(0, newState.timeRemaining - (dt / 1000));
  
  const isTeamMode = newState.mode !== GameMode.FFA && newState.mode !== GameMode.GUN_GAME && newState.mode !== GameMode.BATTLE_ROYALE;
  const isBR = newState.mode === GameMode.BATTLE_ROYALE;

  // --- ZONE LOGIC ---
  if (isBR && newState.zone) {
      if (newState.zone.state === 'WAITING') {
          newState.zone.shrinkTimer -= dt/1000;
          if (newState.zone.shrinkTimer <= 0) {
              newState.zone.state = 'SHRINKING';
          }
      } else if (newState.zone.state === 'SHRINKING') {
          // Slow down the shrink speed significantly so it's playable on large maps
          newState.zone.radius -= (newState.mapWidth / 300) * (dt/1000); 
          if (newState.zone.radius <= newState.zone.targetRadius) {
              newState.zone.state = 'WAITING';
              newState.zone.targetRadius = newState.zone.radius / 2;
              newState.zone.shrinkTimer = 30;
              if (newState.zone.targetRadius < 50) newState.zone.targetRadius = 0;
          }
      }
      
      // Damage Players Outside Zone
      newState.players.forEach(p => {
          if (p.active) {
              const d = dist(p.pos, {x: newState.zone!.x, y: newState.zone!.y});
              if (d > newState.zone!.radius) {
                  p.health -= newState.zone!.damagePerTick;
                  if (p.health <= 0) {
                      p.active = false;
                      p.deaths++;
                      newState.killFeed.unshift(`${p.id==='player'?'YOU':p.id.toUpperCase()} died to the ZONE`);
                      soundManager.play('DIE');
                  }
              }
          }
      });
  }

  // 1. UPDATE PLAYERS
  newState.players.forEach(p => {
    if (!p.active) return; 

    // --- MOVEMENT ---
    let moveDir = { x: 0, y: 0 };
    
    if (!p.isBot) {
      // Human Input
      if (input.keys['w']) moveDir.y -= 1;
      if (input.keys['s']) moveDir.y += 1;
      if (input.keys['a']) moveDir.x -= 1;
      if (input.keys['d']) moveDir.x += 1;
      
      // Aim
      p.angle = Math.atan2(input.mouse.y + newState.camera.y - p.pos.y, input.mouse.x + newState.camera.x - p.pos.x);

      // --- FIRE LOGIC (MANUAL VS AUTO) ---
      let shouldShoot = input.mouseDown;
      
      // Auto Fire: Trigger if aiming at an enemy
      if (settings.fireMode === FireMode.AUTO && !shouldShoot) {
          const mouseWorldX = input.mouse.x + newState.camera.x;
          const mouseWorldY = input.mouse.y + newState.camera.y;
          const mouseWorldPos = {x: mouseWorldX, y: mouseWorldY};
          
          // Check if cursor is over any active enemy
          const targetFound = newState.players.some(enemy => 
              enemy.active && 
              enemy.id !== p.id && // Don't shoot self
              (isTeamMode ? enemy.team !== p.team : true) && // Don't shoot allies
              dist(mouseWorldPos, enemy.pos) < enemy.radius + 15 && // Hitbox tolerance
              !checkWallBetween(p.pos, enemy.pos, newState.obstacles) // Optional: prevent wall banging for auto-fire? 
          );
          
          if (targetFound) shouldShoot = true;
      }

      if (shouldShoot && !p.isReloading && p.ammo > 0) {
         tryFireWeapon(p, newState, now);
      }
      // Reload
      if (input.keys['r'] && !p.isReloading && p.ammo < WEAPONS[p.weapon].magSize && p.weapon !== WeaponType.KNIFE) {
        p.isReloading = true;
        p.reloadTimer = now + WEAPONS[p.weapon].reloadTime;
        soundManager.play('RELOAD');
      }

    } else {
      // Bot Logic
      updateBotAI(p, newState, now);
    }

    // Normalize and Move
    if (moveDir.x !== 0 || moveDir.y !== 0 || (p.isBot && p.target)) {
        if (p.isBot && p.target) {
            const dx = p.target.x - p.pos.x;
            const dy = p.target.y - p.pos.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d > 10) {
                moveDir = { x: dx/d, y: dy/d };
            } else {
                if (p.state !== 'ZONE_MOVE') {
                   p.target = null; // Reached target only if not constantly running from zone
                }
            }
        } else if (!p.isBot) {
             const len = Math.sqrt(moveDir.x**2 + moveDir.y**2);
             if (len > 0) moveDir = { x: moveDir.x/len, y: moveDir.y/len };
        }

        const sprint = (!p.isBot && input.keys['Shift']) ? SPRINT_MULTIPLIER : 1.0;
        const newX = p.pos.x + moveDir.x * p.speed * sprint;
        const newY = p.pos.y + moveDir.y * p.speed * sprint;

        const nearbyObstacles = newState.obstacles.filter(o => 
             Math.abs(o.x - p.pos.x) < 200 && Math.abs(o.y - p.pos.y) < 200 && o.type !== 'WINDOW' 
        );

        let isStuck = false;
        for (const obs of nearbyObstacles) {
            if (checkRectCollide({x: p.pos.x, y: p.pos.y, r: p.radius}, obs)) {
                isStuck = true;
                break;
            }
        }

        if (isStuck) {
             // If already stuck, try to move out, but ensure we don't go deeper.
             // Simple fix: Allow movement if it increases distance? 
             // For now, teleport out logic handled in Spawn, so this is just "don't move further in"
             p.pos.x = newX;
             p.pos.y = newY;
        } else {
             let collidedX = false;
             let collidedY = false;

             for (const obs of nearbyObstacles) {
                 if (checkRectCollide({x: newX, y: p.pos.y, r: p.radius}, obs)) collidedX = true;
                 if (checkRectCollide({x: p.pos.x, y: newY, r: p.radius}, obs)) collidedY = true;
             }

             if (!collidedX) p.pos.x = newX;
             if (!collidedY) p.pos.y = newY;
        }
    }

    // Reload Logic
    if (p.isReloading && now > p.reloadTimer) {
        p.ammo = WEAPONS[p.weapon].magSize;
        p.isReloading = false;
    }
    
    // Loot Pickup Logic (BR Only)
    if (isBR) {
        // Auto pickup if KNIFE
        if (p.weapon === WeaponType.KNIFE) {
            // Find nearest loot
            const nearbyLootIdx = newState.loot.findIndex(l => l.active && dist(p.pos, l.pos) < p.radius + 15);
            if (nearbyLootIdx !== -1) {
                const loot = newState.loot[nearbyLootIdx];
                p.weapon = loot.weapon;
                p.ammo = WEAPONS[loot.weapon].magSize;
                loot.active = false;
                soundManager.play('RELOAD');
            }
        }
    }

    // Constraints - Use state.mapWidth instead of constant
    p.pos.x = Math.max(0, Math.min(newState.mapWidth, p.pos.x));
    p.pos.y = Math.max(0, Math.min(newState.mapHeight, p.pos.y));
  });

  // 2. UPDATE BULLETS
  newState.bullets = newState.bullets.filter(b => b.active);
  newState.bullets.forEach(b => {
    const step = 25; 
    b.pos.x += b.velocity.x * step;
    b.pos.y += b.velocity.y * step;
    b.distanceTraveled += step;

    if (b.distanceTraveled > b.maxDistance) b.active = false;

    // Hit Players
    for (const p of newState.players) {
      if (!p.active) continue;
      if (isTeamMode) {
          if (p.team === b.team) continue;
      } else {
          if (p.id === b.ownerId) continue;
      }

      if (dist(b.pos, p.pos) < p.radius + 5) {
        b.active = false;
        p.health -= b.damage;
        soundManager.play('HIT');
        if (p.health <= 0) {
            handleKill(newState, b, p);
        }
        break;
      }
    }

    // Hit Walls
    for (const w of newState.obstacles) {
      if (w.type === 'WINDOW' || w.type === 'COVER_HALF') continue; 
      // Optimization: Simple bounding check first
      if (b.pos.x < w.x || b.pos.x > w.x + w.w || b.pos.y < w.y || b.pos.y > w.y + w.h) continue;

      if (checkRectCollide({x: b.pos.x, y: b.pos.y, r: 2}, w)) {
          b.active = false;
          break;
      }
    }
  });

  // 3. UPDATE CONTROL POINTS
  if (newState.mode === GameMode.DOMINATION || newState.mode === GameMode.HARDPOINT) {
      // ... existing CP logic ...
      if (newState.mode === GameMode.HARDPOINT && newState.hardpointTimer !== undefined) {
          newState.hardpointTimer--;
          if (newState.hardpointTimer <= 0) {
              const currentIdx = newState.controlPoints.findIndex(cp => cp.active);
              const nextIdx = (currentIdx + 1) % newState.controlPoints.length;
              newState.controlPoints.forEach((cp, i) => cp.active = (i === nextIdx));
              newState.controlPoints.forEach(cp => { cp.captureProgress = 0; cp.team = Team.NONE; });
              newState.hardpointTimer = 1800; 
              soundManager.play('CAPTURE');
          }
      }

      newState.controlPoints.forEach(cp => {
          if (!cp.active && newState.mode === GameMode.HARDPOINT) return; 

          let alliedCount = 0;
          let axisCount = 0;
          newState.players.forEach(p => {
              if (p.active && dist(p.pos, cp.pos) < cp.radius) {
                  if (p.team === Team.ALLIED) alliedCount++;
                  if (p.team === Team.AXIS) axisCount++;
              }
          });

          if (alliedCount > 0 && axisCount === 0) {
              if (cp.team !== Team.ALLIED) {
                  cp.captureProgress += 1;
                  if (cp.captureProgress >= 100) {
                      cp.team = Team.ALLIED;
                      cp.captureProgress = 0;
                      soundManager.play('CAPTURE');
                  }
              }
          } else if (axisCount > 0 && alliedCount === 0) {
              if (cp.team !== Team.AXIS) {
                  cp.captureProgress += 1;
                  if (cp.captureProgress >= 100) {
                      cp.team = Team.AXIS;
                      cp.captureProgress = 0;
                      soundManager.play('CAPTURE');
                  }
              }
          } else if (alliedCount === 0 && axisCount === 0 && cp.captureProgress > 0) {
              cp.captureProgress = Math.max(0, cp.captureProgress - 0.5); 
          }

          if (newState.mode === GameMode.HARDPOINT && cp.team !== Team.NONE) {
              if (now % 60 === 0) newState.scores[cp.team] += 1;
          }
      });
      
      if (newState.mode === GameMode.DOMINATION && now % 60 === 0) {
         newState.controlPoints.forEach(cp => {
             if (cp.team !== Team.NONE) {
                 newState.scores[cp.team] += 1;
             }
         });
      }
  }

  // 4. RESPAWN - DISABLE FOR BR
  if (!isBR) {
      newState.players.forEach(p => {
          if (!p.active) {
              if (Math.random() < 0.01) { 
                 p.active = true;
                 p.health = p.maxHealth;
                 // Use Safe Spawn on Respawn
                 let attempts = 0;
                 let newPos = getSpawnPoint(p.team === Team.NONE ? (Math.random() > 0.5 ? Team.ALLIED : Team.AXIS) : p.team, newState.mapWidth, newState.mapHeight);
                 while (attempts < 5) {
                    let ok = true;
                    for (const obs of newState.obstacles) {
                        if (checkRectCollide({x: newPos.x, y: newPos.y, r: PLAYER_RADIUS}, obs)) { ok = false; break; }
                    }
                    if (ok) break;
                    newPos = getSpawnPoint(p.team === Team.NONE ? (Math.random() > 0.5 ? Team.ALLIED : Team.AXIS) : p.team, newState.mapWidth, newState.mapHeight);
                    attempts++;
                 }
                 p.pos = newPos;
                 
                 if (newState.mode === GameMode.GUN_GAME) {
                     p.ammo = WEAPONS[p.weapon].magSize;
                 } else {
                     p.ammo = WEAPONS[p.weapon].magSize;
                 }
              }
          }
      });
  }

  // 5. CAMERA FOLLOW
  const player = newState.players.find(p => p.id === 'player');
  if (player) {
      // Use dynamic view dimensions for camera centering
      newState.camera.x = player.pos.x - viewW / 2;
      newState.camera.y = player.pos.y - viewH / 2;
  }

  return newState;
};

const tryFireWeapon = (p: Player, state: GameState, now: number) => {
    const weapon = WEAPONS[p.weapon];
    // Check ammo (except knife)
    if (p.weapon !== WeaponType.KNIFE && p.ammo <= 0) return;

    if (now - p.lastShotTime >= weapon.fireRate) {
        p.lastShotTime = now;
        if (p.weapon !== WeaponType.KNIFE) p.ammo--;
        
        soundManager.play(`SHOOT_${p.weapon}`);

        let accuracyMod = 1.0;
        if (p.isBot) {
            if (state.difficulty === Difficulty.RECRUIT) accuracyMod = 2.0; 
            if (state.difficulty === Difficulty.ELITE) accuracyMod = 0.5; 
        }

        const spread = (Math.random() - 0.5) * weapon.accuracy * accuracyMod;
        const angle = p.angle + spread;
        
        state.bullets.push({
            id: `b-${now}-${Math.random()}`,
            pos: { x: p.pos.x, y: p.pos.y },
            radius: 2,
            active: true,
            velocity: { x: Math.cos(angle), y: Math.sin(angle) },
            damage: weapon.damage,
            team: p.team,
            ownerId: p.id, 
            distanceTraveled: 0,
            maxDistance: weapon.range,
            color: weapon.color
        });

        if (p.weapon === WeaponType.SHOTGUN || p.weapon === WeaponType.AUTO_SHOTGUN) {
            for(let i=0; i<4; i++) {
                const sSpread = (Math.random() - 0.5) * weapon.accuracy * 2 * accuracyMod;
                const sAngle = p.angle + sSpread;
                state.bullets.push({
                    id: `b-${now}-${Math.random()}`,
                    pos: { x: p.pos.x, y: p.pos.y },
                    radius: 2,
                    active: true,
                    velocity: { x: Math.cos(sAngle), y: Math.sin(sAngle) },
                    damage: weapon.damage,
                    team: p.team,
                    ownerId: p.id,
                    distanceTraveled: 0,
                    maxDistance: weapon.range,
                    color: weapon.color
                });
            }
        }
    }
};

const updateBotAI = (bot: Player, state: GameState, now: number) => {
    let nearestEnemy: Player | null = null;
    let minDst = Infinity;
    const isTeamMode = state.mode !== GameMode.FFA && state.mode !== GameMode.GUN_GAME && state.mode !== GameMode.BATTLE_ROYALE;
    const isBR = state.mode === GameMode.BATTLE_ROYALE;

    let visionRange = 500;
    let reactionChance = 0.1;
    
    if (state.difficulty === Difficulty.RECRUIT) {
        visionRange = 400;
        reactionChance = 0.05;
    } else if (state.difficulty === Difficulty.ELITE) {
        visionRange = 700;
        reactionChance = 0.2;
    }

    // BR: Safety First
    if (isBR && state.zone) {
        const distToCenter = dist(bot.pos, {x: state.zone.x, y: state.zone.y});
        if (distToCenter > state.zone.radius * 0.8) {
            bot.state = 'ZONE_MOVE';
            bot.target = {x: state.zone.x, y: state.zone.y};
            const lookAngle = Math.atan2(bot.target.y - bot.pos.y, bot.target.x - bot.pos.x);
            bot.angle = lookAngle;
            
            // Allow checking for enemies while running, but prioritize moving
            // Don't return here, let enemy check happen below.
        } else if (bot.weapon === WeaponType.KNIFE) {
             // Loot Priority if safe and knifing
            bot.state = 'LOOT';
            const nearbyLoot = state.loot.find(l => l.active && dist(bot.pos, l.pos) < 500);
            if (nearbyLoot) {
                bot.target = nearbyLoot.pos;
                const lookAngle = Math.atan2(bot.target.y - bot.pos.y, bot.target.x - bot.pos.x);
                bot.angle = lookAngle;
                return; // Focus on loot, ignore enemies if just knifing
            }
        }
    }

    for (const other of state.players) {
        if (other.active && other.id !== bot.id) {
             if (isTeamMode && other.team === bot.team) continue;

            const d = dist(bot.pos, other.pos);
            if (d < visionRange && d < minDst) { 
                if (!checkWallBetween(bot.pos, other.pos, state.obstacles)) {
                    nearestEnemy = other;
                    minDst = d;
                }
            }
        }
    }

    if (nearestEnemy) {
        // If we are running from zone, don't switch state to ATTACK, just shoot
        if (bot.state !== 'ZONE_MOVE') {
            bot.state = 'ATTACK';
            bot.target = nearestEnemy.pos; 
            bot.angle = Math.atan2(nearestEnemy.pos.y - bot.pos.y, nearestEnemy.pos.x - bot.pos.x);
        } else {
            // We are moving to zone, but see enemy. Face them to shoot, but don't change move target.
            // Actually, for simple AI, just facing them is enough, movement logic uses bot.target which is Zone center.
            bot.angle = Math.atan2(nearestEnemy.pos.y - bot.pos.y, nearestEnemy.pos.x - bot.pos.x);
        }
        
        if (dist(bot.pos, nearestEnemy.pos) < WEAPONS[bot.weapon].range * 0.8) {
             if (Math.random() < reactionChance) 
                tryFireWeapon(bot, state, now);
        }
    } else {
        if (bot.state !== 'CAPTURE' && bot.state !== 'PATROL' && bot.state !== 'ZONE_MOVE' && bot.state !== 'LOOT') {
            bot.state = 'PATROL';
            bot.target = null;
        }

        if (state.mode === GameMode.DOMINATION || state.mode === GameMode.HARDPOINT) {
            bot.state = 'CAPTURE';
            if (!bot.target || (Math.random() < 0.005)) { 
                 let targetCP;
                 if (state.mode === GameMode.HARDPOINT) {
                     targetCP = state.controlPoints.find(cp => cp.active);
                 } else {
                     targetCP = state.controlPoints.find(cp => cp.team !== bot.team) || state.controlPoints[0];
                 }
                 if (targetCP) bot.target = targetCP.pos;
            }
        } else if (bot.state === 'PATROL') {
             if (!bot.target || dist(bot.pos, bot.target) < 20) {
                 bot.target = getSpawnPoint(Math.random() > 0.5 ? Team.ALLIED : Team.AXIS, state.mapWidth, state.mapHeight); 
             }
        }
        
        // Face movement direction if not attacking
        if (bot.target && !nearestEnemy) {
             const lookAngle = Math.atan2(bot.target.y - bot.pos.y, bot.target.x - bot.pos.x);
             bot.angle = lookAngle;
        }
    }
};

const checkWallBetween = (p1: Vector2, p2: Vector2, obstacles: Obstacle[]): boolean => {
    const steps = 10;
    // Bounding box optimization
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    for (const o of obstacles) {
         if (o.type !== 'WALL') continue;
         // Skip obstacles far outside the line segment
         if (o.x > maxX || o.x + o.w < minX || o.y > maxY || o.y + o.h < minY) continue;

         // Raycast check
         for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const x = p1.x + (p2.x - p1.x) * t;
            const y = p1.y + (p2.y - p1.y) * t;
            if (checkRectCollide({x, y, r: 2}, o)) return true;
         }
    }
    return false;
};

const handleKill = (state: GameState, bullet: Bullet, victim: Player) => {
    victim.active = false;
    victim.deaths++;
    soundManager.play('DIE');
    
    // Find killer using ownerId
    const killer = state.players.find(p => p.id === bullet.ownerId); 
    if (killer) {
        killer.kills++; 
        
        // GUN GAME LOGIC
        if (state.mode === GameMode.GUN_GAME) {
             const currentIndex = GUN_GAME_ORDER.indexOf(killer.weapon);
             if (currentIndex < GUN_GAME_ORDER.length - 1) {
                 killer.weapon = GUN_GAME_ORDER[currentIndex + 1];
                 killer.ammo = WEAPONS[killer.weapon].magSize;
                 soundManager.play('CAPTURE'); 
             } else {
                 state.scores[killer.team === Team.NONE ? Team.ALLIED : killer.team] = 100;
                 if (killer.id === 'player') state.scores[Team.ALLIED] = 100; 
                 else state.scores[Team.AXIS] = 100;
             }
        }
    }
    
    // Score updates (Disable for BR so score limit doesn't trigger)
    if (state.mode !== GameMode.GUN_GAME && state.mode !== GameMode.BATTLE_ROYALE) {
        state.scores[bullet.team] += 10; 
        if (bullet.team === Team.NONE && killer) {
             if (killer.id === 'player') state.scores[Team.ALLIED] += 10; 
             else state.scores[Team.AXIS] += 10; 
        }
    }
    
    state.killFeed.unshift(`${killer ? (killer.id==='player'?'YOU':killer.id.toUpperCase()) : 'UNK'} eliminated ${victim.id==='player'?'YOU':victim.id.toUpperCase()}`);
    if (state.killFeed.length > 5) state.killFeed.pop();
};
