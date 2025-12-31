
import React, { useRef, useEffect, useState } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, WEAPONS, TEAM_COLORS, WORLD_WIDTH, WORLD_HEIGHT, OPERATORS } from '../constants';
import { createInitialState, updateGame } from '../services/engine';
import { GameState, Team, Player, Building, ControlPoint, GameSetup, GameSettings, ControlScheme, GameMode } from '../types';

interface GameCanvasProps {
  onGameOver: (winner: Team, scores: { [key in Team]: number }, players: Player[]) => void;
  gameSetup: GameSetup;
  settings: GameSettings;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onGameOver, gameSetup, settings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  
  // Track current window dimensions ref for game loop to access synchronously
  const dims = useRef({ w: window.innerWidth, h: window.innerHeight });
  // State to force re-render when dimensions change
  const [, setTick] = useState(0);

  const stateRef = useRef<GameState>(createInitialState(gameSetup, settings));
  const inputRef = useRef({
    keys: {} as Record<string, boolean>,
    mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    mouseDown: false
  });
  const gameOverTriggered = useRef(false);
  
  // Mobile Aiming State
  const [aimStick, setAimStick] = useState<{startX: number, startY: number, curX: number, curY: number} | null>(null);
  const aimTouchId = useRef<number | null>(null);
  
  // HUD State
  const [hudState, setHudState] = useState<{
      ammo: number, health: number, scoreA: number, scoreB: number, 
      time: number, feed: string[], shooting: boolean, lastShot: number,
      aliveCount?: number, kills: number, deaths: number
  } | null>(null);

  const [showFullMap, setShowFullMap] = useState(false);

