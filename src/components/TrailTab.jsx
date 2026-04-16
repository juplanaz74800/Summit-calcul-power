import { useState, useMemo, useCallback } from 'react';
import { Mountain, Upload, ArrowUpRight, ArrowDownRight, Activity, Info, Zap, Clock, Droplets, Utensils, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { parseGPX, analyzeProfile } from '../utils/gpx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, ReferenceLine, ReferenceArea } from 'recharts';
import { paceToSpeed, speedToPace, timeToSeconds, formatTime } from '../utils/formatters';
import { fitModel } from '../utils/calculations';
import { getTrailCoaching, getTrailReport } from '../utils/coaching';

const TICK = { fill: '#78716c', fontSize: 10, fontWeight: 500 };

export default function TrailTab() {
    const [gpxData, setGpxData] = useState(null);
    const [fileName, setFileName] = useState('');
    const [dragging, setDragging] = useState(false);
    const [intensity, setIntensity] = useState(85);
    const [showReport, setShowReport] = useState(false);
    const [activeSegment, setActiveSegment] = useState(null);

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

        const vClimbFromPace = paceToSpeed(slopeTestPace);
        const vcClimb = vClimbFromPace > 0 ? vClimbFromPace : 5.5; // Vitesse réelle max du test

        // VC plat estimée
        const vc = v12 * 0.95;

        // Estimer la vitesse sur le plat pour la même durée que le test en côte
        const t5 = 5;
        const t12 = 12;
        const tTest = slopeTestDuration || 8;
        const decayRate = (v12 - v5) / (t12 - t5);
        let vFlatAtTestDuration = v5 + decayRate * (tTest - t5);
        if (vFlatAtTestDuration > v5) vFlatAtTestDuration = v5;
        if (vFlatAtTestDuration <= 0) vFlatAtTestDuration = (v5 + v12) / 2;

        // Ratio d'endurance de cet athlète
        const enduranceRatio = vc / vFlatAtTestDuration;
        
        // VC Théorique stricte sur la pente du test (dégradée par rapport au test max)
        const vcTheoriquePente = vcClimb * enduranceRatio;

        // Indice côte/plat : compare la vitesse réelle en côte du test à la vitesse prédite 
        // pour un profil neutre SUR LA MÊME DURÉE DE TEST.
        const predictedClimbTestSpeed = vFlatAtTestDuration / (1 + (slopeVal / 100) * 10);
        const ratio = predictedClimbTestSpeed > 0 ? vcClimb / predictedClimbTestSpeed : 1;

        let profileLabel, profileDesc;
        if (ratio > 1.05) { profileLabel = 'Orienté FORCE — Grimpeur fort'; profileDesc = `Test à ${vcClimb.toFixed(1)} km/h alors qu'un profil neutre monterait à ${predictedClimbTestSpeed.toFixed(1)} km/h. Tu excelles clairement en montée.`; }
        else if (ratio < 0.85) { profileLabel = 'Orienté VITESSE — Rouleur rapide'; profileDesc = `Test à ${vcClimb.toFixed(1)} km/h alors qu'un profil neutre monterait à ${predictedClimbTestSpeed.toFixed(1)} km/h. La force musculaire en côte est ton facteur limitant.`; }
        else { profileLabel = 'Polyvalent FORCE-VITESSE'; profileDesc = `Vitesse en côte cohérente avec tes capacités sur le plat (prédit : ${predictedClimbTestSpeed.toFixed(1)} km/h). Ton profil est remarquablement bien équilibré.`; }

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
        const intensities = [1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5];
        const slopeTable = slopes.map(s => {
            // Apply athlete's ratio progressively based on slope (0 at flat, full ratio at test slope and beyond)
            const ratioWeight = slopeVal > 0 ? Math.min(s / slopeVal, 1) : 0;
            const effectiveRatio = s > 0 ? (1 + (ratio - 1) * ratioWeight) : 1;
            
            return {
                slope: s,
                speeds: intensities.map(pct => {
                    const baseTheoreticalSpeed = (vc * pct) / (1 + (s / 100) * 10);
                    const speed = baseTheoreticalSpeed * effectiveRatio;
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

        return { vc, vcClimb, vcTheoriquePente, ratio, profileLabel, profileDesc, vamCriticalPerHour, vamZones, slopeTable, intensities, slopeTestDuration, runningCP, powerZones, wpPerKg, slopePower: pSlope, coaching };
    }, [ref5min, ref12min, slope, mass, slopeTestPace, slopeTestDuration, slopeTestPower]);

    const report = useMemo(() => {
        if (!showReport || !analysis || !forceVelocity) return null;
        return getTrailReport(analysis, forceVelocity, intensity);
    }, [showReport, analysis, forceVelocity, intensity]);

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

                {/* Report Generation Button */}
                {analysis && forceVelocity && !showReport && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={() => setShowReport(true)}
                            className="group relative flex items-center gap-3 px-8 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <ShieldCheck className="w-5 h-5 text-emerald-400 relative z-10" />
                            <span className="relative z-10">Générer le Rapport de Course Final</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Final Report Section */}
            {showReport && report && (
                <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 pointer-events-none" />
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
                        <div>
                            <h2 className="text-3xl font-black text-stone-800 flex items-center gap-3">
                                <div className="p-3 bg-emerald-100 rounded-2xl"><ShieldCheck className="text-emerald-600 w-6 h-6" /></div>
                                Rapport de Course Final
                            </h2>
                            <p className="text-stone-400 font-medium mt-1 ml-1">Analyse prédictive basée sur {intensity}% de tes capacités critiques.</p>
                        </div>
                        <div className="bg-stone-50 p-4 rounded-3xl border border-stone-100 min-w-[240px]">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Intensité Cible</span>
                                <span className="text-sm font-black text-emerald-600">{intensity}%</span>
                            </div>
                            <input 
                                type="range" min="60" max="105" step="5" 
                                value={intensity} 
                                onChange={(e) => setIntensity(Number(e.target.value))} 
                                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                            />
                            <div className="flex justify-between mt-1 text-[8px] font-bold text-stone-300">
                                <span>ENDURANCE</span>
                                <span>RACE</span>
                                <span>MAX</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
                        {/* Main Prediction */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-stone-800 to-stone-900 p-6 rounded-[2rem] text-white shadow-xl shadow-stone-200">
                                    <div className="flex items-center gap-2 text-stone-400 mb-2">
                                        <Clock className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Temps Final Estimé</span>
                                    </div>
                                    <div className="text-5xl font-black tracking-tighter mb-2">{report.formattedTime}</div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-emerald-400">Allure moy. {report.avgPace}</span>
                                        <span className="text-stone-500">•</span>
                                        <span className="text-xs font-bold text-stone-400">{analysis.stats.totalDistanceKm.toFixed(1)} km</span>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex flex-col justify-between">
                                    <div className="flex items-center gap-2 text-stone-400 mb-4">
                                        <TrendingUp className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Stratégie d'effort</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-end justify-between">
                                            <span className="text-sm font-bold text-stone-700">D+ Cumulé</span>
                                            <span className="text-xl font-black text-stone-900">+{report.climbDist.toFixed(0)}m</span>
                                        </div>
                                        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden flex">
                                            <div style={{ width: `${analysis.stats.globalGrade * 5}%` }} className="bg-red-400 h-full" />
                                            <div style={{ width: `${100 - analysis.stats.globalGrade * 5}%` }} className="bg-emerald-400 h-full" />
                                        </div>
                                        <p className="text-[10px] text-stone-400 font-medium leading-relaxed italic">
                                            Estimation basée sur un modèle de descente dynamique (plus rapide entre -5/-12%, ralentissement beyond -20%).
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Crux Section */}
                            {report.crux && (
                                <div className="bg-red-50/50 border border-red-100 p-6 rounded-[2rem] relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <AlertTriangle className="w-24 h-24 text-red-600" />
                                    </div>
                                    <div className="flex items-center gap-2 text-red-600 mb-3 relative z-10">
                                        <AlertTriangle className="w-5 h-5 font-black" />
                                        <span className="text-xs font-black uppercase tracking-widest">Le Passage Clé (Crux)</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center relative z-10">
                                        <div className="flex-1">
                                            <h4 className="text-lg font-bold text-stone-800 mb-1">Montée : km {report.crux.startKm.toFixed(1)} → {report.crux.endKm.toFixed(1)}</h4>
                                            <p className="text-sm text-stone-600 font-medium leading-relaxed">{report.cruxAdvice}</p>
                                        </div>
                                        <div className="bg-white px-4 py-3 rounded-2xl border border-red-100 shadow-sm text-center min-w-[120px]">
                                            <div className="text-2xl font-black text-red-600">+{report.crux.dPlus.toFixed(0)}m</div>
                                            <div className="text-[10px] font-bold text-stone-400 uppercase">{report.crux.avgGrade.toFixed(1)}% moy.</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Predictive Strategy Chart */}
                            <div className="bg-white border border-stone-100 p-6 rounded-[2rem] shadow-sm relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-sm font-black text-stone-800 uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                                        Profil Stratégique
                                    </h3>
                                    <div className="flex gap-4 text-[9px] font-bold uppercase tracking-wider">
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-2 bg-red-500/10 border border-red-200 rounded" /> Montées (Top 5)</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-2 bg-blue-500/10 border border-blue-200 rounded" /> Descentes (Top 5)</div>
                                    </div>
                                </div>
                                <div className="h-48 sm:h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart 
                                            data={analysis.profile} 
                                            onMouseMove={(e) => {
                                                if (e.activeLabel) {
                                                    const dist = Number(e.activeLabel);
                                                    const seg = [...report.topClimbEstimates, ...report.topDescentEstimates].find(s => dist >= s.startKm && dist <= s.endKm);
                                                    setActiveSegment(seg ? `${seg.type}-${seg.startKm.toFixed(1)}` : null);
                                                }
                                            }}
                                            onMouseLeave={() => setActiveSegment(null)}
                                        >
                                            <defs>
                                                <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                                            <XAxis dataKey="distanceKm" hide />
                                            <YAxis hide domain={['dataMin - 50', 'dataMax + 50']} />
                                            {/* Top climbs highlights */}
                                            {report.topClimbEstimates.map((c, i) => (
                                                <ReferenceArea 
                                                    key={`ref-climb-${i}`} 
                                                    x1={c.startKm} x2={c.endKm} 
                                                    fill={activeSegment === `Montée-${c.startKm.toFixed(1)}` ? "#ef4444" : "#ef4444"} 
                                                    fillOpacity={activeSegment === `Montée-${c.startKm.toFixed(1)}` ? 0.2 : 0.08} 
                                                    stroke="none"
                                                />
                                            ))}
                                            {/* Top descents highlights */}
                                            {report.topDescentEstimates.map((c, i) => (
                                                <ReferenceArea 
                                                    key={`ref-descent-${i}`} 
                                                    x1={c.startKm} x2={c.endKm} 
                                                    fill={activeSegment === `Descente-${c.startKm.toFixed(1)}` ? "#3b82f6" : "#3b82f6"} 
                                                    fillOpacity={activeSegment === `Descente-${c.startKm.toFixed(1)}` ? 0.2 : 0.08} 
                                                    stroke="none"
                                                />
                                            ))}
                                            <Tooltip 
                                                content={({ active, payload, label }) => {
                                                    if (!active || !payload?.length) return null;
                                                    const dist = Number(label);
                                                    const seg = [...report.topClimbEstimates, ...report.topDescentEstimates].find(s => dist >= s.startKm && dist <= s.endKm);
                                                    return (
                                                        <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-stone-100 max-w-[200px]">
                                                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex justify-between">
                                                                <span>Km {dist.toFixed(2)}</span>
                                                                <span>{payload[0].value.toFixed(0)} m</span>
                                                            </div>
                                                            {seg ? (
                                                                <div className="space-y-2">
                                                                    <div className={`text-xs font-black uppercase tracking-tight py-1 px-2 rounded-lg inline-block ${seg.type === 'Montée' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                        {seg.type === 'Montée' ? 'Montée' : 'Descente'}
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div>
                                                                            <p className="text-[8px] font-bold text-stone-400 uppercase">Temps</p>
                                                                            <p className="text-sm font-black text-stone-800">{seg.formattedTime}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[8px] font-bold text-stone-400 uppercase">Allure</p>
                                                                            <p className="text-sm font-black text-stone-800">{seg.avgPace}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs font-bold text-stone-400 italic">Pente : {payload[0].payload.grade.toFixed(1)}%</p>
                                                            )}
                                                        </div>
                                                    );
                                                }}
                                            />
                                            <Area type="monotone" dataKey="elevation" stroke="#10b981" strokeWidth={2} fill="url(#stratGrad)" isAnimationActive={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-center text-[10px] font-bold text-stone-400 mt-2 uppercase tracking-widest">Passe la souris sur le profil pour voir la stratégie</p>
                            </div>

                            {/* Detailed Segments Table */}
                            <div className="bg-white border border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-stone-50 bg-stone-50/50">
                                    <h3 className="text-sm font-black text-stone-800 uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                                        Détail des Sections Majeures
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-50/30">
                                                <th className="px-6 py-3">Section</th>
                                                <th className="px-6 py-3">Dénivelé</th>
                                                <th className="px-6 py-3">Distance</th>
                                                <th className="px-6 py-3">Temps Estimé</th>
                                                <th className="px-6 py-3 text-right">Allure Cible</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-stone-50">
                                            {/* Top Climbs */}
                                            {report.topClimbEstimates.map((c, i) => {
                                                const isActive = activeSegment === `Montée-${c.startKm.toFixed(1)}`;
                                                return (
                                                    <tr 
                                                        key={`climb-${i}`} 
                                                        className={`transition-all duration-200 ${isActive ? 'bg-red-50 relative z-10 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.1)]' : 'hover:bg-red-50/30'}`}
                                                        onMouseEnter={() => setActiveSegment(`Montée-${c.startKm.toFixed(1)}`)}
                                                        onMouseLeave={() => setActiveSegment(null)}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>
                                                                    <ArrowUpRight className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-stone-800">Montée km {c.startKm.toFixed(1)}</div>
                                                                    <div className="text-[10px] text-stone-400 font-bold uppercase">{c.avgGrade.toFixed(1)}% moy.</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 font-bold text-red-600">+{c.dPlus.toFixed(0)}m</td>
                                                        <td className="px-6 py-4 text-stone-500 font-medium">{c.distanceM.toFixed(0)}m</td>
                                                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-lg font-black transition-colors ${isActive ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-700'}`}>{c.formattedTime}</span></td>
                                                        <td className="px-6 py-4 text-right font-mono font-bold text-stone-400">{c.avgPace} <span className="text-[9px]">/km</span></td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Top Descents */}
                                            {report.topDescentEstimates.map((c, i) => {
                                                const isActive = activeSegment === `Descente-${c.startKm.toFixed(1)}`;
                                                return (
                                                    <tr 
                                                        key={`descent-${i}`} 
                                                        className={`transition-all duration-200 ${isActive ? 'bg-blue-50 relative z-10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]' : 'hover:bg-blue-50/30'}`}
                                                        onMouseEnter={() => setActiveSegment(`Descente-${c.startKm.toFixed(1)}`)}
                                                        onMouseLeave={() => setActiveSegment(null)}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                                                    <ArrowDownRight className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-stone-800">Descente km {c.startKm.toFixed(1)}</div>
                                                                    <div className="text-[10px] text-stone-400 font-bold uppercase">{Math.abs(c.avgGrade).toFixed(1)}% moy.</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 font-bold text-blue-600">-{Math.abs(c.dMinus).toFixed(0)}m</td>
                                                        <td className="px-6 py-4 text-stone-500 font-medium">{c.distanceM.toFixed(0)}m</td>
                                                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-lg font-black transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-700'}`}>{c.formattedTime}</span></td>
                                                        <td className="px-6 py-4 text-right font-mono font-bold text-stone-400">{c.avgPace} <span className="text-[9px]">/km</span></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Nutrition & Logistics */}
                        <div className="space-y-6">
                            <div className="bg-emerald-900 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-900/10">
                                <div className="flex items-center gap-2 text-emerald-300 mb-6">
                                    <Droplets className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Logistique & Nutrition</span>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white/10 rounded-2xl"><Droplets className="w-5 h-5 text-emerald-300" /></div>
                                        <div>
                                            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Hydratation Totale</div>
                                            <div className="text-2xl font-black">{report.waterLiters} Litres</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white/10 rounded-2xl"><Utensils className="w-5 h-5 text-emerald-300" /></div>
                                        <div>
                                            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Énergie (Carbs)</div>
                                            <div className="text-2xl font-black">{report.carbsGrams}g totaux</div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-white/10">
                                        <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1">Conseil Coach</div>
                                        <p className="text-xs text-white/70 leading-relaxed font-medium">
                                            Vise environ 650ml d'eau et 75g de glucides par heure. Ajuste selon la météo.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-stone-50 border border-stone-200 p-5 rounded-[2rem]">
                                <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Résumé de l'analyse</h4>
                                <ul className="space-y-3">
                                    <li className="flex items-center justify-between text-xs">
                                        <span className="text-stone-500 font-medium">Points de calcul</span>
                                        <span className="font-bold text-stone-800">{analysis.profile.length}</span>
                                    </li>
                                    <li className="flex items-center justify-between text-xs">
                                        <span className="text-stone-500 font-medium">Poids athlète</span>
                                        <span className="font-bold text-stone-800">{mass} kg</span>
                                    </li>
                                    <li className="flex items-center justify-between text-xs">
                                        <span className="text-stone-500 font-medium">Dérive fatigue</span>
                                        <span className="font-bold text-emerald-600">Calculée</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                        <div className="bg-white p-5 rounded-[2rem] border border-stone-200 shadow-sm space-y-5">
                            {/* Tests sur Plat */}
                            <div>
                                <h3 className="text-xs font-bold text-stone-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="w-5 h-5 bg-stone-100 rounded flex items-center justify-center"><Activity className="w-3 h-3 text-stone-600"/></div>
                                    Tests sur Plat
                                </h3>
                                
                                <div className="space-y-2.5">
                                    <div className="flex px-2 text-[8px] font-bold text-stone-400 uppercase tracking-widest">
                                        <div className="w-14">Test</div>
                                        <div className="flex-1">Allure</div>
                                        <div className="w-16 text-center">BPM</div>
                                        <div className="w-16 text-center">Watts</div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 bg-stone-50/50 hover:bg-stone-50 p-2 rounded-xl border border-stone-100 transition-colors focus-within:border-stone-300 focus-within:bg-white">
                                        <div className="w-14 text-center shrink-0">
                                            <span className="text-[10px] font-black text-stone-500 bg-stone-200/50 px-2 py-1 rounded-lg">5 MIN</span>
                                        </div>
                                        <div className="flex-1">
                                            <input type="text" placeholder="04:00" value={ref5min.pace} onChange={e => setRef5min(p => ({ ...p, pace: e.target.value }))} className="w-full text-sm bg-transparent px-2 py-1 font-bold text-stone-700 outline-none placeholder:text-stone-300" />
                                        </div>
                                        <div className="w-16 shrink-0 border-l border-stone-200 pl-2">
                                            <input type="number" placeholder="175" value={ref5min.hr} onChange={e => setRef5min(p => ({ ...p, hr: e.target.value }))} className="w-full text-sm bg-transparent py-1 font-semibold text-stone-600 outline-none placeholder:text-stone-300 text-center" />
                                        </div>
                                        <div className="w-16 shrink-0 border-l border-stone-200 pl-2">
                                            <input type="number" placeholder="-" value={ref5min.power} onChange={e => setRef5min(p => ({ ...p, power: e.target.value }))} className="w-full text-sm bg-transparent py-1 font-semibold text-stone-600 outline-none placeholder:text-stone-300 text-center" />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 bg-stone-50/50 hover:bg-stone-50 p-2 rounded-xl border border-stone-100 transition-colors focus-within:border-stone-300 focus-within:bg-white">
                                        <div className="w-14 text-center shrink-0">
                                            <span className="text-[10px] font-black text-stone-500 bg-stone-200/50 px-2 py-1 rounded-lg">12 MIN</span>
                                        </div>
                                        <div className="flex-1">
                                            <input type="text" placeholder="04:30" value={ref12min.pace} onChange={e => setRef12min(p => ({ ...p, pace: e.target.value }))} className="w-full text-sm bg-transparent px-2 py-1 font-bold text-stone-700 outline-none placeholder:text-stone-300" />
                                        </div>
                                        <div className="w-16 shrink-0 border-l border-stone-200 pl-2">
                                            <input type="number" placeholder="168" value={ref12min.hr} onChange={e => setRef12min(p => ({ ...p, hr: e.target.value }))} className="w-full text-sm bg-transparent py-1 font-semibold text-stone-600 outline-none placeholder:text-stone-300 text-center" />
                                        </div>
                                        <div className="w-16 shrink-0 border-l border-stone-200 pl-2">
                                            <input type="number" placeholder="-" value={ref12min.power} onChange={e => setRef12min(p => ({ ...p, power: e.target.value }))} className="w-full text-sm bg-transparent py-1 font-semibold text-stone-600 outline-none placeholder:text-stone-300 text-center" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Test en Côte */}
                            <div className="pt-4 border-t border-stone-100">
                                <h3 className="text-xs font-bold text-red-700 uppercase tracking-widest mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-red-100 rounded flex items-center justify-center"><Mountain className="w-3 h-3 text-red-600"/></div>
                                        Test en Côte
                                    </div>
                                </h3>
                                
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div className="bg-red-50/50 p-2 rounded-xl border border-red-100 focus-within:border-red-300 focus-within:bg-white transition-colors">
                                        <label className="block text-[8px] font-bold text-stone-400 uppercase tracking-wider mb-0.5 px-1">Pente (%)</label>
                                        <input type="number" value={slope} onChange={e => setSlope(e.target.value)} className="w-full bg-transparent px-1 text-sm font-bold text-stone-800 outline-none" />
                                    </div>
                                    <div className="bg-red-50/50 p-2 rounded-xl border border-red-100 focus-within:border-red-300 focus-within:bg-white transition-colors">
                                        <label className="block text-[8px] font-bold text-stone-400 uppercase tracking-wider mb-0.5 px-1">Allure moy.</label>
                                        <input type="text" value={slopeTestPace} onChange={e => setSlopeTestPace(e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm font-bold text-stone-800 outline-none" placeholder="ex: 08:00" />
                                    </div>
                                    <div className="bg-red-50/50 p-2 rounded-xl border border-red-100 focus-within:border-red-300 focus-within:bg-white transition-colors">
                                        <label className="block text-[8px] font-bold text-stone-400 uppercase tracking-wider mb-0.5 px-1">Poids (kg)</label>
                                        <input type="number" value={mass} onChange={e => setMass(e.target.value)} className="w-full bg-transparent px-1 text-sm font-medium text-stone-700 outline-none" />
                                    </div>
                                    <div className="bg-red-50/50 p-2 rounded-xl border border-red-100 flex flex-col justify-center relative">
                                        <label className="block text-[8px] font-bold text-stone-400 uppercase tracking-wider mb-1 px-1">Durée : {slopeTestDuration} min</label>
                                        <div className="px-1"><input type="range" min={5} max={12} step={1} value={slopeTestDuration} onChange={e => setSlopeTestDuration(Number(e.target.value))} className="w-full h-1 accent-red-500 bg-red-200 cursor-pointer" /></div>
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
                                {/* Diagnostic de Performance Trail */}
                                <div className="p-6 rounded-[2rem] bg-stone-50 border border-stone-200 text-center shadow-sm">
                                    <div className={`inline-block px-4 py-2 rounded-full font-bold text-sm mb-4 ${forceVelocity.ratio > 1.05 ? 'bg-emerald-100 text-emerald-800' : forceVelocity.ratio < 0.85 ? 'bg-blue-100 text-blue-800' : 'bg-stone-200 text-stone-800'}`}>
                                        {forceVelocity.profileLabel}
                                    </div>
                                    <div className="text-5xl font-black text-stone-800 tracking-tighter mb-1">
                                        {forceVelocity.ratio.toFixed(2)}
                                    </div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-4">Indice côte/plat</p>
                                    <p className="text-sm font-medium text-stone-600 leading-relaxed max-w-sm mx-auto">
                                        {forceVelocity.profileDesc}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Métriques Clés</h3>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 rounded-[2rem] bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden col-span-2 sm:col-span-1 flex flex-col justify-center">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100 mb-1 relative z-10">VC Théorique ({slope}%)</p>
                                        <div className="flex items-baseline gap-1 mt-1 relative z-10">
                                            <p className="text-5xl font-black tracking-tight text-white">{forceVelocity.vcTheoriquePente.toFixed(2)}</p>
                                            <span className="text-lg font-bold text-blue-100">km/h</span>
                                        </div>
                                    </div>

                                    <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-emerald-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Indice Côte/Plat</p>
                                        <p className="text-4xl font-black tracking-tight text-stone-800 mt-1">{forceVelocity.ratio.toFixed(2)}</p>
                                    </div>
                                    
                                    <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-cyan-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1 flex items-center gap-1">VAM Critique</p>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <p className="text-4xl font-black tracking-tight text-stone-800">{forceVelocity.vamCriticalPerHour.toFixed(0)}</p>
                                            <span className="text-sm font-bold text-stone-400">m/h</span>
                                        </div>
                                    </div>

                                    <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-amber-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Vitesse Test Côte</p>
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
                                                    {forceVelocity.intensities.map((p, idx, arr) => (
                                                        <th key={p} className={`px-2 py-2 ${idx === arr.length - 1 ? 'rounded-tr-lg rounded-br-lg bg-stone-100/50' : ''}`}>{Math.round(p * 100)}%</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                                {forceVelocity.slopeTable.map((row, i) => (
                                                    <tr key={row.slope} className="hover:bg-stone-50/50 transition-colors border-b border-stone-50 last:border-0">
                                                        <td className="px-2 py-1.5 font-bold text-stone-800 text-left bg-stone-50/30">{row.slope}%</td>
                                                        {row.speeds.map((s, j) => (
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
