
import { Building, Obstacle, Vector2, ControlPoint, Team, MapId, MapTheme, GameMode, LootItem, WeaponType } from '../types';
import { WORLD_WIDTH, WORLD_HEIGHT, WEAPONS } from '../constants';

export const generateMap = (mapId: MapId = MapId.URBAN, mode: GameMode = GameMode.TDM) => {
  const buildings: Building[] = [];
  const obstacles: Obstacle[] = [];
  const controlPoints: ControlPoint[] = [];
  const loot: LootItem[] = [];
  
  // DETERMINE MAP SCALE
  const isBR = mode === GameMode.BATTLE_ROYALE;
  const mapW = isBR ? WORLD_WIDTH * 2.5 : WORLD_WIDTH;
  const mapH = isBR ? WORLD_HEIGHT * 2.5 : WORLD_HEIGHT;

  let mapTheme: MapTheme = { 
      backgroundColor: '#1f2937', 
      gridColor: '#374151', 
      obstacleColor: '#000', 
      wallColor: '#4b5563', 
      roofColor: '#374151' 
  };

  // --- MAP THEMES ---
  switch (mapId) {
      case MapId.DESERT:
          mapTheme = { 
              backgroundColor: '#78350f', // deep dark brown/orange
              gridColor: '#92400e', 
              obstacleColor: '#5c2b0c', // rocks
              wallColor: '#b45309', // sandstone
              roofColor: '#d97706' 
          };
          break;
      case MapId.ARCTIC:
          mapTheme = { 
              backgroundColor: '#1e3a8a', // dark blue
              gridColor: '#1d4ed8', 
              obstacleColor: '#60a5fa', // ice
              wallColor: '#bfdbfe', 
              roofColor: '#93c5fd' 
          };
          break;
      case MapId.INDUSTRIAL:
          mapTheme = { 
              backgroundColor: '#171717', // neutral 900
              gridColor: '#404040', 
              obstacleColor: '#7f1d1d', // rusted red containers
              wallColor: '#525252', 
              roofColor: '#262626' 
          };
          break;
      case MapId.FOREST:
          mapTheme = { 
              backgroundColor: '#064e3b', // dark green
              gridColor: '#065f46', 
              obstacleColor: '#14532d', // trees
              wallColor: '#3f6212', // mossy walls
              roofColor: '#166534' 
          };
          break;
      default: // URBAN
          mapTheme = { 
              backgroundColor: '#1f2937', // gray 800
              gridColor: '#374151', 
              obstacleColor: '#000', 
              wallColor: '#4b5563', 
              roofColor: '#374151' 
          };
          break;
  }

  // --- BUILDER HELPERS ---
  const createBuilding = (x: number, y: number, w: number, h: number, rooms: number = 1, doorSides: ('top'|'bottom'|'left'|'right')[] = ['bottom']) => {
    const wallThick = 15;
    const buildingWalls: Obstacle[] = [];
    
    // Default Solid Walls
    const walls = {
        top: { x, y, w, h: wallThick },
        bottom: { x, y: y + h - wallThick, w, h: wallThick },
        left: { x, y, w: wallThick, h },
        right: { x: x + w - wallThick, y, w: wallThick, h }
    };

    // Helper to add a wall with a gap (door)
    const addWallWithDoor = (rect: {x:number, y:number, w:number, h:number}, isVertical: boolean) => {
        const doorSize = 60;
        if (isVertical) {
            // Door in middle of vertical wall
            const segmentH = (rect.h - doorSize) / 2;
            buildingWalls.push({ ...rect, h: segmentH, type: 'WALL' }); // Top part
            buildingWalls.push({ ...rect, y: rect.y + rect.h - segmentH, h: segmentH, type: 'WALL' }); // Bottom part
        } else {
            // Door in middle of horizontal wall
            const segmentW = (rect.w - doorSize) / 2;
            buildingWalls.push({ ...rect, w: segmentW, type: 'WALL' }); // Left part
            buildingWalls.push({ ...rect, x: rect.x + rect.w - segmentW, w: segmentW, type: 'WALL' }); // Right part
        }
    };

    // Construct Shell
    if (doorSides.includes('top')) addWallWithDoor(walls.top, false); else buildingWalls.push({...walls.top, type: 'WALL'});
    if (doorSides.includes('bottom')) addWallWithDoor(walls.bottom, false); else buildingWalls.push({...walls.bottom, type: 'WALL'});
    if (doorSides.includes('left')) addWallWithDoor(walls.left, true); else buildingWalls.push({...walls.left, type: 'WALL'});
    if (doorSides.includes('right')) addWallWithDoor(walls.right, true); else buildingWalls.push({...walls.right, type: 'WALL'});

    // Internal Divider
    if (rooms > 1) {
       // Horizontal split with door
       const midY = y + h/2;
       const doorSize = 60;
       const splitW = (w - doorSize) / 2;
       buildingWalls.push({ x, y: midY, w: splitW, h: wallThick, type: 'WALL' });
       buildingWalls.push({ x: x + w - splitW, y: midY, w: splitW, h: wallThick, type: 'WALL' });
    }

    buildings.push({
      x, y, w, h,
      walls: buildingWalls,
      doors: [],
      roofColor: mapTheme.roofColor
    });
    
    obstacles.push(...buildingWalls);
    
    // Spawn Loot in Building (If BR)
    if (isBR && Math.random() > 0.3) {
        const weaponTypes = Object.values(WeaponType).filter(w => w !== WeaponType.KNIFE);
        const randWeapon = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
        loot.push({
            id: `loot-${x}-${y}`,
            pos: { x: x + w/2, y: y + h/2 },
            radius: 10,
            weapon: randWeapon,
            active: true
        });
    }
  };

  const createContainer = (x: number, y: number, vertical: boolean) => {
      const w = vertical ? 50 : 150;
      const h = vertical ? 150 : 50;
      obstacles.push({ x, y, w, h, type: 'COVER_FULL' });
  };

  const createRock = (x: number, y: number, size: number) => {
      obstacles.push({ x, y, w: size, h: size, type: 'COVER_HALF' });
  };

  // --- DETAIL HELPERS ---
  const createCar = (x: number, y: number, vertical: boolean) => {
      // Cars are half-cover obstacles
      const w = vertical ? 60 : 110;
      const h = vertical ? 110 : 60;
      obstacles.push({ x, y, w, h, type: 'COVER_HALF' });
  };

  const createTreeLog = (x: number, y: number, vertical: boolean) => {
      const w = vertical ? 20 : 120;
      const h = vertical ? 120 : 20;
      obstacles.push({ x, y, w, h, type: 'COVER_HALF' });
  };

  const createMarketStall = (x: number, y: number) => {
      // Small 40x40 crates/tables
      obstacles.push({ x, y, w: 40, h: 40, type: 'COVER_HALF' });
      // Cloth roof visual is implied
  };

  // --- LAYOUT GENERATION ---
  
  // If BR, we duplicate the layout logic across a grid or scale it up
  const generateLayout = (offsetX: number, offsetY: number, w: number, h: number) => {
      
      if (mapId === MapId.URBAN) {
          // 3-LANE CITY (Scaled to current sector)
          const LANE_WIDTH = w / 3;
          
          createBuilding(offsetX + 100, offsetY + 200, 300, 400, 2, ['right', 'bottom']);
          createBuilding(offsetX + 100, offsetY + h - 600, 300, 400, 1, ['right', 'top']);
          obstacles.push({ x: offsetX + 200, y: offsetY + 700, w: 50, h: 50, type: 'COVER_FULL' }); // Dumpster?

          // Center Park / Statue
          obstacles.push({ x: offsetX + LANE_WIDTH + 100, y: offsetY + 400, w: 40, h: 80, type: 'COVER_HALF' }); // Planter
          obstacles.push({ x: offsetX + w/2 - 50, y: offsetY + h/2 - 50, w: 100, h: 100, type: 'COVER_FULL' }); // Statue Base

          createBuilding(offsetX + w - 400, offsetY + 300, 300, 300, 1, ['left', 'bottom']);
          createBuilding(offsetX + w - 400, offsetY + h - 500, 300, 300, 1, ['left', 'top']);

          // Add Cars on the streets (Urban Details)
          createCar(offsetX + LANE_WIDTH / 2, offsetY + 300, true);
          createCar(offsetX + LANE_WIDTH / 2, offsetY + h - 400, true);
          createCar(offsetX + w - LANE_WIDTH / 2, offsetY + 500, true);
          
          // Bus Stop / Shelters
          obstacles.push({ x: offsetX + w/2 + 200, y: offsetY + h/2, w: 10, h: 100, type: 'COVER_FULL' });
          obstacles.push({ x: offsetX + w/2 + 200, y: offsetY + h/2, w: 80, h: 10, type: 'COVER_FULL' });

      } else if (mapId === MapId.DESERT) {
          createBuilding(offsetX + 100, offsetY + 100, 200, 200, 1, ['right', 'bottom']);
          createBuilding(offsetX + w - 300, offsetY + h - 300, 200, 200, 1, ['left', 'top']);
          
          // Ruins in the center
          obstacles.push({ x: offsetX + w/2 - 150, y: offsetY + h/2 - 150, w: 300, h: 20, type: 'WALL' });
          obstacles.push({ x: offsetX + w/2 - 150, y: offsetY + h/2 - 150, w: 20, h: 100, type: 'WALL' }); // Broken corner
          obstacles.push({ x: offsetX + w/2 + 130, y: offsetY + h/2, w: 20, h: 150, type: 'WALL' }); // Broken wall
          
          // Scattered Rocks
          for(let i=0; i<15; i++) {
              createRock(offsetX + Math.random() * (w - 200) + 100, offsetY + Math.random() * (h - 200) + 100, 40 + Math.random() * 40);
          }

          // Bazaar / Market Area (Desert Details)
          const marketX = offsetX + w - 400;
          const marketY = offsetY + 200;
          for(let i=0; i<3; i++) {
              for(let j=0; j<3; j++) {
                  if (Math.random() > 0.3)
                    createMarketStall(marketX + i * 60, marketY + j * 60);
              }
          }

      } else if (mapId === MapId.INDUSTRIAL) {
          const cx = offsetX + w / 2;
          const cy = offsetY + h / 2;
          createBuilding(cx - 200, cy - 200, 400, 400, 2, ['left', 'right', 'top', 'bottom']);
          
          // Container Yards
          for(let x=offsetX+200; x<offsetX+w-200; x+=300) {
              if (Math.abs(x - cx) < 300) continue; 
              for (let y=offsetY+200; y<offsetY+h-200; y+=250) {
                   createContainer(x, y, Math.random() > 0.5);
              }
          }

          // Pipelines (Industrial Details)
          // Long low cover connecting areas
          obstacles.push({ x: offsetX + 100, y: cy + 300, w: 600, h: 20, type: 'COVER_HALF' });
          obstacles.push({ x: cx + 300, y: offsetY + 100, w: 20, h: 500, type: 'COVER_HALF' });
          
          // Fuel Tanks (Approximated as squares/rects)
          obstacles.push({ x: offsetX + 150, y: offsetY + 150, w: 100, h: 100, type: 'COVER_FULL' });
          obstacles.push({ x: offsetX + 150, y: offsetY + h - 250, w: 100, h: 100, type: 'COVER_FULL' });

      } else if (mapId === MapId.ARCTIC) {
          createBuilding(offsetX + w/2 - 300, offsetY + 100, 600, 200, 2, ['bottom']); // North Base
          createBuilding(offsetX + w/2 - 300, offsetY + h - 300, 600, 200, 2, ['top']); // South Base
          
          // Ice Fields
          for(let i=0; i<15; i++) {
               const x = offsetX + Math.random() * (w - 400) + 200;
               const y = offsetY + Math.random() * (h - 600) + 300;
               obstacles.push({ x, y, w: 60, h: 60, type: 'COVER_HALF' });
          }

          // Supply Depot (Arctic Details)
          // Grid of crates outside the bases
          const supplyX = offsetX + 200;
          const supplyY = offsetY + h/2;
          for(let i=0; i<4; i++) {
              createContainer(supplyX + i*80, supplyY, true);
          }
          
          // Radio Tower Support (Four pillars)
          const towerX = offsetX + w - 300;
          const towerY = offsetY + h/2;
          obstacles.push({ x: towerX, y: towerY, w: 20, h: 20, type: 'WALL' });
          obstacles.push({ x: towerX + 100, y: towerY, w: 20, h: 20, type: 'WALL' });
          obstacles.push({ x: towerX, y: towerY + 100, w: 20, h: 20, type: 'WALL' });
          obstacles.push({ x: towerX + 100, y: towerY + 100, w: 20, h: 20, type: 'WALL' });
          // Generator in middle
          obstacles.push({ x: towerX + 30, y: towerY + 30, w: 60, h: 60, type: 'COVER_HALF' });


      } else if (mapId === MapId.FOREST) {
          createBuilding(offsetX + 400, offsetY + 400, 200, 200, 1, ['right']); // Cabin 1
          createBuilding(offsetX + w - 600, offsetY + 600, 200, 200, 1, ['left']); // Cabin 2
          
          // Dense Trees
          for(let i=0; i<25; i++) {
               const x = offsetX + Math.random() * (w - 100);
               const y = offsetY + Math.random() * (h - 100);
               obstacles.push({ x, y, w: 40, h: 40, type: 'COVER_FULL' });
          }

          // Fallen Logs (Forest Details)
          for(let i=0; i<10; i++) {
               const x = offsetX + Math.random() * (w - 200) + 100;
               const y = offsetY + Math.random() * (h - 200) + 100;
               createTreeLog(x, y, Math.random() > 0.5);
          }
          
          // Ancient Ruins / Stone Pillars
          obstacles.push({ x: offsetX + w/2, y: offsetY + h/2, w: 30, h: 30, type: 'COVER_FULL' });
          obstacles.push({ x: offsetX + w/2 + 50, y: offsetY + h/2 + 50, w: 30, h: 30, type: 'COVER_FULL' });
          obstacles.push({ x: offsetX + w/2 - 50, y: offsetY + h/2 - 50, w: 30, h: 30, type: 'COVER_FULL' });
          
          // Trenches (Low walls)
          obstacles.push({ x: offsetX + 100, y: offsetY + h - 300, w: 300, h: 10, type: 'COVER_HALF' });
          obstacles.push({ x: offsetX + 100, y: offsetY + h - 250, w: 300, h: 10, type: 'COVER_HALF' });

      }
  };

  if (isBR) {
      // Generate 4 sectors
      generateLayout(0, 0, mapW/2, mapH/2);
      generateLayout(mapW/2, 0, mapW/2, mapH/2);
      generateLayout(0, mapH/2, mapW/2, mapH/2);
      generateLayout(mapW/2, mapH/2, mapW/2, mapH/2);
      
      // Add more random loot outdoors
      for(let i=0; i<50; i++) {
        const weaponTypes = Object.values(WeaponType).filter(w => w !== WeaponType.KNIFE);
        const randWeapon = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
        loot.push({
            id: `loot-wild-${i}`,
            pos: { x: Math.random() * mapW, y: Math.random() * mapH },
            radius: 10,
            weapon: randWeapon,
            active: true
        });
      }
  } else {
      generateLayout(0, 0, mapW, mapH);
  }

  // --- SPAWN BOUNDARIES ---
  obstacles.push({ x: -50, y: -50, w: mapW + 100, h: 50, type: 'WALL' }); // Top
  obstacles.push({ x: -50, y: mapH, w: mapW + 100, h: 50, type: 'WALL' }); // Bottom
  obstacles.push({ x: -50, y: 0, w: 50, h: mapH, type: 'WALL' }); // Left
  obstacles.push({ x: mapW, y: 0, w: 50, h: mapH, type: 'WALL' }); // Right

  // --- CONTROL POINTS (Standard Locations for now) ---
  controlPoints.push({
    id: 'A',
    pos: { x: mapW * 0.2, y: mapH * 0.2 },
    radius: 100,
    active: true,
    team: Team.NONE,
    captureProgress: 0,
    name: 'ALPHA'
  });

  controlPoints.push({
    id: 'B',
    pos: { x: mapW/2, y: mapH/2 },
    radius: 100,
    active: true,
    team: Team.NONE,
    captureProgress: 0,
    name: 'BRAVO'
  });

  controlPoints.push({
    id: 'C',
    pos: { x: mapW * 0.8, y: mapH * 0.8 },
    radius: 100,
    active: true,
    team: Team.NONE,
    captureProgress: 0,
    name: 'CHARLIE'
  });

  return { buildings, obstacles, controlPoints, mapTheme, mapWidth: mapW, mapHeight: mapH, loot };
};

export const getSpawnPoint = (team: Team, mapW: number = WORLD_WIDTH, mapH: number = WORLD_HEIGHT): Vector2 => {
  if (team === Team.ALLIED) {
    return {
      x: Math.random() * (mapW - 200) + 100,
      y: mapH - 100 - Math.random() * 200
    };
  } else if (team === Team.AXIS) {
    return {
      x: Math.random() * (mapW - 200) + 100,
      y: 100 + Math.random() * 200
    };
  } else {
     // NONE / Random (FFA/BR)
     return {
         x: Math.random() * (mapW - 200) + 100,
         y: Math.random() * (mapH - 200) + 100
     };
  }
};