  // Resize Listener
  useEffect(() => {
    const handleResize = () => {
        dims.current = { w: window.innerWidth, h: window.innerHeight };
        // Recenter mouse input if it was in the middle (optional, keeps aim steady on rotate)
        // inputRef.current.mouse.x = dims.current.w / 2;
        // inputRef.current.mouse.y = dims.current.h / 2;
        setTick(t => t + 1);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const handleKeyDown = (e: KeyboardEvent) => { 
        inputRef.current.keys[e.key] = true; 
        if (e.key.toLowerCase() === 'm') setShowFullMap(prev => !prev);
    };
    const handleKeyUp = (e: KeyboardEvent) => { inputRef.current.keys[e.key] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouse.x = e.clientX - rect.left;
      inputRef.current.mouse.y = e.clientY - rect.top;
    };
    const handleMouseDown = () => { inputRef.current.mouseDown = true; };
    const handleMouseUp = () => { inputRef.current.mouseDown = false; };

    // PC Listeners
    if (settings.controls === ControlScheme.PC) {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
    } else {
        window.addEventListener('mousemove', handleMouseMove);
    }

    const render = () => {
      const viewW = dims.current.w;
      const viewH = dims.current.h;

      // 1. UPDATE with current dimensions
      stateRef.current = updateGame(stateRef.current, inputRef.current, 16, settings, viewW, viewH);
      const state = stateRef.current;
      const player = state.players.find(x => x.id === 'player');

      // Sync HUD
      if (player) {
          const alive = state.mode === GameMode.BATTLE_ROYALE ? state.players.filter(p => p.active).length : undefined;
          setHudState({
              ammo: player.ammo,
              health: player.health,
              scoreA: state.scores[Team.ALLIED],
              scoreB: state.scores[Team.AXIS],
              time: state.timeRemaining,
              feed: state.killFeed,
              shooting: (inputRef.current.mouseDown || (settings.fireMode === 'AUTO' && player.lastShotTime > Date.now() - 100)) && player.ammo > 0, // Visual fix for auto-fire crosshair
              lastShot: player.lastShotTime,
              aliveCount: alive,
              kills: player.kills,
              deaths: player.deaths
          });
      }

      // Update Crosshair Position Directly
      if (crosshairRef.current) {
          const { x, y } = inputRef.current.mouse;
          crosshairRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }

      // Check win condition
      if (!gameOverTriggered.current) {
          if (state.mode === GameMode.BATTLE_ROYALE) {
              const activePlayers = state.players.filter(p => p.active);
              if (activePlayers.length <= 1) {
                  const survivor = activePlayers[0];
                  if (survivor && survivor.id === 'player') state.scores[Team.ALLIED] = 999;
                  else state.scores[Team.AXIS] = 999;
                  gameOverTriggered.current = true;
                  onGameOver(survivor && survivor.id === 'player' ? Team.ALLIED : Team.AXIS, state.scores, state.players);
              }
              if (player && !player.active && !gameOverTriggered.current) {
                   gameOverTriggered.current = true;
                   onGameOver(Team.AXIS, state.scores, state.players);
              }
          } else {
            if (state.scores[Team.ALLIED] >= 100) {
                gameOverTriggered.current = true;
                onGameOver(Team.ALLIED, state.scores, state.players);
            } else if (state.scores[Team.AXIS] >= 100) {
                gameOverTriggered.current = true;
                onGameOver(Team.AXIS, state.scores, state.players);
            } else if (state.timeRemaining <= 0) {
                gameOverTriggered.current = true;
                let w = Team.NONE;
                if (state.scores[Team.ALLIED] > state.scores[Team.AXIS]) w = Team.ALLIED;
                else if (state.scores[Team.AXIS] > state.scores[Team.ALLIED]) w = Team.AXIS;
                onGameOver(w, state.scores, state.players);
            }
          }
      }

      // 2. DRAW MAIN VIEW
      ctx.fillStyle = state.mapTheme.backgroundColor; 
      ctx.fillRect(0, 0, viewW, viewH);

      ctx.save();
      ctx.translate(-state.camera.x, -state.camera.y);

      // Draw Grid / Floor
      ctx.strokeStyle = state.mapTheme.gridColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= state.mapWidth; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, state.mapHeight); }
      for (let y = 0; y <= state.mapHeight; y += 100) { ctx.moveTo(0, y); ctx.lineTo(state.mapWidth, y); }
      ctx.stroke();

      // Draw Zone
      if (state.zone) {
          ctx.beginPath();
          ctx.arc(state.zone.x, state.zone.y, state.zone.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#ff000022'; 
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 5;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(state.zone.x, state.zone.y, state.zone.radius, 0, Math.PI * 2, true);
          ctx.rect(state.zone.x - 5000, state.zone.y - 5000, 10000, 10000); 
          ctx.fillStyle = '#ff000044';
          ctx.fill();
      }

      // Draw Control Points
      state.controlPoints.forEach(cp => {
          ctx.beginPath();
          ctx.arc(cp.pos.x, cp.pos.y, cp.radius, 0, Math.PI * 2);
          ctx.fillStyle = TEAM_COLORS[cp.team] + '44';
          ctx.fill();
          ctx.strokeStyle = TEAM_COLORS[cp.team];
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '20px Arial';
          ctx.fillText(cp.name, cp.pos.x - 10, cp.pos.y);
      });
      
      // Draw Loot
      if (state.loot) {
          state.loot.forEach(item => {
              if (!item.active) return;
              ctx.save();
              ctx.translate(item.pos.x, item.pos.y);
              const offset = Math.sin(Date.now() / 200) * 3;
              ctx.translate(0, offset);
              ctx.shadowColor = WEAPONS[item.weapon].color;
              ctx.shadowBlur = 10;
              ctx.fillStyle = '#222';
              ctx.fillRect(-10, -5, 20, 10);
              ctx.fillStyle = WEAPONS[item.weapon].color;
              ctx.fillRect(-8, -3, 16, 6);
              ctx.restore();
          });
      }

      // Draw Obstacles
      state.obstacles.forEach(o => {
          ctx.fillStyle = o.type === 'WINDOW' ? '#60a5faaa' : state.mapTheme.obstacleColor;
          if (o.type === 'WALL') ctx.fillStyle = state.mapTheme.wallColor;
          if (o.type.includes('COVER')) ctx.fillStyle = state.mapTheme.obstacleColor;
          ctx.fillRect(o.x, o.y, o.w, o.h);
      });

      // Draw Buildings
      state.buildings.forEach(b => {
         let alpha = 1.0;
         if (player && player.pos.x > b.x && player.pos.x < b.x + b.w && player.pos.y > b.y && player.pos.y < b.y + b.h) {
             alpha = 0.2; 
         }
         ctx.fillStyle = b.roofColor;
         ctx.globalAlpha = alpha;
         ctx.fillRect(b.x, b.y, b.w, b.h);
         ctx.globalAlpha = 1.0;
         ctx.strokeStyle = '#111';
         ctx.lineWidth = 2;
         ctx.strokeRect(b.x, b.y, b.w, b.h);
      });

      // Draw Players
      state.players.forEach(p => {
          if (!p.active) return;
          ctx.save();
          ctx.translate(p.pos.x, p.pos.y);
          ctx.rotate(p.angle);
          
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          const isEnemy = state.mode === GameMode.FFA || state.mode === GameMode.GUN_GAME || state.mode === GameMode.BATTLE_ROYALE 
               ? p.id !== 'player' 
               : p.team !== (player?.team || Team.ALLIED);
               
          ctx.fillStyle = isEnemy ? TEAM_COLORS.AXIS : TEAM_COLORS.ALLIED;
          if (p.id === 'player') ctx.fillStyle = '#fff';

          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = WEAPONS[p.weapon].color;
          ctx.fillRect(0, -5, 30, 10); 
          ctx.restore();
          
          ctx.fillStyle = 'red';
          ctx.fillRect(p.pos.x - 20, p.pos.y - 30, 40, 5);
          ctx.fillStyle = 'green';
          ctx.fillRect(p.pos.x - 20, p.pos.y - 30, 40 * (p.health / p.maxHealth), 5);
      });

      // Draw Bullets
      state.bullets.forEach(b => {
          ctx.beginPath();
          ctx.arc(b.pos.x, b.pos.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = b.color; 
          ctx.fill();
          
          ctx.beginPath();
          ctx.moveTo(b.pos.x, b.pos.y);
          ctx.lineTo(b.pos.x - b.velocity.x * 20, b.pos.y - b.velocity.y * 20);
          ctx.strokeStyle = b.color; 
          ctx.stroke();
      });

      ctx.restore();

      // 3. DRAW MINIMAP
      drawMinimap(ctx, state, viewW, player);

      // 4. DRAW FULL MAP OVERLAY
      if (showFullMap) {
          drawFullMap(ctx, state, viewW, viewH);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [onGameOver, gameSetup, showFullMap, settings]);

  // Mobile Handlers
  const handleMobileMove = (key: string, active: boolean) => {
      inputRef.current.keys[key] = active;
  };

  const handleMobileFire = (active: boolean) => {
      inputRef.current.mouseDown = active;
  };

  const handleAimStart = (e: React.TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (aimTouchId.current === null) {
              aimTouchId.current = t.identifier;
              setAimStick({ startX: t.clientX, startY: t.clientY, curX: t.clientX, curY: t.clientY });
          }
      }
  };

  const handleAimMove = (e: React.TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === aimTouchId.current) {
              setAimStick(prev => {
                  if (!prev) return null;
                  const dx = t.clientX - prev.startX;
                  const dy = t.clientY - prev.startY;
                  
                  // Update mouse relative to screen center
                  const centerX = dims.current.w / 2;
                  const centerY = dims.current.h / 2;
                  inputRef.current.mouse.x = centerX + dx;
                  inputRef.current.mouse.y = centerY + dy;

                  return { ...prev, curX: t.clientX, curY: t.clientY };
              });
          }
      }
  };

  const handleAimEnd = (e: React.TouchEvent) => {
       for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === aimTouchId.current) {
              aimTouchId.current = null;
              setAimStick(null);
          }
      }
  };

  const isMobile = settings.controls === ControlScheme.MOBILE;
  const isPortrait = dims.current.h > dims.current.w;

  return (
    <div className="relative w-full h-full cursor-none overflow-hidden">
      <canvas
        ref={canvasRef}
        width={dims.current.w}
        height={dims.current.h}
        className="block"
      />
      
      {/* MOBILE CONTROLS OVERLAY */}
      {isMobile && (
          <div className="absolute inset-0 pointer-events-none select-none touch-none">
              <div 
                  className="absolute top-0 right-0 w-1/2 h-full pointer-events-auto"
                  onTouchStart={handleAimStart}
                  onTouchMove={handleAimMove}
                  onTouchEnd={handleAimEnd}
                  onTouchCancel={handleAimEnd}
              />
              <button 
                  className="absolute top-6 right-6 w-12 h-12 bg-blue-500/50 rounded border-2 border-blue-400 text-white font-bold text-xs shadow-lg pointer-events-auto z-20"
                  onTouchStart={(e) => { e.stopPropagation(); setShowFullMap(prev => !prev); }}
              >
                  MAP
              </button>
              {aimStick && (
                  <div 
                    className="absolute w-24 h-24 rounded-full border-2 border-white/30 bg-black/20 pointer-events-none"
                    style={{ left: aimStick.startX - 48, top: aimStick.startY - 48 }}
                  >
                      <div 
                        className="absolute w-12 h-12 rounded-full bg-white/50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ transform: `translate(${Math.min(40, Math.max(-40, aimStick.curX - aimStick.startX))}px, ${Math.min(40, Math.max(-40, aimStick.curY - aimStick.startY))}px)` }}
                      />
                  </div>
              )}
              <div className={`absolute bottom-6 left-6 w-40 h-40 pointer-events-auto opacity-60 z-10 ${isPortrait ? 'bottom-20' : ''}`}>
                  <button className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/20 rounded-t-lg active:bg-white/50 border border-white/30" onTouchStart={() => handleMobileMove('w', true)} onTouchEnd={() => handleMobileMove('w', false)}></button>
                  <button className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/20 rounded-b-lg active:bg-white/50 border border-white/30" onTouchStart={() => handleMobileMove('s', true)} onTouchEnd={() => handleMobileMove('s', false)}></button>
                  <button className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 rounded-l-lg active:bg-white/50 border border-white/30" onTouchStart={() => handleMobileMove('a', true)} onTouchEnd={() => handleMobileMove('a', false)}></button>
                  <button className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 rounded-r-lg active:bg-white/50 border border-white/30" onTouchStart={() => handleMobileMove('d', true)} onTouchEnd={() => handleMobileMove('d', false)}></button>
              </div>
              <div className={`absolute bottom-6 right-6 flex gap-4 pointer-events-auto opacity-70 z-10 ${isPortrait ? 'bottom-20' : ''}`}>
                   <button className="w-20 h-20 bg-red-600/50 rounded-full border-4 border-red-400 active:bg-red-500 flex items-center justify-center font-bold text-white text-lg shadow-lg" onTouchStart={() => handleMobileFire(true)} onTouchEnd={() => handleMobileFire(false)}>FIRE</button>
                   <button className="w-14 h-14 bg-yellow-500/50 rounded-full border-2 border-yellow-400 active:bg-yellow-500 flex items-center justify-center font-bold text-white shadow-lg self-end" onTouchStart={() => handleMobileMove('r', true)} onTouchEnd={() => handleMobileMove('r', false)}>R</button>
              </div>
          </div>
      )}

      {/* HUD OVERLAY */}
      {hudState && (
      <>
        <AnimatedCrosshair ref={crosshairRef} shooting={hudState.shooting} lastShot={hudState.lastShot} />

        {/* Score Board */}
        <div className={`absolute top-4 text-white font-mono text-lg md:text-xl bg-black/70 p-2 rounded border border-white/10 flex gap-4 pointer-events-none transition-all
            ${isMobile && isPortrait ? 'left-1/2 -translate-x-1/2' : (isMobile ? 'left-1/2 -translate-x-1/2' : 'left-[130px] md:left-[220px]')}
        `}>
           <div className={`font-bold border-r border-white/20 pr-4 ${hudState.time < 60 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                {Math.floor(hudState.time / 60)}:{(Math.floor(hudState.time % 60)).toString().padStart(2, '0')}
           </div>
           
           {/* Conditional HUD for BR */}
           {hudState.aliveCount !== undefined ? (
               <div><span className="text-red-500 font-bold">ALIVE:</span> {hudState.aliveCount}</div>
           ) : (
               <>
                 <div><span className="text-blue-400 font-bold">ALLIED:</span> {hudState.scoreA}</div>
                 <div><span className="text-red-400 font-bold">AXIS:</span> {hudState.scoreB}</div>
               </>
           )}
        </div>

        {/* Kill Feed */}
        <div className={`absolute right-4 text-white font-mono text-[10px] md:text-xs bg-black/50 p-2 rounded w-48 md:w-64 pointer-events-none transition-all
            ${isPortrait ? 'top-[60px]' : 'top-16 md:top-4'}
        `}>
          {hudState.feed.map((msg, i) => (
              <div key={i} className="mb-1 opacity-80 truncate">{msg}</div>
          ))}
        </div>

        {/* Player Status */}
        <div className={`absolute pointer-events-none text-white font-bold bg-gradient-to-r from-blue-900/90 to-transparent p-4 md:p-6 rounded-lg border-l-4 border-blue-500 transition-all
            ${isMobile && isPortrait 
                ? 'top-20 left-4 w-48 bg-black/60 scale-75 origin-top-left' 
                : (isMobile ? 'top-4 right-4 w-48 bg-black/60 md:w-96' : 'bottom-4 left-4 w-64 md:w-96')}
        `}>
          <div className="flex justify-between items-end">
             <div>
                <div className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'}`}>{Math.ceil(hudState.health)} <span className="text-xs md:text-lg text-gray-400">HP</span></div>
                <div className="flex gap-4 text-xs md:text-sm text-gray-400 font-mono mt-1">
                    <div>K: <span className="text-white">{hudState.kills}</span></div>
                    <div>D: <span className="text-white">{hudState.deaths}</span></div>
                </div>
             </div>
             <div className="text-right">
                <div className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} text-yellow-400`}>{hudState.ammo} <span className="text-xs md:text-lg text-gray-400">/ ∞</span></div>
                {!isMobile && <div className="text-xs md:text-sm uppercase tracking-widest text-gray-300">{WEAPONS[gameSetup.weapon].name}</div>}
             </div>
          </div>
        </div>
      </>
      )}
    </div>
  );
};

// --- HELPER RENDERING FUNCTIONS ---
const drawMinimap = (ctx: CanvasRenderingContext2D, state: GameState, viewW: number, player?: Player) => {
    if (!player) return;
    const isSmallScreen = viewW < 768;
    const size = isSmallScreen ? 100 : 200;
    const margin = 20;
    const scale = isSmallScreen ? 0.08 : 0.15;
    
    // Adjust scale for BR map size
    const mapScaleFactor = state.mapWidth / WORLD_WIDTH; 
    const finalScale = scale / mapScaleFactor;

    ctx.save();
    ctx.translate(margin, margin);
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.clip();
    ctx.fillStyle = '#000000cc';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size/2, 0); ctx.lineTo(size/2, size);
    ctx.moveTo(0, size/2); ctx.lineTo(size, size/2);
    ctx.stroke();
    
    ctx.translate(size/2, size/2);
    ctx.scale(finalScale, finalScale);
    ctx.translate(-player.pos.x, -player.pos.y);
    
    ctx.fillStyle = '#555';
    state.obstacles.forEach(o => { ctx.fillRect(o.x, o.y, o.w, o.h); });
    
    // Draw Zone on Minimap
    if (state.zone) {
        ctx.beginPath();
        ctx.arc(state.zone.x, state.zone.y, state.zone.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 10;
        ctx.stroke();
    }

    state.players.forEach(p => {
        if (!p.active) return;
        const isEnemy = state.mode === GameMode.BATTLE_ROYALE ? p.id !== player.id : p.team !== player.team;
        ctx.fillStyle = isEnemy ? '#ef4444' : '#3b82f6';
        if (p.id === player.id) ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.radius * 2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    ctx.strokeStyle = '#ffffff55';
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, margin, size, size);
};

const drawFullMap = (ctx: CanvasRenderingContext2D, state: GameState, viewW: number, viewH: number) => {
    ctx.save();
    ctx.fillStyle = '#000000dd';
    ctx.fillRect(0, 0, viewW, viewH);
    const margin = 50;
    const drawW = viewW - margin * 2;
    const drawH = viewH - margin * 2;
    // Scale against actual map size
    const scale = Math.min(drawW / state.mapWidth, drawH / state.mapHeight);
    
    ctx.translate(viewW/2 - (state.mapWidth * scale)/2, viewH/2 - (state.mapHeight * scale)/2);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, state.mapWidth, state.mapHeight);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, state.mapWidth, state.mapHeight);
    ctx.fillStyle = '#333';
    state.obstacles.forEach(o => { ctx.fillRect(o.x, o.y, o.w, o.h); });
    
    // Draw Zone
    if (state.zone) {
        ctx.beginPath();
        ctx.arc(state.zone.x, state.zone.y, state.zone.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 20;
        ctx.stroke();
    }

    state.controlPoints.forEach(cp => {
        ctx.fillStyle = TEAM_COLORS[cp.team];
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(cp.pos.x, cp.pos.y, cp.radius, 0, Math.PI * 2); ctx.fill();
    });
    state.players.forEach(p => {
        if (!p.active) return;
        ctx.fillStyle = p.team === Team.ALLIED ? TEAM_COLORS.ALLIED : TEAM_COLORS.AXIS;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.radius * 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("TACTICAL MAP", viewW/2, 40);
};

const AnimatedCrosshair = React.forwardRef<HTMLDivElement, {shooting: boolean, lastShot: number}>(({ shooting, lastShot }, ref) => {
    const [kick, setKick] = useState(false);
    useEffect(() => {
        if (lastShot > 0) {
            setKick(true);
            const t = setTimeout(() => setKick(false), 80);
            return () => clearTimeout(t);
        }
    }, [lastShot]);

    const isExpanded = shooting || kick;
    const gap = isExpanded ? 24 : 8;

    return (
        <div ref={ref} className="absolute top-0 left-0 pointer-events-none" style={{willChange: 'transform'}}>
            <div className="relative">
                <div className="absolute bg-green-400 w-1 h-3 -translate-x-1/2" style={{ top: `-${gap}px`, transition: 'top 0.1s ease-out' }}></div>
                <div className="absolute bg-green-400 w-1 h-3 -translate-x-1/2" style={{ top: `${gap - 5}px`, transition: 'top 0.1s ease-out' }}></div>
                <div className="absolute bg-green-400 w-3 h-1 -translate-y-1/2" style={{ left: `-${gap}px`, transition: 'left 0.1s ease-out' }}></div>
                <div className="absolute bg-green-400 w-3 h-1 -translate-y-1/2" style={{ left: `${gap - 5}px`, transition: 'left 0.1s ease-out' }}></div>
                <div className="absolute w-1 h-1 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 opacity-50"></div>
            </div>
        </div>
    );
});

export default GameCanvas;
