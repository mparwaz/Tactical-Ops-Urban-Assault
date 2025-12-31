
import { WeaponType, WeaponStats, Operator, MapId } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 2000;

export const TICK_RATE = 60;
export const PLAYER_RADIUS = 16;
export const PLAYER_SPEED = 5;
export const SPRINT_MULTIPLIER = 1.5;
export const BOT_COUNT = 9; // 5v5 total including player
export const BR_PLAYER_COUNT = 30; // 1 Player + 29 Bots

export const WEAPONS: Record<WeaponType, WeaponStats> = {
  [WeaponType.KNIFE]: {
    name: 'Combat Knife',
    className: 'MELEE',
    description: 'Standard issue tactical knife. Silent and deadly, granting maximum movement speed.',
    damage: 100,
    fireRate: 400,
    range: 50,
    accuracy: 0.1,
    magSize: 100, // effectively infinite
    reloadTime: 0,
    color: '#ffffff88' // transparent white slash
  },
  [WeaponType.PISTOL]: {
    name: 'Desert Eagle',
    className: 'SIDEARM',
    description: 'High-caliber semi-automatic pistol. Dealing heavy damage but with high recoil and low capacity.',
    damage: 45,
    fireRate: 250,
    range: 600,
    accuracy: 0.05,
    magSize: 7,
    reloadTime: 1200,
    color: '#94a3b8' // slate
  },
  [WeaponType.SMG]: {
    name: 'MP5',
    className: 'SMG',
    description: 'The gold standard for close-quarters combat. Excellent mobility and fire rate.',
    damage: 18,
    fireRate: 60,
    range: 500,
    accuracy: 0.15,
    magSize: 30,
    reloadTime: 1500,
    color: '#60a5fa' // blue
  },
  [WeaponType.PDW]: {
    name: 'P90',
    className: 'SMG',
    description: 'High-capacity bullpup PDW. Designed for sustained suppressive fire in tight spaces.',
    damage: 14,
    fireRate: 40, // Very fast
    range: 400,
    accuracy: 0.2,
    magSize: 50,
    reloadTime: 2200,
    color: '#818cf8' // indigo
  },
  [WeaponType.SHOTGUN]: {
    name: 'Remington 870',
    className: 'SHOTGUN',
    description: 'Pump-action tactical shotgun. Devastating stopping power at close range.',
    damage: 18, // per pellet (x4)
    fireRate: 900,
    range: 250,
    accuracy: 0.3,
    magSize: 8,
    reloadTime: 2500,
    color: '#a3a3a3' // gray
  },
  [WeaponType.AUTO_SHOTGUN]: {
    name: 'AA-12',
    className: 'SHOTGUN',
    description: 'Fully automatic shotgun. Clears rooms instantly but burns through ammo rapidly.',
    damage: 12, // per pellet
    fireRate: 200,
    range: 200,
    accuracy: 0.4,
    magSize: 20,
    reloadTime: 3000,
    color: '#dc2626' // red tracer
  },
  [WeaponType.RIFLE]: {
    name: 'M4A1',
    className: 'ASSAULT RIFLE',
    description: 'Versatile and reliable automatic rifle. Effective at medium to long ranges.',
    damage: 25,
    fireRate: 100,
    range: 800,
    accuracy: 0.05,
    magSize: 30,
    reloadTime: 2000,
    color: '#fbbf24' // amber
  },
  [WeaponType.BURST_RIFLE]: {
    name: 'M16A4',
    className: 'ASSAULT RIFLE',
    description: 'Classic burst-fire rifle. High precision and range, rewards accuracy over volume.',
    damage: 28,
    fireRate: 80, // burst feel requires click spam
    range: 900,
    accuracy: 0.02,
    magSize: 30,
    reloadTime: 2000,
    color: '#fcd34d' // yellow
  },
  [WeaponType.LMG]: {
    name: 'M249 SAW',
    className: 'LMG',
    description: 'Light Machine Gun with a high-capacity belt. Excellent for locking down lanes.',
    damage: 22,
    fireRate: 90,
    range: 1000,
    accuracy: 0.12,
    magSize: 100,
    reloadTime: 4500,
    color: '#ea580c' // orange
  },
  [WeaponType.DMR]: {
    name: 'M14 EBR',
    className: 'MARKSMAN RIFLE',
    description: 'Semi-automatic designated marksman rifle. Bridges the gap between rifle and sniper.',
    damage: 48,
    fireRate: 300,
    range: 1200,
    accuracy: 0.01,
    magSize: 20,
    reloadTime: 2500,
    color: '#10b981' // green tracer
  },
  [WeaponType.SNIPER]: {
    name: 'Intervention',
    className: 'SNIPER RIFLE',
    description: 'Bolt-action anti-materiel rifle. Lethal at any range with pinpoint accuracy.',
    damage: 100,
    fireRate: 1200,
    range: 1800,
    accuracy: 0.0,
    magSize: 5,
    reloadTime: 3000,
    color: '#f87171' // red
  }
};

