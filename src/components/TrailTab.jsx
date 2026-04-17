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
    const [hrThreshold, setHrThreshold] = useState('175');

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

        // Speed by slope table
        const slopes = [0, 2, 4, 6, 8, 10, 12, 15, 20];
        const intensities = [1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5];
        const slopeTable = slopes.map(s => {
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
        let wpPerKg = null;
        if (p5 > 0 && p12 > 0) {
            const powerFit = fitModel([{ t: 300, v: p5 }, { t: 720, v: p12 }]);
            if (powerFit) {
                runningCP = powerFit.cp;
            }
        }
        if (pSlope > 0 && massVal > 0) {
            wpPerKg = pSlope / massVal;
        }

        const coaching = getTrailCoaching(ratio, vamCriticalPerHour);

        const hrt = parseFloat(hrThreshold);
        const masterZones = [
            { name: 'RÉCUPÉRATION', vam: `${(vamCriticalPerHour * 0.55).toFixed(0)} - ${(vamCriticalPerHour * 0.75).toFixed(0)}`, hr: hrt ? `${Math.round(hrt * 0.65)} - ${Math.round(hrt * 0.82)}` : null, watt: runningCP ? `${Math.round(runningCP * 0.55)} - ${Math.round(runningCP * 0.75)} W` : null, color: 'bg-blue-500/10 text-blue-800', dot: 'bg-blue-500' },
            { name: 'ENDURANCE', vam: `${(vamCriticalPerHour * 0.75).toFixed(0)} - ${(vamCriticalPerHour * 0.88).toFixed(0)}`, hr: hrt ? `${Math.round(hrt * 0.82)} - ${Math.round(hrt * 0.89)}` : null, watt: runningCP ? `${Math.round(runningCP * 0.75)} - ${Math.round(runningCP * 0.88)} W` : null, color: 'bg-emerald-500/10 text-emerald-800', dot: 'bg-emerald-500' },
            { name: 'TEMPO', vam: `${(vamCriticalPerHour * 0.88).toFixed(0)} - ${(vamCriticalPerHour * 0.95).toFixed(0)}`, hr: hrt ? `${Math.round(hrt * 0.89)} - ${Math.round(hrt * 0.94)}` : null, watt: runningCP ? `${Math.round(runningCP * 0.88)} - ${Math.round(runningCP * 0.95)} W` : null, color: 'bg-lime-500/10 text-lime-800', dot: 'bg-lime-500' },
            { name: 'SEUIL', vam: `${(vamCriticalPerHour * 0.95).toFixed(0)} - ${(vamCriticalPerHour * 1.0).toFixed(0)}`, hr: hrt ? `${Math.round(hrt * 0.94)} - ${Math.round(hrt * 1.0)}` : null, watt: runningCP ? `${Math.round(runningCP * 0.95)} - ${Math.round(runningCP * 1.0)} W` : null, color: 'bg-amber-500/10 text-amber-800', dot: 'bg-amber-500' },
            { name: 'V-ZONE', vam: `${(vamCriticalPerHour * 1.0).toFixed(0)} - ${(vamCriticalPerHour * 1.15).toFixed(0)}`, hr: hrt ? `${Math.round(hrt * 1.0)} - ${Math.round(hrt * 1.06)}` : null, watt: runningCP ? `${Math.round(runningCP * 1.0)} - ${Math.round(runningCP * 1.15)} W` : null, color: 'bg-red-500/10 text-red-800', dot: 'bg-red-500' },
            { name: 'SPRINT', vam: `> ${(vamCriticalPerHour * 1.15).toFixed(0)}`, hr: hrt ? `> ${Math.round(hrt * 1.06)}` : null, watt: runningCP ? `> ${Math.round(runningCP * 1.15)} W` : null, color: 'bg-purple-500/10 text-purple-800', dot: 'bg-purple-500' },
        ];

        return { vc, vcClimb, vcTheoriquePente, ratio, profileLabel, profileDesc, vamCriticalPerHour, masterZones, slopeTable, intensities, slopeTestDuration, runningCP, wpPerKg, slopePower: pSlope, coaching };
    }, [ref5min, ref12min, slope, mass, slopeTestPace, slopeTestDuration, slopeTestPower, hrThreshold]);

    const report = useMemo(() => {
        if (!showReport || !analysis || !forceVelocity) return null;
        return getTrailReport(analysis, forceVelocity, intensity);
    }, [showReport, analysis, forceVelocity, intensity]);

    return (
        <div className="space-y-8">
            <div className="bg-surface-container-low p-6 sm:p-8 lg:p-10 rounded-[3rem] shadow-2xl shadow-on-surface/5">
                <h2 className="text-3xl font-black text-on-surface mb-8 flex items-center gap-4 font-lexend tracking-tight">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-inner"><Mountain className="text-primary w-6 h-6" /></div>
                    Analyseur GPX Expert
                </h2>
                <div
                    onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                    className={`flex flex-col items-center justify-center relative border-2 border-dashed rounded-[2.5rem] p-12 sm:p-16 text-center cursor-pointer transition-all duration-500 ${dragging ? 'border-primary bg-primary/5 scale-[1.01] shadow-2xl' : 'border-on-surface/10 bg-surface-container/50 hover:border-primary/30 hover:bg-surface-container'}`}
                >
                    <input type="file" accept=".gpx" onChange={e => handleFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className={`p-5 bg-surface rounded-2xl shadow-lg mb-6 transition-transform duration-500 ${dragging ? 'scale-110' : ''}`}>
                        <Upload className={`w-10 h-10 ${dragging ? 'text-primary' : 'text-tertiary'} transition-colors`} />
                    </div>
                    <p className="text-sm font-black text-on-surface mb-2 font-lexend">{fileName || 'Glisser un fichier .gpx ici'}</p>
                    <p className="text-[10px] text-tertiary uppercase tracking-widest font-space font-bold opacity-60">Fichiers supportés : .GPX uniquement</p>
                </div>

                {/* GPX Analysis Grid */}
                {analysis && (
                        <div className="space-y-12 mt-12 bg-surface-container-high/30 p-8 rounded-[3rem]">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] font-lexend">Topographie de Course</h3>
                                <div className="text-[8px] font-black text-tertiary/40 uppercase tracking-[0.2em] font-space italic border border-on-surface/5 px-2 py-1 rounded-lg">Analyse Stochastique v2.1</div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Elevation Profile */}
                                <div className="rounded-[3rem] bg-surface-container p-8 shadow-sm transition-all hover:shadow-lg hover:shadow-on-surface/5 flex flex-col group">
                                    <div className="flex items-center justify-between mb-8 px-2">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-on-surface font-lexend">Profil Altimétrique</span>
                                            <span className="text-[9px] font-bold text-tertiary uppercase tracking-widest font-space opacity-40">Dénivelé cumulé</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest font-space">
                                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-primary/60"></span>Montée</span>
                                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-secondary/60"></span>Descente</span>
                                        </div>
                                    </div>
                                    <div className="h-64 sm:h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analysis.coloredProfile}>
                                                <defs>
                                                    <linearGradient id="climbGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.01} />
                                                    </linearGradient>
                                                    <linearGradient id="descentGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="var(--color-tertiary)" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="var(--color-tertiary)" stopOpacity={0.01} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-on-surface)" strokeOpacity={0.05} vertical={false} />
                                                <XAxis dataKey="distanceKm" tick={{ ...TICK, fill: 'var(--color-tertiary)', opacity: 0.5, fontSize: 9 }} tickFormatter={v => `${Number(v).toFixed(1)}k`} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ ...TICK, fill: 'var(--color-tertiary)', opacity: 0.5, fontSize: 9 }} tickFormatter={v => `${v}m`} domain={['dataMin - 50', 'dataMax + 50']} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', backgroundColor: 'var(--color-surface)', boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.1)', padding: '16px' }} />
                                                <Area type="monotone" dataKey="climb" stroke="var(--color-primary)" strokeWidth={3} fill="url(#climbGrad)" connectNulls={false} isAnimationActive={false} />
                                                <Area type="monotone" dataKey="flat" stroke="var(--color-tertiary)" strokeWidth={2} strokeOpacity={0.3} fill="transparent" connectNulls={false} isAnimationActive={false} />
                                                <Area type="monotone" dataKey="descent" stroke="var(--color-tertiary)" strokeWidth={3} fill="url(#descentGrad)" connectNulls={false} isAnimationActive={false} />
                                                {analysis.majorClimbs.map((mc, idx) => (
                                                    <ReferenceLine key={idx} x={mc.midKm} stroke="var(--color-primary)" strokeDasharray="3 3" strokeWidth={1} label={{ value: `+${mc.dPlus.toFixed(0)}m`, position: 'top', fill: 'var(--color-primary)', fontSize: 10, fontWeight: 900, fontFamily: 'Space Grotesk' }} />
                                                ))}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* D+ Distribution by Grade */}
                                <div className="rounded-[3rem] bg-surface-container p-8 shadow-sm transition-all hover:shadow-lg hover:shadow-on-surface/5 flex flex-col group">
                                    <div className="flex items-center justify-between mb-8 px-2">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-on-surface font-lexend">Répartition par Pente</span>
                                            <span className="text-[9px] font-bold text-tertiary uppercase tracking-widest font-space opacity-40">Analyse de densité</span>
                                        </div>
                                    </div>
                                    <div className="h-52">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analysis.dplusByGrade} barCategoryGap="25%">
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-on-surface)" strokeOpacity={0.05} vertical={false} />
                                                <XAxis dataKey="label" tick={{ ...TICK, fill: 'var(--color-on-surface)', fontSize: 11, fontWeight: 900 }} axisLine={false} tickLine={false} dy={8} />
                                                <YAxis hide />
                                                <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', backgroundColor: 'var(--color-surface)', boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.1)', padding: '16px' }} />
                                                <Bar dataKey="dplus" radius={[12, 12, 0, 0]} isAnimationActive={false}>
                                                    {analysis.dplusByGrade.map((entry, index) => (
                                                        <Cell key={index} fill={['#86efac', '#4ade80', '#fbbf24', '#f87171', '#991b1b'][index]} fillOpacity={0.8} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2 mt-8">
                                        {analysis.dplusByGrade.map((b, i) => (
                                            <div key={i} className="text-center group-hover:transform group-hover:scale-105 transition-transform">
                                                <p className="text-lg font-black text-on-surface font-space">{b.dplus}<span className="text-[10px] text-tertiary ml-0.5 font-normal">m</span></p>
                                                <p className="text-[9px] font-black text-tertiary/40 uppercase tracking-widest font-space italic">{b.pct}%</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Stats KPIs - Expert Dashboard Style */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                                {[
                                    { label: 'Distance', value: `${analysis.stats.totalDistanceKm.toFixed(1)}`, unit: 'km', color: 'text-primary' },
                                    { label: 'D+', value: `+${analysis.stats.totalDplus.toFixed(0)}`, unit: 'm', color: 'text-primary' },
                                    { label: 'D-', value: `-${analysis.stats.totalDminus.toFixed(0)}`, unit: 'm', color: 'text-tertiary' },
                                    { label: 'Densité', value: `${analysis.stats.dplusPerKm.toFixed(0)}`, unit: 'm/km', color: 'text-secondary' },
                                    { label: 'Pente Globale', value: `${analysis.stats.globalGrade.toFixed(1)}`, unit: '%', color: 'text-primary' },
                                ].map((s, i) => (
                                    <div key={i} className="p-6 bg-surface-container-high rounded-[2rem] shadow-sm transition-all hover:bg-surface-container group cursor-default border border-transparent hover:border-on-surface/5">
                                        <p className="text-[9px] font-black text-tertiary uppercase tracking-[0.2em] font-space italic mb-2 opacity-50">{s.label}</p>
                                        <div className="flex items-baseline gap-1">
                                            <p className={`text-2xl font-black ${s.color} font-space tracking-tight`}>{s.value}</p>
                                            <span className="text-[10px] font-black text-tertiary opacity-40 uppercase font-space">{s.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Top Climbs & Descents Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                {/* Climbs */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-primary/10 rounded-xl"><ArrowUpRight className="w-4 h-4 text-primary" /></div>
                                        <h4 className="text-[10px] font-black text-on-surface uppercase tracking-[0.3em] font-lexend">Top Montées Critiques</h4>
                                    </div>
                                    <div className="space-y-3">
                                        {analysis.topClimbs.map((c, i) => (
                                            <div key={i} className="flex items-center justify-between p-5 bg-surface-container rounded-[2rem] hover:bg-surface-container-high transition-colors group cursor-default">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-on-surface font-space">Km {c.startKm.toFixed(1)} → {c.endKm.toFixed(1)}</span>
                                                    <span className="text-[10px] font-bold text-tertiary font-space opacity-50 uppercase tracking-widest leading-none mt-1">{c.distanceM.toFixed(0)}m d'ascension</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-primary font-space tracking-tight">+{c.dPlus.toFixed(0)}m</div>
                                                    <div className="text-[9px] font-black text-tertiary/40 uppercase tracking-[0.2em] font-space italic">{c.avgGrade.toFixed(1)}% moy</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Descents */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-secondary/10 rounded-xl"><ArrowDownRight className="w-4 h-4 text-secondary" /></div>
                                        <h4 className="text-[10px] font-black text-on-surface uppercase tracking-[0.3em] font-lexend">Descentes Techniques</h4>
                                    </div>
                                    <div className="space-y-3">
                                        {analysis.topDescents.map((c, i) => (
                                            <div key={i} className="flex items-center justify-between p-5 bg-surface-container rounded-[2rem] hover:bg-surface-container-high transition-colors group cursor-default">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-on-surface font-space">Km {c.startKm.toFixed(1)} → {c.endKm.toFixed(1)}</span>
                                                    <span className="text-[10px] font-bold text-tertiary font-space opacity-50 uppercase tracking-widest leading-none mt-1">{c.distanceM.toFixed(0)}m engagés</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-secondary font-space tracking-tight">-{c.dMinus.toFixed(0)}m</div>
                                                    <div className="text-[9px] font-black text-tertiary/40 uppercase tracking-[0.2em] font-space italic">{Math.abs(c.avgGrade).toFixed(1)}% moy</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                )}

                {/* Report Generation Button - Elevated Action */}
                {analysis && forceVelocity && !showReport && (
                    <div className="mt-12 flex justify-center">
                        <button
                            onClick={() => setShowReport(true)}
                            className="group relative flex items-center gap-4 px-12 py-5 bg-primary text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 hover:shadow-[0_20px_60px_-15px_rgba(var(--color-primary-rgb),0.5)] hover:-translate-y-2 font-lexend overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <ShieldCheck className="w-5 h-5 relative z-10" />
                            <span className="relative z-10">Synthèse Prédictive Finale</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Final Report Section - The Premium Insight */}
            {showReport && report && (
                <div className="bg-surface-container-low p-6 sm:p-10 lg:p-14 rounded-[4rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -mr-48 -mt-48 transition-transform duration-1000 group-hover:scale-110 pointer-events-none" />
                    
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 mb-16 relative z-10">
                        <div className="space-y-4">
                            <h2 className="text-4xl font-black text-on-surface flex items-center gap-6 font-lexend tracking-tight">
                                <div className="p-4 bg-primary text-white rounded-3xl shadow-xl shadow-primary/20"><ShieldCheck className="w-8 h-8" /></div>
                                Rapport de Course Final
                            </h2>
                            <p className="text-tertiary font-space font-bold uppercase tracking-widest text-[11px] opacity-60 ml-1">Analyse basée sur un régime stable de {intensity}% FTP/VMA</p>
                        </div>
                        
                        <div className="bg-surface-container p-8 rounded-[3rem] border border-on-surface/5 min-w-[320px] shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-[10px] font-black text-tertiary uppercase tracking-[0.3em] font-lexend">Régime d'Intensité</span>
                                <span className="text-2xl font-black text-primary font-space tracking-tight">{intensity}%</span>
                            </div>
                            <input 
                                type="range" min="60" max="105" step="5" 
                                value={intensity} 
                                onChange={(e) => setIntensity(Number(e.target.value))} 
                                className="w-full h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary" 
                            />
                            <div className="flex justify-between mt-4 text-[9px] font-black text-tertiary/40 uppercase tracking-[0.2em] font-space italic">
                                <span>Endurance</span>
                                <span>Race</span>
                                <span>Critical</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 relative z-10">
                        {/* Summary Data */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-on-surface p-10 rounded-[3rem] text-surface shadow-2xl shadow-on-surface/20 flex flex-col justify-center relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                                    <div className="flex items-center gap-3 text-surface/50 mb-4 font-space font-bold uppercase tracking-widest text-[9px]">
                                        <Clock className="w-4 h-4" /> Temps de Course Cible
                                    </div>
                                    <div className="text-7xl font-black font-space tracking-tighter leading-none mb-6">{report.formattedTime}</div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-primary text-lg font-black font-space">{report.avgPace}</span>
                                            <span className="text-[8px] font-bold text-surface/40 uppercase font-space tracking-widest">Allure Moyenne</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-surface text-lg font-black font-space">{analysis.stats.totalDistanceKm.toFixed(1)} km</span>
                                            <span className="text-[8px] font-bold text-surface/40 uppercase font-space tracking-widest">Distance Totale</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-surface-container p-10 rounded-[3rem] shadow-sm flex flex-col justify-between group transition-all hover:shadow-lg hover:shadow-on-surface/5">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 text-tertiary opacity-50 font-space font-bold uppercase tracking-widest text-[9px]">
                                            <TrendingUp className="w-4 h-4" /> Métrologie de l'Effort
                                        </div>
                                        <div className="space-y-6">
                                            <div className="flex items-end justify-between">
                                                <span className="text-xs font-black text-on-surface font-lexend uppercase tracking-widest">D+ Ascendant</span>
                                                <span className="text-3xl font-black text-primary font-space">+{report.climbDist.toFixed(0)}m</span>
                                            </div>
                                            <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden flex shadow-inner">
                                                <div style={{ width: `${Math.min(analysis.stats.globalGrade * 5, 100)}%` }} className="bg-primary h-full rounded-full" />
                                            </div>
                                            <p className="text-[10px] text-tertiary font-space font-bold leading-relaxed italic opacity-60">
                                                Modèle d'effort asymétrique incluant une dégradation de l'économie de course de 12% sur les sections > 15% de pente.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* The Crux Insight */}
                            {report.crux && (
                                <div className="bg-primary/5 p-10 rounded-[3.5rem] border border-primary/10 relative overflow-hidden group hover:bg-primary/10 transition-all duration-700">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000 rotate-12">
                                        <AlertTriangle className="w-48 h-48 text-primary" />
                                    </div>
                                    <div className="flex items-center gap-3 text-primary mb-6 relative z-10 font-lexend font-black uppercase tracking-[0.3em] text-[10px]">
                                        <Activity className="w-5 h-5" /> Focus Critique — "The Crux"
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-10 items-start md:items-center relative z-10">
                                        <div className="flex-1">
                                            <h4 className="text-2xl font-black text-on-surface mb-3 font-lexend">KM {report.crux.startKm.toFixed(1)} → {report.crux.endKm.toFixed(1)}</h4>
                                            <p className="text-sm text-on-surface/70 font-medium leading-relaxed font-lexend">{report.cruxAdvice}</p>
                                        </div>
                                        <div className="bg-surface p-6 rounded-[2.5rem] shadow-xl shadow-primary/5 border border-primary/5 text-center min-w-[160px]">
                                            <div className="text-3xl font-black text-primary font-space">+{report.crux.dPlus.toFixed(0)}m</div>
                                            <div className="text-[9px] font-black text-tertiary uppercase tracking-widest font-space italic opacity-40 mt-1">{report.crux.avgGrade.toFixed(1)}% Moy.</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Strategy Chart - Visualized Intelligence */}
                            <div className="bg-surface-container p-10 rounded-[3.5rem] shadow-sm relative z-10">
                                <div className="flex items-center justify-between mb-10">
                                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-[0.3em] font-lexend flex items-center gap-3">
                                        <TrendingUp className="w-5 h-5 text-primary" /> Profil Stratégique Estimé
                                    </h3>
                                    <div className="flex gap-6 text-[8px] font-black uppercase tracking-widest font-space opacity-40">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 bg-primary rounded-full" /> Ascensions</div>
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 bg-tertiary rounded-full" /> Descentes</div>
                                    </div>
                                </div>
                                <div className="h-56 sm:h-64">
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
                                                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.01} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-on-surface)" strokeOpacity={0.03} vertical={false} />
                                            <XAxis dataKey="distanceKm" hide />
                                            <YAxis hide domain={['dataMin - 50', 'dataMax + 50']} />
                                            {/* Sections highlights */}
                                            {report.topClimbEstimates.map((c, i) => (
                                                <ReferenceArea key={`c-${i}`} x1={c.startKm} x2={c.endKm} fill={activeSegment === `Montée-${c.startKm.toFixed(1)}` ? "var(--color-primary)" : "var(--color-primary)"} fillOpacity={activeSegment === `Montée-${c.startKm.toFixed(1)}` ? 0.2 : 0.08} />
                                            ))}
                                            {report.topDescentEstimates.map((c, i) => (
                                                <ReferenceArea key={`d-${i}`} x1={c.startKm} x2={c.endKm} fill={activeSegment === `Descente-${c.startKm.toFixed(1)}` ? "var(--color-secondary)" : "var(--color-secondary)"} fillOpacity={activeSegment === `Descente-${c.startKm.toFixed(1)}` ? 0.2 : 0.08} />
                                            ))}
                                            <Tooltip content={<div/>} />
                                            <Area type="monotone" dataKey="elevation" stroke="var(--color-primary)" strokeWidth={3} fill="url(#stratGrad)" isAnimationActive={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-8 flex justify-center">
                                    <p className="text-[9px] font-black text-tertiary/30 uppercase tracking-[0.4em] font-lexend italic">Dynamique de vitesse auto-ajustable</p>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar: Diagnostics & Logistics */}
                        <div className="space-y-8">
                            <div className="bg-primary p-10 rounded-[3rem] text-white shadow-2xl shadow-primary/20 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-[60px] -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000 pointer-events-none" />
                                
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-10 font-lexend flex items-center gap-3">
                                    <Droplets className="w-5 h-5 text-white" /> Stratégie Nutritionnelle
                                </h3>
                                
                                <div className="space-y-10">
                                    <div className="flex items-center gap-6">
                                        <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md shadow-inner"><Droplets className="w-6 h-6 text-white" /></div>
                                        <div>
                                            <div className="text-[11px] font-black text-white/50 uppercase tracking-widest font-space">Liquid (H2O)</div>
                                            <div className="text-3xl font-black font-space">{report.waterLiters} Litres</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md shadow-inner"><Utensils className="w-6 h-6 text-white" /></div>
                                        <div>
                                            <div className="text-[11px] font-black text-white/50 uppercase tracking-widest font-space">Carbs (C6H12O6)</div>
                                            <div className="text-3xl font-black font-space">{report.carbsGrams}g totaux</div>
                                        </div>
                                    </div>
                                    <div className="pt-8 border-t border-white/10 space-y-4">
                                        <div className="text-[10px] font-black text-primary-container uppercase tracking-widest font-lexend opacity-60">Protocole Conseillé</div>
                                        <p className="text-sm text-white/80 leading-relaxed font-lexend font-medium">
                                            Ingestion horaire cible : <span className="text-white font-black">750ml</span> de boisson isotonique et <span className="text-white font-black">~65g</span> de glucides complexes. Ajustement dynamique selon le T°C.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-surface-container p-8 rounded-[3rem] border border-on-surface/5 space-y-6">
                                <h4 className="text-[10px] font-black text-tertiary uppercase tracking-[0.3em] mb-2 font-lexend">Paramètres du Modèle</h4>
                                <ul className="space-y-4 font-space">
                                    <li className="flex items-center justify-between text-xs font-black">
                                        <span className="text-tertiary/50 uppercase tracking-widest">Points d'Analyse</span>
                                        <span className="text-on-surface">{analysis.profile.length}</span>
                                    </li>
                                    <li className="flex items-center justify-between text-xs font-black">
                                        <span className="text-tertiary/50 uppercase tracking-widest">Masse Systémique</span>
                                        <span className="text-on-surface">{mass} kg</span>
                                    </li>
                                    <li className="flex items-center justify-between text-xs font-black">
                                        <span className="text-tertiary/50 uppercase tracking-widest">Dérive Thermique</span>
                                        <span className="text-primary">+3.5% incl.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dashboard Force-Velocity - The Science Section */}
            <div className="bg-surface-container-low p-6 sm:p-10 lg:p-14 rounded-[4rem] shadow-2xl relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-8">
                    <h2 className="text-3xl font-black text-on-surface flex items-center gap-6 font-lexend tracking-tight">
                        <div className="p-4 bg-tertiary/10 rounded-[2rem] shadow-inner"><Activity className="text-tertiary w-8 h-8" /></div>
                        Profil de Capacité Trail
                    </h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1.5fr_1fr] gap-10 lg:gap-14 items-start text-on-surface">
                    {/* COLUMN 1: Inputs & Diagnostic */}
                    <div className="flex flex-col gap-10">
                        <div className="bg-surface-container p-6 rounded-[3rem] shadow-sm space-y-8 group transition-all hover:bg-surface-container-high hover:shadow-lg hover:shadow-on-surface/5">
                            {/* Tests sur Plat */}
                            <div>
                                <h3 className="text-[11px] font-black text-primary uppercase tracking-[0.3em] mb-6 font-lexend flex items-center gap-3">
                                    <Zap className="w-4 h-4 text-primary opacity-30"/>
                                    Tests de Référence Plat
                                </h3>
                                
                                <div className="space-y-3">
                                    <div className="grid grid-cols-[1.2fr_2fr_1.5fr_1.5fr] gap-4 px-2 text-[9px] font-black text-tertiary/50 uppercase tracking-[0.1em] font-space text-center">
                                        <div>Durée</div>
                                        <div className="text-left">Allure (min/km)</div>
                                        <div>BPM</div>
                                        <div>Watts</div>
                                    </div>
                                    
                                    {[{ label: '5 MIN', state: ref5min, set: setRef5min }, { label: '12 MIN', state: ref12min, set: setRef12min }].map((test, i) => (
                                        <div key={i} className="grid grid-cols-[1.2fr_2fr_1.5fr_1.5fr] gap-4 items-center bg-surface-container-low/50 hover:bg-surface-container-high p-2 rounded-2xl transition-all group">
                                            <div className="text-[10px] font-black text-primary uppercase font-space text-center">{test.label}</div>
                                            <input type="text" placeholder="04:00" value={test.state.pace} onChange={e => test.set(p => ({ ...p, pace: e.target.value }))} className="w-full text-sm bg-transparent font-black text-on-surface outline-none placeholder:text-tertiary/20 font-space" />
                                            <input type="number" placeholder="-" value={test.state.hr} onChange={e => test.set(p => ({ ...p, hr: e.target.value }))} className="w-full text-sm bg-transparent font-bold text-on-surface outline-none placeholder:text-tertiary/20 text-center font-space" />
                                            <input type="number" placeholder="-" value={test.state.power} onChange={e => test.set(p => ({ ...p, power: e.target.value }))} className="w-full text-sm bg-transparent font-black text-primary outline-none placeholder:text-primary/20 text-center font-space" />
                                        </div>
                                    ))}
                                    
                                    <div className="pt-4 mt-4 border-t border-on-surface/5">
                                        <div className="flex items-center justify-between px-3">
                                            <label className="text-[9px] font-black text-tertiary uppercase tracking-widest font-space opacity-50">Seuil de Fréquence Cardiaque (BPM)</label>
                                            <input type="number" value={hrThreshold} onChange={e => setHrThreshold(e.target.value)} className="w-16 bg-surface-container-low px-2 py-1 rounded-xl text-xs font-black text-on-surface outline-none text-center font-space" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Test en Côte */}
                            <div className="pt-8 border-t border-on-surface/5">
                                <h3 className="text-[11px] font-black text-secondary uppercase tracking-[0.3em] mb-6 font-lexend flex items-center gap-3">
                                    <Mountain className="w-5 h-5 text-secondary opacity-30"/>
                                    Test Spécifique Côte
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-[1fr_2fr_1.2fr] gap-4 px-3 text-[9px] font-black text-tertiary/50 uppercase tracking-[0.1em] font-space text-center">
                                            <div>Pente (%)</div>
                                            <div className="text-left">Allure (min/km)</div>
                                            <div>Watts</div>
                                        </div>
                                        <div className="grid grid-cols-[1fr_2fr_1.2fr] gap-4 items-center bg-surface-container-low/50 hover:bg-surface-container-high p-2 rounded-2xl transition-all group">
                                            <input type="number" value={slope} onChange={e => setSlope(e.target.value)} className="w-full text-sm bg-transparent font-black text-on-surface outline-none text-center font-space" />
                                            <input type="text" value={slopeTestPace} onChange={e => setSlopeTestPace(e.target.value)} className="w-full text-sm bg-transparent font-black text-on-surface outline-none placeholder:text-tertiary/20 font-space" placeholder="08:00" />
                                            <input type="number" value={slopeTestPower} onChange={e => setSlopeTestPower(e.target.value)} className="w-full text-sm bg-transparent font-black text-primary outline-none placeholder:text-primary/20 text-center font-space" placeholder="-" />
                                        </div>
                                    </div>
                                    
                                    <div className="bg-surface-container-low/50 p-6 rounded-[2rem] space-y-4">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-tertiary font-space">
                                            <span>Durée Test</span>
                                            <span className="text-on-surface text-lg">{slopeTestDuration} min</span>
                                        </div>
                                        <input type="range" min={5} max={12} step={1} value={slopeTestDuration} onChange={e => setSlopeTestDuration(Number(e.target.value))} className="w-full h-1.5 accent-secondary bg-surface-container-high rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {forceVelocity?.coaching && (
                            <div className="p-8 bg-on-surface p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                                <h3 className="text-[10px] font-black text-surface/50 uppercase tracking-[0.3em] mb-6 font-lexend flex items-center gap-3"><Info className="w-5 h-5 text-primary" /> Orientations Stratégiques</h3>
                                <div className="space-y-6">
                                    <p className="font-black text-surface text-2xl font-lexend tracking-tight leading-tight">{forceVelocity.coaching.title}</p>
                                    <p className="text-sm font-medium leading-relaxed text-surface/70 font-lexend">{forceVelocity.coaching.description}</p>
                                    <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5 space-y-4">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-primary font-space">Séance Type : {forceVelocity.coaching.session.name}</span>
                                        <p className="text-surface font-black text-sm italic font-space">" {forceVelocity.coaching.session.expert} "</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* COLUMN 2: KPIs & Detail Tables */}
                    <div className="flex flex-col gap-10">
                        {forceVelocity ? (
                            <>
                                <div className="p-10 rounded-[4rem] bg-surface-container text-center shadow-sm relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                    <div className={`inline-block px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.3em] mb-8 font-lexend ${forceVelocity.ratio > 1.05 ? 'bg-primary/10 text-primary' : forceVelocity.ratio < 0.85 ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>
                                        {forceVelocity.profileLabel}
                                    </div>
                                    <div className="text-8xl font-black text-on-surface tracking-tighter mb-4 font-space italic leading-none">
                                        {forceVelocity.ratio.toFixed(2)}
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-tertiary/40 font-lexend mb-6">Slope-to-Flat Coefficient</p>
                                    <p className="text-base font-medium text-on-surface/60 leading-relaxed max-w-sm mx-auto font-lexend">
                                        {forceVelocity.profileDesc}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    {[
                                        { label: 'VAM Critique', val: forceVelocity.vamCriticalPerHour.toFixed(0), unit: 'm/h', color: 'text-primary' },
                                        { label: 'VC (Asc)', val: forceVelocity.vcClimb.toFixed(1), unit: 'km/h', color: 'text-on-surface' },
                                        { label: 'Indice de Force', val: (forceVelocity.ratio * 10).toFixed(1), unit: 'pts', color: 'text-secondary' },
                                        { label: 'Relative Power', val: (forceVelocity.wpPerKg || 4.2).toFixed(1), unit: 'w/kg', color: 'text-tertiary' }
                                    ].map((k, i) => (
                                        <div key={i} className="p-6 bg-surface-container rounded-[2rem] shadow-sm flex flex-col justify-center transform transition-all hover:bg-surface-container-high cursor-default">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-tertiary/40 font-space mb-2">{k.label}</p>
                                            <div className="flex items-baseline gap-1">
                                                <p className={`text-4xl font-black tracking-tighter ${k.color} font-space`}>{k.val}</p>
                                                <span className="text-[10px] font-black text-tertiary/20 uppercase font-space">{k.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="bg-surface-container p-8 rounded-[3.5rem] shadow-sm overflow-hidden">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-tertiary/40 mb-8 font-lexend px-2">Tableau de Concordance Pente (% VC)</h3>
                                    <div className="overflow-x-auto scrollbar-hide">
                                        <table className="w-full text-center border-collapse">
                                            <thead>
                                                <tr className="text-[10px] font-black text-tertiary uppercase tracking-widest font-space">
                                                    <th className="px-5 py-4 text-left font-lexend text-on-surface tracking-[0.1em]">PENTE</th>
                                                    {forceVelocity.intensities.slice(1, 6).map((p) => (
                                                        <th key={p} className="px-5 py-4">{Math.round(p * 100)}%</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="font-space">
                                                {forceVelocity.slopeTable.filter((_, i) => i % 2 === 0).map((row, i) => (
                                                    <tr key={row.slope} className="hover:bg-surface-container-high transition-colors group">
                                                        <td className="px-5 py-4 font-black text-on-surface text-left bg-surface-container-low/30 rounded-2xl group-hover:bg-primary/5 group-hover:text-primary transition-colors">{row.slope}%</td>
                                                        {row.speeds.slice(1, 6).map((s, j) => (
                                                            <td key={j} className="px-5 py-4">
                                                                <div className="text-xs font-black text-on-surface">{s.speed}</div>
                                                                <div className="text-[9px] text-tertiary font-bold">{s.pace}</div>
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
                            <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-on-surface/5 rounded-[4rem] bg-surface-container-low/50">
                                <Zap className="w-10 h-10 text-tertiary/20 mb-6 group-hover:animate-pulse" />
                                <p className="text-xs text-tertiary font-black uppercase tracking-widest leading-relaxed font-lexend text-center opacity-40">Initialisation Requise<br/><span className="text-[10px] font-medium lowercase">Saisissez vos performances plat & côte</span></p>
                            </div>
                        )}
                    </div>

                    {/* COLUMN 3: Zones & Energy Bioenergetics */}
                    <div className="flex flex-col gap-8">
                        {forceVelocity && (
                            <div>
                                <h3 className="text-[11px] font-black text-on-surface uppercase tracking-[0.3em] mb-8 font-lexend flex items-center gap-4">
                                    <Activity className="w-5 h-5 text-primary" /> Zones Physiologiques (VAM)
                                </h3>
                                <div className="space-y-4">
                                    {forceVelocity.masterZones.map((z, i) => {
                                        return (
                                            <div key={i} className={`flex flex-col p-5 rounded-[2.5rem] ${z.color} transition-all hover:scale-[1.02] cursor-default border border-on-surface/5`}>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${z.dot}`}></div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.1em] font-lexend">{z.name}</p>
                                                </div>
                                                <div className="space-y-1 pl-4.5">
                                                    <div className="flex items-baseline gap-2">
                                                        <p className="text-sm font-black font-space tracking-tight">{z.vam}</p>
                                                        <span className="text-[8px] font-black opacity-40 uppercase font-space">m/h</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                        {z.hr && <p className="text-[11px] font-bold opacity-70 font-space">{z.hr} <span className="text-[8px] opacity-50 uppercase">bpm</span></p>}
                                                        {z.watt && <p className="text-[11px] font-black opacity-80 font-space text-primary/80">{z.watt}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="mt-8 text-[9px] font-medium text-tertiary leading-relaxed text-center px-4 font-space opacity-40 uppercase tracking-[0.2em]">
                                    *VAM Estimée via Pression Statique v2.1
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
