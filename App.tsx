
import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { Team, GameMode, WeaponType, GameSetup, Difficulty, ControlScheme, GameSettings, Player, MatchRecord, MapId, Orientation, FireMode } from './types';
import { WEAPONS, OPERATORS, MAP_INFO } from './constants';
import { soundManager } from './services/soundManager';

// Persistence Keys
const STORAGE_KEYS = {
    SETTINGS: 'tactical_ops_settings_v1',
    HISTORY: 'tactical_ops_history_v1',
    LOADOUT: 'tactical_ops_loadout_v1'
};

// Helper to load state safely
const loadState = <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        console.warn(`Failed to load ${key}`, e);
        return fallback;
    }
};

const App: React.FC = () => {
  const [inGame, setInGame] = useState(false);
  const [winner, setWinner] = useState<Team | null>(null);
  const [postMatchData, setPostMatchData] = useState<{winner: Team, scores: Record<Team, number>, players: Player[]} | null>(null);
  
  // Persistent Match History
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>(() => loadState(STORAGE_KEYS.HISTORY, []));

  // Persistent Customization State
  const savedLoadout = loadState(STORAGE_KEYS.LOADOUT, {
      mode: GameMode.DOMINATION,
      weapon: WeaponType.RIFLE,
      operatorId: OPERATORS[0].id,
      mapId: MapId.URBAN
  });

  const [selectedMode, setSelectedMode] = useState<GameMode>(savedLoadout.mode);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponType>(savedLoadout.weapon);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(savedLoadout.operatorId);
  const [selectedMapId, setSelectedMapId] = useState<MapId>(savedLoadout.mapId);
  
  const [activeTab, setActiveTab] = useState<'PLAY' | 'LOADOUT' | 'OPERATORS' | 'CAREER' | 'SETTINGS'>('PLAY');

  // Persistent Settings State
  const [settings, setSettings] = useState<GameSettings>(() => {
      const saved = loadState(STORAGE_KEYS.SETTINGS, null);
      const defaults = {
          volume: 50,
          difficulty: Difficulty.VETERAN,
          controls: ControlScheme.PC,
          allyCount: 4,
          enemyCount: 5,
          botCount: 29,
          orientation: Orientation.DEFAULT,
          fireMode: FireMode.MANUAL
      };
      if (!saved) return defaults;
      // Merge in case saved data is missing new fields
      return { ...defaults, ...saved };
  });

  // --- SAVE EFFECTS ---
  useEffect(() => {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(matchHistory));
  }, [matchHistory]);

  useEffect(() => {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // --- ORIENTATION EFFECT ---
  useEffect(() => {
    const applyOrientation = async () => {
        if (typeof screen !== 'undefined' && 'orientation' in screen && typeof (screen.orientation as any).lock === 'function') {
            try {
                if (settings.orientation === Orientation.PORTRAIT) {
                    await (screen.orientation as any).lock('portrait');
                } else if (settings.orientation === Orientation.LANDSCAPE) {
                    await (screen.orientation as any).lock('landscape');
                } else {
                    (screen.orientation as any).unlock();
                }
            } catch (e) {
                // Orientation lock usually requires fullscreen or a specific browsing context (PWA).
                // We silently ignore errors as this is a progressive enhancement.
                console.debug("Orientation lock attempt failed (requires fullscreen or PWA):", e);
            }
        }
    };
    applyOrientation();
  }, [settings.orientation]);

  useEffect(() => {
      const loadout = {
          mode: selectedMode,
          weapon: selectedWeapon,
          operatorId: selectedOperatorId,
          mapId: selectedMapId
      };
      localStorage.setItem(STORAGE_KEYS.LOADOUT, JSON.stringify(loadout));
  }, [selectedMode, selectedWeapon, selectedOperatorId, selectedMapId]);

  // Audio Effects
  useEffect(() => {
    soundManager.setVolume(settings.volume);
  }, [settings.volume]);

  useEffect(() => {
    if (inGame) {
        soundManager.stopMusic();
    } else if (postMatchData) {
        if (postMatchData.winner === Team.ALLIED) {
            soundManager.playMusic('VICTORY');
        } else {
            soundManager.playMusic('DEFEAT');
        }
    } else {
        // Main Menu - Silence
        soundManager.stopMusic();
    }
  }, [inGame, postMatchData]);

  // UI Sound Helpers
  const playClick = () => soundManager.play('UI_CLICK');
  const playHover = () => soundManager.play('UI_HOVER');

  const startGame = () => {
    playClick();
    setInGame(true);
    setWinner(null);
    setPostMatchData(null);
  };

  const handleGameOver = (winningTeam: Team, scores: Record<Team, number>, players: Player[]) => {
    setInGame(false);
    setPostMatchData({ winner: winningTeam, scores, players });
    
    // Add to History
    const human = players.find(p => p.id === 'player');
    const newRecord: MatchRecord = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        winner: winningTeam,
        mode: selectedMode,
        mapId: selectedMapId,
        scoreAllied: scores[Team.ALLIED],
        scoreAxis: scores[Team.AXIS],
        playerKills: human ? human.kills : 0,
        playerDeaths: human ? human.deaths : 0,
        playerOperator: selectedOperatorId,
        difficulty: settings.difficulty
    };
    setMatchHistory(prev => [newRecord, ...prev]);
  };

  const returnToLobby = () => {
      playClick();
      if (postMatchData) setWinner(postMatchData.winner);
      setPostMatchData(null);
      setActiveTab('PLAY');
  };

  const getGameSetup = (): GameSetup => ({
      mode: selectedMode,
      weapon: selectedWeapon,
      operatorId: selectedOperatorId,
      mapId: selectedMapId
  });

  const handleClearData = () => {
      playClick();
      if (window.confirm("WARNING: This will permanently delete your match history, loadouts, and settings. This cannot be undone. Are you sure?")) {
          localStorage.removeItem(STORAGE_KEYS.HISTORY);
          localStorage.removeItem(STORAGE_KEYS.SETTINGS);
          localStorage.removeItem(STORAGE_KEYS.LOADOUT);
          window.location.reload();
      }
  };

  // Helper for Orientation Button Clicks
  const handleOrientationChange = (o: Orientation) => {
    playClick();
    setSettings(s => ({...s, orientation: o}));
    
    // Attempt fullscreen if setting a specific orientation lock (often required by browsers)
    if (o !== Orientation.DEFAULT) {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    }
  };

  // Helper for Victory Screen Stats
  const getAlliedStats = () => {
      if (!postMatchData) return { kills: 0, deaths: 0 };
      const allied = postMatchData.players.filter(p => p.team === Team.ALLIED);
      return {
          kills: allied.reduce((a, b) => a + b.kills, 0),
          deaths: allied.reduce((a, b) => a + b.deaths, 0)
      };
  };

  // Render Logic for Report
  const isSoloMode = selectedMode === GameMode.BATTLE_ROYALE || selectedMode === GameMode.FFA || selectedMode === GameMode.GUN_GAME;
  const reportPlayers = postMatchData ? (isSoloMode 
        ? postMatchData.players.filter(p => p.id === 'player') 
        : postMatchData.players.filter(p => p.team === Team.ALLIED)
  ) : [];

  return (
    <div className="w-full h-screen bg-neutral-900 flex items-center justify-center overflow-hidden font-sans select-none">
      {/* POST MATCH VICTORY SCREEN */}
      {postMatchData ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black relative z-50 p-4">
               <div className="absolute inset-0 opacity-50 bg-[url('https://images.unsplash.com/photo-1542259681-d4cd7193bc70?q=80&w=2669&auto=format&fit=crop')] bg-cover bg-center grayscale"></div>
               <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black"></div>
               
               <div className="relative z-10 text-center animate-in fade-in zoom-in duration-500 w-full max-w-4xl flex flex-col items-center">
                    <h1 className={`text-5xl md:text-8xl font-black tracking-tighter italic mb-4 ${postMatchData.winner === Team.ALLIED ? 'text-blue-500' : 'text-red-500'}`}>
                        {postMatchData.winner === Team.ALLIED ? 'VICTORY' : 'DEFEAT'}
                    </h1>
                    
                    {!isSoloMode && (
                        <div className="text-lg md:text-2xl text-white font-mono mb-8 md:mb-12 tracking-widest bg-black/50 inline-block px-4 py-1 rounded">
                            ALLIED <span className="text-blue-400">{postMatchData.scores[Team.ALLIED]}</span> - <span className="text-red-400">{postMatchData.scores[Team.AXIS]}</span> AXIS
                        </div>
                    )}
                    {isSoloMode && (
                        <div className="text-lg md:text-2xl text-white font-mono mb-8 md:mb-12 tracking-widest bg-black/50 inline-block px-4 py-1 rounded">
                             MISSION {postMatchData.winner === Team.ALLIED ? 'ACCOMPLISHED' : 'FAILED'}
                        </div>
                    )}
                    
                    {/* TEAM SQUAD REPORT */}
                    <div className="bg-neutral-900/90 border border-white/10 p-4 md:p-8 rounded-xl w-full backdrop-blur overflow-y-auto max-h-[50vh]">
                        <h2 className="text-left text-white font-bold text-lg md:text-xl border-b border-white/20 pb-4 mb-4 flex justify-between">
                            <span>{isSoloMode ? 'OPERATOR DEBRIEF' : 'SQUAD REPORT'}</span>
                            <span className="text-blue-400 text-xs md:text-sm self-end">TASK FORCE 141</span>
                        </h2>
                        <div className="grid grid-cols-4 gap-2 md:gap-4 text-left text-gray-400 text-xs md:text-sm mb-2 font-mono">
                            <div>OPERATOR</div>
                            <div>STATUS</div>
                            <div>KILLS</div>
                            <div>DEATHS</div>
                        </div>
                        <div className="space-y-2">
                            {reportPlayers
                                .sort((a,b) => b.kills - a.kills)
                                .map(p => (
                                <div key={p.id} className={`grid grid-cols-4 gap-2 md:gap-4 text-left items-center p-2 md:p-3 rounded ${p.id === 'player' ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-white/5'}`}>
                                    <div className="font-bold text-white flex items-center gap-2 truncate">
                                        <div className={`w-2 h-2 shrink-0 rounded-full ${p.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className="truncate text-xs md:text-base">{p.id === 'player' ? 'YOU' : p.id.toUpperCase()}</span>
                                    </div>
                                    <div className="text-[10px] md:text-xs text-gray-400">{p.active ? 'ACTIVE' : 'KIA'}</div>
                                    <div className="text-white font-mono text-sm">{p.kills}</div>
                                    <div className="text-gray-400 font-mono text-sm">{p.deaths}</div>
                                </div>
                            ))}
                        </div>
                        {/* TEAM TOTALS FOOTER - Hide in Solo Modes */}
                        {!isSoloMode && (
                            <div className="grid grid-cols-4 gap-2 md:gap-4 text-left items-center p-2 md:p-3 mt-4 border-t border-white/20 text-yellow-500 font-bold font-mono">
                                <div className="col-span-2">SQUAD TOTALS</div>
                                <div>{getAlliedStats().kills}</div>
                                <div>{getAlliedStats().deaths}</div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={returnToLobby}
                        onMouseEnter={playHover}
                        className="mt-8 md:mt-12 px-8 md:px-12 py-3 md:py-4 bg-yellow-500 text-black font-black text-xl md:text-2xl uppercase tracking-widest hover:bg-yellow-400 transition-transform hover:scale-105 rounded shadow-lg shadow-yellow-500/20"
                    >
                        RETURN TO LOBBY
                    </button>
               </div>
          </div>
      ) : !inGame ? (
        <div className="w-full h-full flex flex-col bg-[url('https://images.unsplash.com/photo-1542259681-d4cd7193bc70?q=80&w=2669&auto=format&fit=crop')] bg-cover bg-center relative overflow-y-auto">
          
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm fixed"></div>

          {/* Header */}
          <div className="relative z-10 w-full p-4 md:p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter italic">TACTICAL <span className="text-yellow-500">OPS</span></h1>
                <h2 className="text-sm md:text-xl text-blue-400 font-mono tracking-widest">URBAN ASSAULT</h2>
             </div>
             <div className="flex flex-wrap justify-center gap-2 md:gap-4">
                 {['PLAY', 'LOADOUT', 'OPERATORS', 'CAREER', 'SETTINGS'].map(tab => (
                     <button 
                        key={tab}
                        onClick={() => { playClick(); setActiveTab(tab as any); }}
                        onMouseEnter={playHover}
                        className={`px-4 md:px-8 py-2 font-bold text-sm md:text-xl uppercase tracking-wider transition-all skew-x-[-10deg] border-l-4 
                        ${activeTab === tab 
                            ? 'bg-yellow-500 text-black border-white' 
                            : 'bg-black/50 text-gray-400 border-transparent hover:bg-white/10'}`}
                     >
                        {tab}
                     </button>
                 ))}
             </div>
          </div>

          {/* Main Content Area */}
          <div className="relative z-10 flex-1 flex flex-col lg:flex-row p-4 md:p-12 gap-8 md:gap-12 w-full max-w-7xl mx-auto">
             
             {/* LEFT COLUMN: STATUS / INFO */}
             <div className="w-full lg:w-1/3 flex flex-col justify-start lg:justify-center order-2 lg:order-1">
                {winner && (
                    <div className="mb-8 p-6 bg-neutral-800/90 border-l-4 border-yellow-500 rounded animate-pulse">
                        <p className="text-gray-400 uppercase text-sm">Previous Match</p>
                        <p className={`text-4xl font-black ${winner === Team.ALLIED ? 'text-blue-500' : 'text-red-500'}`}>
                            {winner === Team.ALLIED ? 'VICTORY' : 'DEFEAT'}
                        </p>
                    </div>
                )}
                
                <div className="text-white/80 space-y-2 bg-black/20 p-4 rounded lg:bg-transparent lg:p-0">
                    <p className="text-sm uppercase tracking-widest text-gray-500">Current Setup</p>
                    <div className="text-2xl md:text-3xl font-bold text-white">{selectedMode.replace('_', ' ')}</div>
                    <div className="text-xl md:text-2xl text-yellow-400">{WEAPONS[selectedWeapon].name}</div>
                    <div className="text-lg md:text-xl text-blue-400">{OPERATORS.find(o => o.id === selectedOperatorId)?.name}</div>
                    <div className="text-base md:text-lg text-gray-300 border-t border-gray-600 mt-2 pt-2">{MAP_INFO[selectedMapId].name}</div>
                </div>
             </div>

             {/* RIGHT COLUMN: INTERACTIVE TABS */}
             <div className="w-full lg:w-2/3 bg-black/40 border border-white/10 p-4 md:p-8 rounded-xl backdrop-blur-md order-1 lg:order-2 h-fit">
                
                {activeTab === 'PLAY' && (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-6">
                            {/* Mode Selection */}
                            <div>
                                <h3 className="text-xl md:text-2xl text-white font-bold border-b border-white/20 pb-2 mb-4">SELECT MODE</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[GameMode.TDM, GameMode.DOMINATION, GameMode.FFA, GameMode.HARDPOINT, GameMode.GUN_GAME, GameMode.BATTLE_ROYALE].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => { playClick(); setSelectedMode(mode); }}
                                            onMouseEnter={playHover}
                                            className={`p-4 text-left border-2 rounded-lg transition-all
                                            ${selectedMode === mode ? 'border-yellow-500 bg-yellow-500/10 text-white' : 'border-white/10 text-gray-400 hover:border-white/30'}
                                            `}
                                        >
                                            <div className="text-lg md:text-xl font-black">{mode.replace('_', ' ')}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Map Selection */}
                            <div>
                                <h3 className="text-xl md:text-2xl text-white font-bold border-b border-white/20 pb-2 mb-4">SELECT MAP</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {Object.values(MapId).map(mapId => {
                                        const info = MAP_INFO[mapId];
                                        const isSelected = selectedMapId === mapId;
                                        return (
                                            <button
                                                key={mapId}
                                                onClick={() => { playClick(); setSelectedMapId(mapId); }}
                                                onMouseEnter={playHover}
                                                className={`p-3 text-left border rounded transition-all flex flex-col justify-between min-h-[120px]
                                                ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-white/10 bg-white/5 hover:bg-white/10'}
                                                `}
                                                style={isSelected ? {borderColor: info.color} : {}}
                                            >
                                                <div>
                                                    <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-200'}`}>{info.name}</div>
                                                    <div className={`text-xs mt-1 leading-snug ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>{info.description}</div>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full mt-2" style={{backgroundColor: info.color}}></div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={startGame}
                            onMouseEnter={playHover}
                            className="w-full py-4 md:py-6 mt-4 md:mt-8 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xl md:text-2xl rounded transition-transform hover:scale-[1.02] shadow-lg shadow-yellow-500/20 uppercase tracking-widest"
                        >
                            DEPLOY SQUAD
                        </button>
                    </div>
                )}

                {activeTab === 'LOADOUT' && (
                    <div className="space-y-6">
                        <h3 className="text-xl md:text-2xl text-white font-bold border-b border-white/20 pb-2">PRIMARY WEAPON</h3>
                        <div className="grid grid-cols-1 gap-4">
                            {Object.values(WEAPONS).map((w) => {
                                const wKey = Object.keys(WEAPONS).find(k => WEAPONS[k as WeaponType] === w) as WeaponType;
                                const isSelected = selectedWeapon === wKey;
                                return (
                                    <button
                                        key={w.name}
                                        onClick={() => { playClick(); setSelectedWeapon(wKey); }}
                                        onMouseEnter={playHover}
                                        className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded transition-all gap-4
                                        ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-white/10 hover:bg-white/5'}
                                        `}
                                    >
                                        <div className="text-left flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-lg md:text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{w.name}</span>
                                                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-gray-300">{w.className}</span>
                                            </div>
                                            <div className="text-sm text-gray-400 mb-2 italic">{w.description}</div>
                                            <div className="text-xs text-gray-500 flex flex-wrap gap-2 md:gap-4 font-mono">
                                                <span className="bg-black/30 px-2 py-1 rounded">DMG: {w.damage}</span>
                                                <span className="bg-black/30 px-2 py-1 rounded">RPM: {Math.round(60000/Math.max(1, w.fireRate))}</span>
                                                <span className="bg-black/30 px-2 py-1 rounded">MAG: {w.magSize}</span>
                                            </div>
                                        </div>
                                        <div className="w-12 h-12 rounded-full shrink-0 border-2 border-white/20 shadow-inner" style={{backgroundColor: w.color}}></div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'OPERATORS' && (
                    <div className="space-y-6">
                        <h3 className="text-xl md:text-2xl text-white font-bold border-b border-white/20 pb-2">OPERATOR SELECT</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {OPERATORS.map(op => (
                                <button
                                    key={op.id}
                                    onClick={() => { playClick(); setSelectedOperatorId(op.id); }}
                                    onMouseEnter={playHover}
                                    className={`relative p-4 md:p-6 border-2 rounded-lg transition-all overflow-hidden group text-left
                                    ${selectedOperatorId === op.id ? 'border-green-500 bg-green-900/20' : 'border-white/10 hover:border-white/30'}
                                    `}
                                >
                                    <div className="relative z-10">
                                        <div className={`text-xl md:text-2xl font-black uppercase ${selectedOperatorId === op.id ? 'text-white' : 'text-gray-400'}`}>{op.name}</div>
                                        <div className="text-sm text-gray-300 mt-2">{op.description}</div>
                                        <div className="mt-4 text-xs font-mono text-green-400 bg-green-900/40 p-2 inline-block rounded">
                                            {op.bonus}
                                        </div>
                                    </div>
                                    <div className="absolute right-[-20px] bottom-[-20px] w-32 h-32 opacity-20 group-hover:opacity-40 transition-opacity rounded-full" style={{backgroundColor: op.color}}></div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'CAREER' && (
                    <div className="space-y-6">
                        <h3 className="text-xl md:text-2xl text-white font-bold border-b border-white/20 pb-2">SERVICE RECORD</h3>
                        <div className="flex gap-4 mb-4 text-xs md:text-sm text-gray-400 font-mono">
                            <div className="bg-white/5 p-3 rounded flex-1 text-center">
                                <div className="text-2xl text-white font-bold">{matchHistory.length}</div>
                                <div>MATCHES</div>
                            </div>
                            <div className="bg-white/5 p-3 rounded flex-1 text-center">
                                <div className="text-2xl text-green-400 font-bold">
                                    {matchHistory.filter(m => m.winner === Team.ALLIED).length}
                                </div>
                                <div>WINS</div>
                            </div>
                            <div className="bg-white/5 p-3 rounded flex-1 text-center">
                                <div className="text-2xl text-white font-bold">
                                    {matchHistory.length > 0 ? (matchHistory.reduce((a, b) => a + b.playerKills, 0) / Math.max(1, matchHistory.reduce((a, b) => a + b.playerDeaths, 0))).toFixed(2) : "0.00"}
                                </div>
                                <div>K/D RATIO</div>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {matchHistory.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">No combat records found.</div>
                            ) : (
                                matchHistory.map((match) => (
                                    <div key={match.id} className="bg-white/5 p-3 rounded flex justify-between items-center text-xs md:text-sm border-l-4"
                                         style={{borderColor: match.winner === Team.ALLIED ? '#3b82f6' : '#ef4444'}}>
                                        <div>
                                            <div className={`font-bold ${match.winner === Team.ALLIED ? 'text-blue-400' : 'text-red-400'}`}>
                                                {match.winner === Team.ALLIED ? 'VICTORY' : 'DEFEAT'}
                                            </div>
                                            <div className="text-gray-400">{MAP_INFO[match.mapId].name} | {match.mode}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono text-white">
                                                {match.scoreAllied} - {match.scoreAxis}
                                            </div>
                                            <div className="text-gray-500">
                                                K: {match.playerKills} / D: {match.playerDeaths}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'SETTINGS' && (
                    <div className="space-y-6">
                        <h3 className="text-xl md:text-2xl text-white font-bold border-b border-white/20 pb-2">GAME SETTINGS</h3>
                        
                        {/* INSTRUCTIONS / FIELD MANUAL */}
                        <div className="bg-white/5 p-4 rounded">
                           <h4 className="text-white font-bold border-b border-white/10 pb-2 mb-2 tracking-widest text-sm flex items-center gap-2">
                               <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                               FIELD MANUAL
                           </h4>
                           <div className="text-sm text-gray-400 space-y-3 h-48 overflow-y-auto pr-2 custom-scrollbar">
                               <div className="space-y-1">
                                   <p><strong className="text-white">DOMINATION:</strong> Capture and hold the 3 control points (A, B, C) to gain points. First team to 100 points wins.</p>
                                   <p><strong className="text-white">HARDPOINT:</strong> Hold the single active zone to score. The zone rotates every 30 seconds.</p>
                                   <p><strong className="text-white">GUN GAME:</strong> Free-For-All. Eliminate enemies to upgrade your weapon. First to complete all weapons wins.</p>
                                   <p><strong className="text-white">TEAM DEATHMATCH:</strong> Eliminate enemy operators. Each kill grants 10 points. First team to 100 points (10 kills) wins.</p>
                                   <p><strong className="text-white">FREE FOR ALL:</strong> No teams. If it moves, shoot it. Survive and eliminate.</p>
                                   <p><strong className="text-white">BATTLE ROYALE:</strong> Survival of the fittest. Scavenge for weapons, stay in the safe zone, and be the last operator standing.</p>
                               </div>
                               
                               <div className="border-t border-white/10 pt-2">
                                   <p className="text-white font-bold mb-1">KEYBOARD CONTROLS:</p>
                                   <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                       <span><span className="text-yellow-500 font-mono">WASD</span> : Move</span>
                                       <span><span className="text-yellow-500 font-mono">MOUSE</span> : Aim</span>
                                       <span><span className="text-yellow-500 font-mono">L-CLICK</span> : Fire</span>
                                       <span><span className="text-yellow-500 font-mono">R</span> : Reload</span>
                                       <span><span className="text-yellow-500 font-mono">SHIFT</span> : Sprint</span>
                                       <span><span className="text-yellow-500 font-mono">M</span> : Toggle Map</span>
                                   </div>
                               </div>

                               <div className="border-t border-white/10 pt-2">
                                   <p className="text-white font-bold mb-1">MOBILE CONTROLS:</p>
                                   <p>Use the <span className="text-yellow-500">Virtual D-Pad</span> (Left) to move and the <span className="text-yellow-500">Touch Zone</span> (Right) to aim. Tap Fire to shoot.</p>
                               </div>

                               <div className="border-t border-white/10 pt-2">
                                   <p className="text-white font-bold mb-1">BOT CONFIGURATION:</p>
                                   <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-gray-300">Team Modes (TDM, DOM, etc):</strong> Use the <span className="text-blue-400">Friendly</span> and <span className="text-red-400">Hostile</span> bot sliders to set team sizes.</li>
                                        <li><strong className="text-gray-300">Solo Modes (FFA, BR):</strong> Use the <span className="text-yellow-500">Solo Bot Count</span> slider to determine the total number of opponents.</li>
                                   </ul>
                               </div>

                               <div className="border-t border-white/10 pt-2">
                                   <p className="text-white font-bold mb-1">DISPLAY:</p>
                                   <p>Use <span className="text-purple-400">Portrait</span> or <span className="text-purple-400">Landscape</span> to lock orientation preference, or <span className="text-purple-400">Default</span> to use system settings.</p>
                               </div>

                               <div className="border-t border-white/10 pt-2">
                                   <p className="text-white font-bold mb-1">DATA INTEL:</p>
                                   <p>Combat records, loadouts, and settings are <span className="text-green-400">automatically saved</span> to this device. Use the <span className="text-red-500">Danger Zone</span> below to reset all data.</p>
                               </div>
                           </div>
                        </div>

                        {/* FIRE MODE */}
                        <div className="bg-white/5 p-4 rounded">
                            <label className="block text-gray-400 mb-2 uppercase tracking-wide text-sm">Firing Mode</label>
                            <div className="flex flex-col md:flex-row gap-4">
                                <button 
                                    onClick={() => { playClick(); setSettings(s => ({...s, fireMode: FireMode.MANUAL})); }}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.fireMode === FireMode.MANUAL ? 'bg-orange-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    MANUAL FIRE
                                </button>
                                <button 
                                    onClick={() => { playClick(); setSettings(s => ({...s, fireMode: FireMode.AUTO})); }}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.fireMode === FireMode.AUTO ? 'bg-orange-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    AUTO FIRE
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2">
                                {settings.fireMode === FireMode.MANUAL ? 'Standard Mode: Tap or Hold Attack button to fire.' : 'Smart Mode: Automatically fires when crosshair is over an enemy.'}
                            </p>
                        </div>

                        {/* CONTROLS SELECTOR */}
                        <div className="bg-white/5 p-4 rounded">
                            <label className="block text-gray-400 mb-2 uppercase tracking-wide text-sm">Input Method</label>
                            <div className="flex flex-col md:flex-row gap-4">
                                <button 
                                    onClick={() => { playClick(); setSettings(s => ({...s, controls: ControlScheme.PC})); }}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.controls === ControlScheme.PC ? 'bg-blue-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    KEYBOARD + MOUSE
                                </button>
                                <button 
                                    onClick={() => { playClick(); setSettings(s => ({...s, controls: ControlScheme.MOBILE})); }}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.controls === ControlScheme.MOBILE ? 'bg-blue-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    MOBILE TOUCH
                                </button>
                            </div>
                        </div>

                        {/* ORIENTATION */}
                        <div className="bg-white/5 p-4 rounded">
                            <label className="block text-gray-400 mb-2 uppercase tracking-wide text-sm">Device Orientation</label>
                            <div className="flex flex-col md:flex-row gap-4">
                                <button 
                                    onClick={() => handleOrientationChange(Orientation.DEFAULT)}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.orientation === Orientation.DEFAULT ? 'bg-purple-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    DEFAULT
                                </button>
                                <button 
                                    onClick={() => handleOrientationChange(Orientation.PORTRAIT)}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.orientation === Orientation.PORTRAIT ? 'bg-purple-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    PORTRAIT
                                </button>
                                <button 
                                    onClick={() => handleOrientationChange(Orientation.LANDSCAPE)}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.orientation === Orientation.LANDSCAPE ? 'bg-purple-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    LANDSCAPE
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2">Adjusts the game viewport preference. (Reload required for full effect)</p>
                        </div>

                        {/* DIFFICULTY */}
                        <div className="bg-white/5 p-4 rounded">
                            <label className="block text-gray-400 mb-2 uppercase tracking-wide text-sm">Bot Difficulty</label>
                            <div className="flex flex-col md:flex-row gap-4">
                                <button 
                                    onClick={() => { playClick(); setSettings(s => ({...s, difficulty: Difficulty.RECRUIT})); }}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.difficulty === Difficulty.RECRUIT ? 'bg-green-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    RECRUIT
                                </button>
                                <button 
                                    onClick={() => { playClick(); setSettings(s => ({...s, difficulty: Difficulty.VETERAN})); }}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.difficulty === Difficulty.VETERAN ? 'bg-yellow-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    VETERAN
                                </button>
                                <button 
                                    onClick={() => { playClick(); setSettings(s => ({...s, difficulty: Difficulty.ELITE})); }}
                                    onMouseEnter={playHover}
                                    className={`flex-1 py-3 font-bold rounded text-sm md:text-base ${settings.difficulty === Difficulty.ELITE ? 'bg-red-600 text-white' : 'bg-black/30 text-gray-500'}`}
                                >
                                    ELITE
                                </button>
                            </div>
                        </div>

                        {/* BOT COUNT CONFIGURATION */}
                        <div className="bg-white/5 p-4 rounded space-y-4">
                            <h4 className="text-white font-bold border-b border-white/10 pb-2 mb-2 tracking-widest text-sm">TEAM DEPLOYMENT</h4>
                            
                            {/* TEAM MODES */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-gray-400 uppercase tracking-wide text-xs font-bold">Hostiles (Team Modes)</label>
                                        <span className="text-red-400 font-mono font-bold">{settings.enemyCount}</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" max="20" 
                                        value={settings.enemyCount} 
                                        onChange={(e) => setSettings(s => ({...s, enemyCount: parseInt(e.target.value)}))}
                                        onMouseUp={playClick}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-gray-400 uppercase tracking-wide text-xs font-bold">Allies (Team Modes)</label>
                                        <span className="text-blue-400 font-mono font-bold">{settings.allyCount}</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0" max="20" 
                                        value={settings.allyCount} 
                                        onChange={(e) => setSettings(s => ({...s, allyCount: parseInt(e.target.value)}))}
                                        onMouseUp={playClick}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                            </div>
                            
                            <div className="border-t border-white/10 my-2"></div>

                            {/* SOLO MODES */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-gray-400 uppercase tracking-wide text-xs font-bold text-yellow-500">Solo Bot Count (FFA / BR)</label>
                                    <span className="text-yellow-500 font-mono font-bold">{settings.botCount}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" max="60" 
                                    value={settings.botCount} 
                                    onChange={(e) => setSettings(s => ({...s, botCount: parseInt(e.target.value)}))}
                                    onMouseUp={playClick}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Controls total opponents in Battle Royale, Gun Game, and Free-For-All.</p>
                            </div>
                        </div>

                        {/* VOLUME */}
                        <div className="bg-white/5 p-4 rounded">
                            <div className="flex justify-between mb-2">
                                <label className="text-gray-400 uppercase tracking-wide text-sm">Master Volume</label>
                                <span className="text-white font-mono">{settings.volume}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="100" 
                                value={settings.volume} 
                                onChange={(e) => setSettings(s => ({...s, volume: parseInt(e.target.value)}))}
                                onMouseUp={playClick}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>

                        {/* DATA MANAGEMENT */}
                        <div className="bg-white/5 p-4 rounded border border-red-900/30">
                            <label className="block text-red-500 mb-2 uppercase tracking-wide text-sm font-bold">Danger Zone</label>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-xs">Clear all progress and settings.</span>
                                <button 
                                    onClick={handleClearData}
                                    onMouseEnter={playHover}
                                    className="px-4 py-2 bg-red-900/20 border border-red-500 text-red-500 font-bold text-xs hover:bg-red-500 hover:text-black transition-colors rounded uppercase"
                                >
                                    DELETE SAVE DATA
                                </button>
                            </div>
                        </div>

                    </div>
                )}

             </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 p-4 border-t border-white/10 text-center text-gray-600 text-[10px] md:text-xs font-mono">
              VERSION 2.1.0 | CONNECTED TO DATA CENTER | REGION: NA-WEST
          </div>
        </div>
      ) : (
        <GameCanvas onGameOver={handleGameOver} gameSetup={getGameSetup()} settings={settings} />
      )}
    </div>
  );
};

export default App;