export const GUN_GAME_ORDER = [
  WeaponType.PISTOL,
  WeaponType.SMG,
  WeaponType.PDW,
  WeaponType.SHOTGUN,
  WeaponType.AUTO_SHOTGUN,
  WeaponType.RIFLE,
  WeaponType.BURST_RIFLE,
  WeaponType.LMG,
  WeaponType.DMR,
  WeaponType.SNIPER,
  WeaponType.KNIFE
];

export const OPERATORS: Operator[] = [
  {
    id: 'ranger',
    name: 'Ranger',
    color: '#3b82f6', // blue-500
    description: 'Standard issue tactical gear.',
    bonus: 'Balanced',
    speedMult: 1.0,
    healthMult: 1.0
  },
  {
    id: 'vanguard',
    name: 'Vanguard',
    color: '#10b981', // green-500
    description: 'Lightweight armor for rapid movement.',
    bonus: 'Speed +10% | Health -10%',
    speedMult: 1.1,
    healthMult: 0.9
  },
  {
    id: 'heavy',
    name: 'Juggernaut',
    color: '#6366f1', // indigo-500
    description: 'Heavy plating for maximum survival.',
    bonus: 'Health +20% | Speed -10%',
    speedMult: 0.9,
    healthMult: 1.2
  },
  {
    id: 'ghost',
    name: 'Ghost',
    color: '#4b5563', // gray-600
    description: 'Stealth operations specialist.',
    bonus: 'Speed +5%',
    speedMult: 1.05,
    healthMult: 1.0
  },
  {
    id: 'ronin',
    name: 'Ronin',
    color: '#f59e0b', // amber-500
    description: 'Close-quarters specialist.',
    bonus: 'Speed +15% | Health -15%',
    speedMult: 1.15,
    healthMult: 0.85
  },
  {
    id: 'bulldozer',
    name: 'Bulldozer',
    color: '#7f1d1d', // red-900
    description: 'Breaching expert with reinforced armor.',
    bonus: 'Health +25% | Speed -15%',
    speedMult: 0.85,
    healthMult: 1.25
  },
  {
    id: 'wraith',
    name: 'Wraith',
    color: '#a855f7', // purple-500
    description: 'High-mobility flanker.',
    bonus: 'Speed +8% | Health -5%',
    speedMult: 1.08,
    healthMult: 0.95
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    color: '#1e40af', // blue-800
    description: 'Defensive perimeter security.',
    bonus: 'Health +10% | Speed -5%',
    speedMult: 0.95,
    healthMult: 1.1
  },
  {
    id: 'striker',
    name: 'Striker',
    color: '#ef4444', // red-500
    description: 'Assault trooper trained for aggression.',
    bonus: 'Speed +12% | Health -10%',
    speedMult: 1.12,
    healthMult: 0.9
  },
  {
    id: 'titan',
    name: 'Titan',
    color: '#374151', // gray-700
    description: 'Walking tank with experimental plating.',
    bonus: 'Health +35% | Speed -20%',
    speedMult: 0.8,
    healthMult: 1.35
  }
];

export const MAP_INFO: Record<MapId, { name: string, description: string, color: string }> = {
    [MapId.URBAN]: { name: 'Urban Sector', description: 'CQB city streets featuring parked cars, bus stops, and narrow alleys.', color: '#374151' },
    [MapId.DESERT]: { name: 'Dune Sea', description: 'Open dunes scattered with ancient ruins and a central market bazaar.', color: '#d97706' },
    [MapId.ARCTIC]: { name: 'Ice Station', description: 'Frozen research outpost surrounded by icy fields and supply depots.', color: '#0ea5e9' },
    [MapId.INDUSTRIAL]: { name: 'Iron Works', description: 'Maze of shipping containers, pipelines, and fuel tanks.', color: '#4b5563' },
    [MapId.FOREST]: { name: 'Green Zone', description: 'Dense woodland filled with fallen logs and defensive trench lines.', color: '#166534' },
};

export const TEAM_COLORS = {
  ALLIED: '#3b82f6', // blue-500
  AXIS: '#ef4444',   // red-500
  NONE: '#9ca3af'    // gray-400
};
