
export enum GameMode {
  MENU = 'MENU',
  TDM = 'TDM',
  DOMINATION = 'DOMINATION',
  FFA = 'FFA',
  HARDPOINT = 'HARDPOINT',
  GUN_GAME = 'GUN_GAME',
  BATTLE_ROYALE = 'BATTLE_ROYALE'
}

export enum Team {
  NONE = 'NONE',
  ALLIED = 'ALLIED', // Blue (Task Force)
  AXIS = 'AXIS'      // Red (Insurgents)
}

export enum WeaponType {
  KNIFE = 'KNIFE',
  PISTOL = 'PISTOL',
  SMG = 'SMG',
  PDW = 'PDW',
  SHOTGUN = 'SHOTGUN',
  AUTO_SHOTGUN = 'AUTO_SHOTGUN',
  RIFLE = 'RIFLE',
  BURST_RIFLE = 'BURST_RIFLE',
  LMG = 'LMG',
  DMR = 'DMR',
  SNIPER = 'SNIPER'
}

export enum Difficulty {
  RECRUIT = 'RECRUIT',
  VETERAN = 'VETERAN',
  ELITE = 'ELITE'
}

export enum ControlScheme {
  PC = 'PC',
  MOBILE = 'MOBILE'
}

export enum Orientation {
  DEFAULT = 'DEFAULT',
  PORTRAIT = 'PORTRAIT',
  LANDSCAPE = 'LANDSCAPE'
}

export enum MapId {
  URBAN = 'URBAN',
  DESERT = 'DESERT',
  ARCTIC = 'ARCTIC',
  INDUSTRIAL = 'INDUSTRIAL',
  FOREST = 'FOREST'
}

export interface MapTheme {
    backgroundColor: string;
    gridColor: string;
    obstacleColor: string;
    wallColor: string;
    roofColor: string;
}

export interface GameSettings {
  volume: number;
  difficulty: Difficulty;
  controls: ControlScheme;
  allyCount: number;
  enemyCount: number;
  botCount: number; // Generic count for FFA/BR
  orientation: Orientation;
}

export interface WeaponStats {
  name: string;
  damage: number;
  fireRate: number; // ms between shots
  range: number;
  accuracy: number; // spread angle in radians
  magSize: number;
  reloadTime: number;
  color: string;
  description: string;
  className: string;
}

export interface Operator {
  id: string;
  name: string;
  color: string;
  description: string;
  bonus: string; // e.g., "Speed +", "Health +"
  speedMult: number;
  healthMult: number;
}

export interface GameSetup {
  mode: GameMode;
  weapon: WeaponType;
  operatorId: string;
  mapId: MapId;
}

export interface MatchRecord {
    id: string;
    timestamp: number;
    winner: Team;
    mode: GameMode;
    mapId: MapId;
    scoreAllied: number;
    scoreAxis: number;
    playerKills: number;
    playerDeaths: number;
    playerOperator: string;
    difficulty: Difficulty;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2;
  radius: number;
  active: boolean;
}

export interface LootItem extends Entity {
    weapon: WeaponType;
}

export interface Zone {
    x: number;
    y: number;
    radius: number;
    targetRadius: number;
    shrinkTimer: number;
    state: 'WAITING' | 'SHRINKING';
    damagePerTick: number;
}

export interface Player extends Entity {
  team: Team;
  angle: number;
  health: number;
  maxHealth: number;
  speed: number;
  weapon: WeaponType;
  ammo: number;
  isReloading: boolean;
  reloadTimer: number;
  lastShotTime: number;
  kills: number;
  deaths: number;
  isBot: boolean;
  target?: Vector2 | null; // For AI
  state?: 'PATROL' | 'ATTACK' | 'CAPTURE' | 'RETREAT' | 'LOOT' | 'ZONE_MOVE'; // For AI
}

export interface Bullet extends Entity {
  velocity: Vector2;
  damage: number;
  team: Team;
  ownerId: string; // Added to track who shot the bullet
  distanceTraveled: number;
  maxDistance: number;
  color: string;
}

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'WALL' | 'COVER_HALF' | 'COVER_FULL' | 'WINDOW';
}

export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  walls: Obstacle[];
  doors: Obstacle[];
  roofColor: string;
}

export interface ControlPoint extends Entity {
  team: Team;
  captureProgress: number; // 0 to 100
  name: string;
}

export interface GameState {
  mode: GameMode;
  difficulty: Difficulty;
  mapId: MapId;
  mapTheme: MapTheme;
  players: Player[];
  bullets: Bullet[];
  obstacles: Obstacle[];
  buildings: Building[];
  controlPoints: ControlPoint[];
  loot: LootItem[];
  zone?: Zone;
  camera: Vector2;
  scores: { [key in Team]: number };
  timeRemaining: number;
  killFeed: string[];
  hardpointTimer?: number; // Added for Hardpoint logic
  mapWidth: number;
  mapHeight: number;
}
