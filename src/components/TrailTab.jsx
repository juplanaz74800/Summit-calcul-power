import { useState, useMemo, useCallback } from 'react';
import { Mountain, Upload, ArrowUpRight, ArrowDownRight, Activity, Info, Zap } from 'lucide-react';
import { parseGPX, analyzeProfile } from '../utils/gpx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { paceToSpeed, speedToPace, timeToSeconds } from '../utils/formatters';
import { fitModel } from '../utils/calculations';
import { getTrailCoaching } from '../utils/coaching';

const TICK = { fill: '#78716c', fontSize: 10, fontWeight: 500 };

export default function TrailTab() {
    const [gpxData, setGpxData] = useState(null);
    const [fileName, setFileName] = useState('');
    const [dragging, setDragging] = useState(false);

    // Force-Velocity inputs
    const [ref5min, setRef5min] = useState({ pace: '04:00', hr: '175', power: '' });
    const [ref12min, setRef12min] = useState({ pace: '04:30', hr: '168', power: '' });
    const [slope, setSlope] = useState('12');
    const [mass, setMass] = useState('70');
    const [slopeTestDuration, setSlopeTestDuration] = useState(8);
    const [slopeTestPace, setSlopeTestPace] = useState('08:00');
    const [slopeTestPower, setSlopeTestPower] = useState('');

    const handleFile = useCallback((file) => {
        if (!file || !file.name.endsWith('.gpx')) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const pts = parseGPX(e.target.result);
            if (pts) setGpxData(pts);
        };
        reader.readAsText(file);
    }, []);

    const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }, [handleFile]);
    const onDragOver = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
    const onDragLeave = useCallback(() => setDragging(false), []);

    const analysis = useMemo(() => gpxData ? analyzeProfile(gpxData) : null, [gpxData]);

    // Force-Velocity analysis
    const forceVelocity = useMemo(() => {
        const v5 = paceToSpeed(ref5min.pace);
        const v12 = paceToSpeed(ref12min.pace);
        if (v5 <= 0 || v12 <= 0) return null;

        const slopeVal = parseFloat(slope) || 12;
        const massVal = parseFloat(mass) || 70;

        // Vitesse en côte déduite de l'allure du test en côte
        const vClimbFromPace = paceToSpeed(slopeTestPace);
        const vcClimb = vClimbFromPace > 0 ? vClimbFromPace : 5.5;

        // Estimate VC plat as ~95% of 12min effort speed
        const vc = v12 * 0.95;

        // Indice côte/plat : compare la vitesse réelle en côte
        // à la vitesse prédite pour un profil "neutre" sur cette pente.
        // Modèle de dégradation standard : v_predicted = vc / (1 + grade × 10)
        // Un coureur "moyen" perd environ 10× le pourcentage de pente en vitesse.
        const predictedClimbSpeed = vc / (1 + (slopeVal / 100) * 10);
        const ratio = predictedClimbSpeed > 0 ? vcClimb / predictedClimbSpeed : 1;

        let profileLabel, profileDesc;
        if (ratio > 1.05) { profileLabel = 'Orienté FORCE — Grimpeur fort'; profileDesc = `Tu montes à ${vcClimb.toFixed(1)} km/h alors qu'un profil neutre serait à ${predictedClimbSpeed.toFixed(1)} km/h. Tu excelles en montée.`; }
        else if (ratio < 0.85) { profileLabel = 'Orienté VITESSE — Rouleur rapide'; profileDesc = `Tu montes à ${vcClimb.toFixed(1)} km/h alors qu'un profil neutre serait à ${predictedClimbSpeed.toFixed(1)} km/h. Travaille la force en côte.`; }
        else { profileLabel = 'Polyvalent FORCE-VITESSE'; profileDesc = `Tu montes à ${vcClimb.toFixed(1)} km/h, cohérent avec ta VC plat (prédit : ${predictedClimbSpeed.toFixed(1)} km/h). Profil équilibré.`; }

        // VAM critique estimation (m/h)
        const vamCriticalPerHour = vcClimb * 1000 * (slopeVal / 100);

        const vamZones = [
            { name: 'Zone 1 (Récup)', range: `${(vamCriticalPerHour * 0.55).toFixed(0)} - ${(vamCriticalPerHour * 0.75).toFixed(0)}` },
            { name: 'Zone 2 (Endurance)', range: `${(vamCriticalPerHour * 0.75).toFixed(0)} - ${(vamCriticalPerHour * 0.88).toFixed(0)}` },
            { name: 'Zone 3 (Tempo)', range: `${(vamCriticalPerHour * 0.88).toFixed(0)} - ${(vamCriticalPerHour * 0.95).toFixed(0)}` },
            { name: 'Zone 4 (Seuil)', range: `${(vamCriticalPerHour * 0.95).toFixed(0)} - ${(vamCriticalPerHour * 1.0).toFixed(0)}` },
            { name: 'Zone 5 (VO₂)', range: `${(vamCriticalPerHour * 1.0).toFixed(0)} - ${(vamCriticalPerHour * 1.15).toFixed(0)}` },
            { name: 'Zone 6 (Sprint)', range: `> ${(vamCriticalPerHour * 1.15).toFixed(0)}` },
        ];

        // Speed by slope table
        const slopes = [0, 2, 4, 6, 8, 10, 12, 15, 20];
        const intensities = [1.1, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5];
        const slopeTable = slopes.map(s => {
            const factor = Math.max(0.3, 1 - s * 0.06);
            return {
                slope: s,
                speeds: intensities.map(pct => {
                    const speed = vc * pct * factor;
                    return { speed: speed.toFixed(1), pace: speedToPace(speed) };
                })
            };
        });

        // Power-based metrics (optional)
        const p5 = Number(ref5min.power);
        const p12 = Number(ref12min.power);
        const pSlope = Number(slopeTestPower);
        let runningCP = null;
        let powerZones = [];
        let wpPerKg = null;
        if (p5 > 0 && p12 > 0) {
            const powerFit = fitModel([{ t: 300, v: p5 }, { t: 720, v: p12 }]);
            if (powerFit) {
                runningCP = powerFit.cp;
                const cp = runningCP;
                const lo = f => Math.round(f * cp);
                powerZones = [
                    { name: 'Zone 1 (Récup)', range: `${lo(0.55)} - ${lo(0.75)} W`, text: 'text-blue-700', border: 'border-blue-100' },
                    { name: 'Zone 2 (Endurance)', range: `${lo(0.75)} - ${lo(0.88)} W`, text: 'text-emerald-700', border: 'border-emerald-100' },
                    { name: 'Zone 3 (Tempo)', range: `${lo(0.88)} - ${lo(0.95)} W`, text: 'text-lime-700', border: 'border-lime-100' },
                    { name: 'Zone 4 (Seuil)', range: `${lo(0.95)} - ${lo(1.0)} W`, text: 'text-amber-700', border: 'border-amber-100' },
                    { name: 'Zone 5 (VO\u2082)', range: `${lo(1.0)} - ${lo(1.15)} W`, text: 'text-red-700', border: 'border-red-100' },
                    { name: 'Zone 6 (Ana\u00e9robie)', range: `> ${lo(1.15)} W`, text: 'text-purple-700', border: 'border-purple-100' },
                ];
            }
        }
        if (pSlope > 0 && massVal > 0) {
            wpPerKg = pSlope / massVal;
        }

        const coaching = getTrailCoaching(ratio, vamCriticalPerHour);

        return { vc, vcClimb, ratio, profileLabel, profileDesc, vamCriticalPerHour, vamZones, slopeTable, intensities, slopeTestDuration, runningCP, powerZones, wpPerKg, slopePower: pSlope, coaching };
    }, [ref5min, ref12min, slope, mass, slopeTestPace, slopeTestDuration, slopeTestPower]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-[2rem] shadow-[0_2px_40px_rgb(0,0,0,0.04)] border border-stone-100">
                <h2 className="text-2xl font-bold text-stone-800 mb-6 flex items-center gap-3">
                    <div className="p-2.5 bg-stone-100 rounded-xl"><Mountain className="text-stone-600 w-5 h-5" /></div>
                    Analyseur GPX
                </h2>
                <div
                    onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                    className={`flex flex-col items-center justify-center relative border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 ${dragging ? 'border-stone-400 bg-stone-50 scale-[1.01]' : 'border-stone-200 bg-stone-50/50 hover:border-stone-300 hover:bg-stone-50'}`}
                >
                    <input type="file" accept=".gpx" onChange={e => handleFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <Upload className={`w-10 h-10 mx-auto mb-4 ${dragging ? 'text-stone-500' : 'text-stone-300'} transition-colors`} />
                    <p className="text-sm font-bold text-stone-600 mb-1">{fileName || 'Glisser un fichier .gpx ici'}</p>
                    <p className="text-xs text-stone-400">ou cliquer pour parcourir</p>
                </div>

                {/* GPX Analysis Grid */}
                {analysis && (
                        <div className="space-y-8 mt-8">
                            {/* Elevation Profile — colored by slope type */}
                            <div className="rounded-2xl sm:rounded-[2rem] border border-stone-100 bg-white shadow-xl p-4 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Profil altimétrique</p>
                                <div className="flex items-center gap-3 text-[10px] font-bold">
                                    <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-400"></span>Montée</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-stone-300"></span>Plat (±2%)</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-blue-400"></span>Descente</span>
                                </div>
                            </div>
                            <div className="h-64 sm:h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analysis.coloredProfile}>
                                        <defs>
                                            <linearGradient id="climbGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                                            </linearGradient>
                                            <linearGradient id="flatGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#a8a29e" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#a8a29e" stopOpacity={0.05} />
                                            </linearGradient>
                                            <linearGradient id="descentGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="distanceKm" tick={TICK} tickFormatter={v => `${Number(v).toFixed(1)}km`} axisLine={false} tickLine={false} />
                                        <YAxis tick={TICK} tickFormatter={v => `${v}m`} domain={['dataMin - 50', 'dataMax + 50']} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v) => v != null ? [`${Number(v).toFixed(0)} m`, 'Altitude'] : null} labelFormatter={v => `${Number(v).toFixed(2)} km`} />
                                        <Area type="monotone" dataKey="climb" stroke="#ef4444" strokeWidth={1.5} fill="url(#climbGrad)" connectNulls={false} isAnimationActive={false} />
                                        <Area type="monotone" dataKey="flat" stroke="#a8a29e" strokeWidth={1.5} fill="url(#flatGrad)" connectNulls={false} isAnimationActive={false} />
                                        <Area type="monotone" dataKey="descent" stroke="#3b82f6" strokeWidth={1.5} fill="url(#descentGrad)" connectNulls={false} isAnimationActive={false} />
                                        {/* D+ labels on major climbs >100m */}
                                        {analysis.majorClimbs.map((mc, idx) => (
                                            <ReferenceLine key={idx} x={mc.midKm} stroke="#dc2626" strokeDasharray="3 3" strokeWidth={1} label={{ value: `+${mc.dPlus.toFixed(0)}m`, position: 'top', fill: '#dc2626', fontSize: 11, fontWeight: 700 }} />
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* D+ Distribution by Grade */}
                        <div className="rounded-2xl sm:rounded-[2rem] border border-stone-100 bg-white shadow-xl p-4 sm:p-6">
                            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Répartition du D+ par pente</p>
                            <div className="h-52">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analysis.dplusByGrade} barCategoryGap="20%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: '#78716c', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: '#78716c', fontSize: 10 }} tickFormatter={v => `${v}m`} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v, name) => [`${v} m`, 'D+']} />
                                        <Bar dataKey="dplus" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                                            {analysis.dplusByGrade.map((entry, index) => (
                                                <Cell key={index} fill={['#86efac', '#4ade80', '#f59e0b', '#ef4444', '#991b1b'][index]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-5 gap-2 mt-4">
                                {analysis.dplusByGrade.map((b, i) => (
                                    <div key={i} className="text-center">
                                        <p className="text-lg font-bold text-stone-800">{b.dplus}<span className="text-xs text-stone-400 ml-0.5">m</span></p>
                                        <p className="text-[10px] font-bold text-stone-400">{b.pct}%</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                                { label: 'Distance', value: `${analysis.stats.totalDistanceKm.toFixed(1)} km`, color: 'text-blue-600' },
                                { label: 'D+', value: `${analysis.stats.totalDplus.toFixed(0)} m`, color: 'text-green-600' },
                                { label: 'D-', value: `${analysis.stats.totalDminus.toFixed(0)} m`, color: 'text-blue-500' },
                                { label: 'D+/km', value: `${analysis.stats.dplusPerKm.toFixed(0)} m/km`, color: 'text-amber-600' },
                                { label: 'Pente moy.', value: `${analysis.stats.globalGrade.toFixed(1)}%`, color: 'text-red-600' },
                            ].map((s, i) => (
                                <div key={i} className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm text-center hover:shadow-md transition-shadow">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-1">{s.label}</p>
                                    <p className={`text-xl font-bold ${s.color} tracking-tight`}>{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Top Climbs & Descents */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Climbs */}
                            <div className="rounded-2xl border border-stone-100 bg-white p-4 sm:p-6 shadow-sm">
                                <h4 className="font-bold text-stone-800 flex items-center gap-2 mb-2">
                                    <ArrowUpRight className="w-5 h-5 text-red-500" /> Top montées
                                </h4>
                                <p className="text-xs text-stone-400 mb-4">Les 5 montées les plus exigeantes du parcours, classées par difficulté (combinaison pente × distance × D+).</p>
                                {analysis.topClimbs.length > 0 ? (
                                    <div className="space-y-3">
                                        {analysis.topClimbs.map((c, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100 text-sm">
                                                <div>
                                                    <span className="font-bold text-stone-700">km {c.startKm.toFixed(1)} → {c.endKm.toFixed(1)}</span>
                                                    <span className="ml-2 text-xs text-stone-500">{c.distanceM.toFixed(0)}m</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-red-600">+{c.dPlus.toFixed(0)}m</span>
                                                    <span className="ml-2 text-xs text-stone-400">{c.avgGrade.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-stone-400">Aucune montée significative détectée.</p>}
                            </div>
                            {/* Descents */}
                            <div className="rounded-2xl border border-stone-100 bg-white p-4 sm:p-6 shadow-sm">
                                <h4 className="font-bold text-stone-800 flex items-center gap-2 mb-2">
                                    <ArrowDownRight className="w-5 h-5 text-blue-500" /> Top descentes
                                </h4>
                                <p className="text-xs text-stone-400 mb-4">Les 5 descentes les plus techniques, classées par difficulté.</p>
                                {analysis.topDescents.length > 0 ? (
                                    <div className="space-y-3">
                                        {analysis.topDescents.map((c, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-sm">
                                                <div>
                                                    <span className="font-bold text-stone-700">km {c.startKm.toFixed(1)} → {c.endKm.toFixed(1)}</span>
                                                    <span className="ml-2 text-xs text-stone-500">{c.distanceM.toFixed(0)}m</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-blue-600">-{c.dMinus.toFixed(0)}m</span>
                                                    <span className="ml-2 text-xs text-stone-400">{c.avgGrade.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-stone-400">Aucune descente significative détectée.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Dashboard Grid Layout for Force-Velocity */}
            <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-[2rem] shadow-[0_2px_40px_rgb(0,0,0,0.04)] border border-stone-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                    <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-3">
                        <div className="p-2.5 bg-stone-100 rounded-xl"><Activity className="text-stone-600 w-5 h-5" /></div>
                        Profil Force-Vitesse (Montée)
                    </h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_1fr] gap-6 lg:gap-8 items-start">
                    {/* COLUMN 1: Inputs & Diagnostic */}
                    <div className="flex flex-col gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-2">Tests de Référence</h3>
                            
                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100/80">
                                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3">Plat : 5 min</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">Allure moy.</label>
                                        <input type="text" value={ref5min.pace} onChange={e => setRef5min(p => ({ ...p, pace: e.target.value }))} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm transition-all focus:border-stone-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">FC moy.</label>
                                        <input type="number" value={ref5min.hr} onChange={e => setRef5min(p => ({ ...p, hr: e.target.value }))} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm transition-all focus:border-stone-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider flex items-center gap-1"><Zap className="w-3 h-3"/>Watts</label>
                                        <input type="number" value={ref5min.power} onChange={e => setRef5min(p => ({ ...p, power: e.target.value }))} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm transition-all focus:border-stone-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100/80">
                                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3">Plat : 12 min</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">Allure moy.</label>
                                        <input type="text" value={ref12min.pace} onChange={e => setRef12min(p => ({ ...p, pace: e.target.value }))} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm transition-all focus:border-stone-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">FC moy.</label>
                                        <input type="number" value={ref12min.hr} onChange={e => setRef12min(p => ({ ...p, hr: e.target.value }))} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm transition-all focus:border-stone-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider flex items-center gap-1"><Zap className="w-3 h-3"/>Watts</label>
                                        <input type="number" value={ref12min.power} onChange={e => setRef12min(p => ({ ...p, power: e.target.value }))} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm transition-all focus:border-stone-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-widest flex items-center gap-1">Côte : Test Max</h4>
                                    <span className="text-[9px] uppercase tracking-wider font-bold text-red-500 bg-white px-2 py-0.5 rounded-full">{slopeTestDuration} min</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">Pente %</label>
                                        <input type="number" value={slope} onChange={e => setSlope(e.target.value)} className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm transition-all focus:border-red-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">Poids kg</label>
                                        <input type="number" value={mass} onChange={e => setMass(e.target.value)} className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm transition-all focus:border-red-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">Allure obtenue</label>
                                        <input type="text" value={slopeTestPace} onChange={e => setSlopeTestPace(e.target.value)} className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm transition-all focus:border-red-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">Durée test</label>
                                        <input type="range" min={5} max={12} step={1} value={slopeTestDuration} onChange={e => setSlopeTestDuration(Number(e.target.value))} className="w-full h-1 accent-red-600 rounded-full bg-red-200 cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {forceVelocity?.coaching && (
                            <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 shadow-sm mt-4 flex flex-col gap-3">
                                <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5"><Info className="w-4 h-4 text-stone-600" /> Profil d'Entraînement</h3>
                                <div>
                                    <p className="font-bold text-stone-900 text-base mb-1">{forceVelocity.coaching.title}</p>
                                    <p className="text-sm font-medium leading-relaxed text-stone-700 mb-2">{forceVelocity.coaching.description}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">Conseil Coach</h4>
                                    <p className="text-sm leading-relaxed text-stone-800 mb-3">{forceVelocity.coaching.advice}</p>
                                </div>
                                <div className="p-3 bg-white/80 rounded-xl border border-stone-200">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">Séance Type : {forceVelocity.coaching.session.name}</h4>
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100/50 px-1.5 py-0.5 rounded">Débutant</span>
                                            <p className="text-stone-900 font-semibold text-xs mt-0.5">{forceVelocity.coaching.session.debutant}</p>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100/50 px-1.5 py-0.5 rounded">Confirmé</span>
                                            <p className="text-stone-900 font-semibold text-xs mt-0.5">{forceVelocity.coaching.session.confirme}</p>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100/50 px-1.5 py-0.5 rounded">Expert</span>
                                            <p className="text-stone-900 font-semibold text-xs mt-0.5">{forceVelocity.coaching.session.expert}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* COLUMN 2: KPIs & Data Tables */}
                    <div className="flex flex-col gap-6 lg:border-none border-y border-stone-100 py-6 lg:py-0">
                        {forceVelocity ? (
                            <>
                                <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-1">Métriques Profil</h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-blue-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1 flex items-center gap-1">VAM Critique</p>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <p className="text-4xl font-black tracking-tight text-stone-800">{forceVelocity.vamCriticalPerHour.toFixed(0)}</p>
                                            <span className="text-sm font-bold text-stone-400">m/h</span>
                                        </div>
                                    </div>
                                    
                                    <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-emerald-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Indice Côte/Plat</p>
                                        <p className="text-4xl font-black tracking-tight text-stone-800 mt-1">{forceVelocity.ratio.toFixed(2)}</p>
                                    </div>

                                    <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-amber-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">VC Côte</p>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <p className="text-4xl font-black tracking-tight text-stone-800">{forceVelocity.vcClimb.toFixed(1)}</p>
                                            <span className="text-sm font-bold text-stone-400">km/h</span>
                                        </div>
                                    </div>

                                    {forceVelocity.wpPerKg ? (
                                        <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 shadow-md border-t-4 border-t-stone-700 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Watts / kg Rép.</p>
                                            <div className="flex items-baseline gap-1 mt-1">
                                                <p className="text-4xl font-black tracking-tight text-white">{forceVelocity.wpPerKg.toFixed(1)}</p>
                                                <span className="text-sm font-bold text-stone-400">W/kg</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-purple-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">VC Plat Estimée</p>
                                            <div className="flex items-baseline gap-1 mt-1">
                                                <p className="text-4xl font-black tracking-tight text-stone-800">{forceVelocity.vc.toFixed(1)}</p>
                                                <span className="text-sm font-bold text-stone-400">km/h</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="mt-2 p-4 rounded-2xl bg-white border border-stone-100 shadow-sm">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-4">Allures par pente (% VC)</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs text-center border-collapse">
                                            <thead className="bg-stone-50 text-stone-500 uppercase font-bold tracking-wider">
                                                <tr>
                                                    <th className="px-2 py-2 text-left bg-stone-100/50 rounded-tl-lg rounded-bl-lg">Pente</th>
                                                    {forceVelocity.intensities.filter((_,i) => i%2===0).map((p, idx, arr) => (
                                                        <th key={p} className={`px-2 py-2 ${idx === arr.length - 1 ? 'rounded-tr-lg rounded-br-lg bg-stone-100/50' : ''}`}>{Math.round(p * 100)}%</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                                {forceVelocity.slopeTable.slice(0, 6).map((row, i) => (
                                                    <tr key={row.slope} className="hover:bg-stone-50/50 transition-colors border-b border-stone-50 last:border-0">
                                                        <td className="px-2 py-1.5 font-bold text-stone-800 text-left bg-stone-50/30">{row.slope}%</td>
                                                        {row.speeds.filter((_,i) => i%2===0).map((s, j) => (
                                                            <td key={j} className="px-2 py-1.5">
                                                                <div className="font-medium text-stone-700">{s.speed}</div>
                                                                <div className="text-[9px] text-stone-400 font-mono">{s.pace}</div>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-stone-200 rounded-3xl">
                                <p className="text-sm text-stone-400 text-center px-8">Saisis tes références pour analyser ton profil.</p>
                            </div>
                        )}
                    </div>

                    {/* COLUMN 3: Zones (Ascensionnelles) */}
                    <div className="flex flex-col gap-6">
                        {forceVelocity && (
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5"><Mountain className="w-4 h-4 text-stone-500" /> Zones VAM</h3>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {forceVelocity.vamZones.map((vz, i) => {
                                        const pz = forceVelocity.powerZones[i];
                                        
                                        // Intense colors for zones
                                        const zoneColors = [
                                            'bg-blue-500', 
                                            'bg-emerald-500', 
                                            'bg-lime-500', 
                                            'bg-amber-500', 
                                            'bg-red-500', 
                                            'bg-purple-500'
                                        ];

                                        return (
                                            <div key={i} className="flex flex-col p-3 rounded-xl border border-stone-100/80 bg-stone-50 relative overflow-hidden group hover:border-stone-200 transition-colors">
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${zoneColors[i]}`}></div>
                                                <div className="pl-3">
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <span className="text-xs font-bold text-stone-800">{vz.name}</span>
                                                        <span className="text-[10px] font-bold text-stone-400">Z{i+1}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                                                        <div>
                                                            <p className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">VAM m/h</p>
                                                            <p className="text-xs font-semibold text-stone-700">{vz.range}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">Watts</p>
                                                            <p className="text-xs font-black text-stone-700">{pz ? pz.range.replace(' W', '') : '-'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
