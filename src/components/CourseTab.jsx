import { useState, useMemo } from 'react';
import { Timer, Info, Activity, Target, Zap } from 'lucide-react';
import { fitModel, generateCurve, computeHRThreshold } from '../utils/calculations';
import { timeToSeconds, paceToSpeed, speedToPace, formatTime } from '../utils/formatters';
import { getRunningCoaching } from '../utils/coaching';
import { ResponsiveContainer, ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const TICK = { fill: '#78716c', fontSize: 11, fontWeight: 500 };

export default function CourseTab() {
    const [entries, setEntries] = useState([
        { duration: '05:00', pace: '03:03', hr: '176', power: '' },
        { duration: '12:00', pace: '03:31', hr: '171', power: '' },
        { duration: '16:40', pace: '03:38', hr: '168', power: '' },
    ]);
    const [use3, setUse3] = useState(true);
    const active = use3 ? entries : entries.slice(0, 2);

    const update = (i, k, v) => { const n = [...entries]; n[i] = { ...n[i], [k]: v }; setEntries(n); };

    const model = useMemo(() => {
        const d = active.map(e => ({ t: timeToSeconds(e.duration), v: paceToSpeed(e.pace) })).filter(d => d.t > 0 && d.v > 0);
        return d.length >= 2 ? fitModel(d) : null;
    }, [active]);

    // Power CP model (optional - only when power data is provided)
    const powerModel = useMemo(() => {
        const d = active
            .map(e => ({ t: timeToSeconds(e.duration), v: Number(e.power) }))
            .filter(d => d.t > 0 && d.v > 0);
        return d.length >= 2 ? fitModel(d) : null;
    }, [active]);

    const curve = useMemo(() => {
        if (!model) return [];
        const maxT = Math.max(...active.map(e => timeToSeconds(e.duration))) * 2 || 3600;
        return generateCurve(model, maxT);
    }, [model, active]);

    const predictions = useMemo(() => {
        if (!model) return [];
        return [5000, 10000, 21097, 42195].map(dist => {
            const km = dist / 1000;
            const t = Math.pow(km * 3600 / model.s_riegel, 1 / model.e_riegel);
            return { distance: dist, time: t, speed: km / (t / 3600) };
        });
    }, [model]);

    const hrThreshold = useMemo(() => {
        return computeHRThreshold(active.map(e => ({ tMinutes: timeToSeconds(e.duration) / 60, hr: Number(e.hr) })));
    }, [active]);

    const masterZones = useMemo(() => {
        if (!model) return [];
        const cp = model.cp;
        const pcp = powerModel?.cp;
        const hrt = hrThreshold;
        const bonus = model.e_riegel >= 0.9 ? 0.03 : 0;
        const lo = f => ((f + bonus) * cp);
        const w = f => pcp ? Math.round(f * pcp) : null;
        
        const z = (name, fs, fe, fw_s, fw_e, fh_s, fh_e, color, dot) => ({
            name,
            pace: `${speedToPace(lo(fs))} - ${speedToPace(lo(fe))}`,
            watt: pcp ? `${w(fw_s)} - ${w(fw_e)} W` : null,
            hr: hrt ? (fh_e ? `${Math.round(fh_s * hrt)} - ${Math.round(fh_e * hrt)}` : `> ${Math.round(fh_s * hrt)}`) : null,
            color, dot
        });

        return [
            z('RÉCUPÉRATION', 0.6, 0.7, 0.55, 0.75, 0, 0.85, 'bg-blue-500/10 text-blue-800', 'bg-blue-500'),
            z('ENDURANCE', 0.7, 0.8, 0.75, 0.88, 0.85, 0.9, 'bg-emerald-500/10 text-emerald-800', 'bg-emerald-500'),
            z('TEMPO', 0.8, 0.88, 0.88, 0.95, 0.9, 0.95, 'bg-lime-500/10 text-lime-800', 'bg-lime-500'),
            z('SEUIL', 0.88, 0.96, 0.95, 1.0, 0.95, 1.0, 'bg-amber-500/10 text-amber-800', 'bg-amber-500'),
            z('VO₂ MAX', 0.96, 1.05, 1.0, 1.15, 1.0, null, 'bg-red-500/10 text-red-800', 'bg-red-500'),
            { 
                name: 'VITESSE', 
                pace: `< ${speedToPace(lo(1.05))}`, 
                watt: pcp ? `> ${w(1.15)} W` : null,
                hr: null, 
                color: 'bg-purple-500/10 text-purple-800', dot: 'bg-purple-500' 
            },
        ];
    }, [model, powerModel, hrThreshold]);

    const paceStr = model ? speedToPace(model.cp) : '';

    const coaching = useMemo(() => {
        if (!model) return null;
        return getRunningCoaching(model.e_riegel, model.cp, paceStr);
    }, [model, paceStr]);

    return (
        <div className="bg-surface-container-low p-5 sm:p-8 lg:p-10 rounded-[3rem] shadow-2xl shadow-on-surface/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-6">
                <h2 className="text-3xl font-black text-on-surface flex items-center gap-4 font-lexend tracking-tight">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-inner"><Timer className="text-primary w-6 h-6" /></div>
                    Tableau de Bord — Course
                </h2>
                <label className="flex items-center gap-3 text-[10px] font-black text-tertiary uppercase tracking-widest bg-surface-container-high/50 hover:bg-surface-container-high transition-all px-4 py-2 rounded-2xl cursor-pointer">
                    <input type="checkbox" checked={use3} onChange={e => setUse3(e.target.checked)} className="rounded-lg border-primary/20 text-primary focus:ring-primary bg-surface" />
                    Utiliser 3 tests
                </label>
            </div>

            {/* Dashboard Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.4fr_1fr] gap-8 lg:gap-12 items-start text-on-surface">
                
                {/* COLUMN 1: Inputs & Analysis */}
                <div className="flex flex-col gap-8">
                    <div className="bg-surface-container p-6 rounded-[2.5rem] shadow-sm space-y-6">
                        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2 mb-2 font-lexend">
                            <Activity className="w-4 h-4"/> Tests de Référence
                        </h3>
                        
                        <div className="space-y-3">
                            <div className="grid grid-cols-[1.5fr_2fr_1.2fr_1.2fr] gap-3 px-3 text-[9px] font-black text-tertiary/50 uppercase tracking-[0.1em] font-space text-center">
                                <div>Durée</div>
                                <div className="text-left">Allure</div>
                                <div>BPM</div>
                                <div>Watts</div>
                            </div>
                            
                            {active.map((entry, i) => (
                                <div key={i} className="grid grid-cols-[1.5fr_2fr_1.2fr_1.2fr] gap-3 items-center bg-surface-container-low/50 hover:bg-surface-container-high p-2 rounded-2xl transition-all group">
                                    <input type="text" placeholder="05:00" value={entry.duration} onChange={e => update(i, 'duration', e.target.value)} className="w-full text-xs bg-primary/5 px-2 py-2 rounded-xl font-black text-primary outline-none text-center font-space" />
                                    <input type="text" placeholder="04:00" value={entry.pace} onChange={e => update(i, 'pace', e.target.value)} className="w-full text-sm bg-transparent font-black text-on-surface outline-none placeholder:text-tertiary/20 font-space" />
                                    <input type="number" placeholder="-" value={entry.hr} onChange={e => update(i, 'hr', e.target.value)} className="w-full text-sm bg-transparent font-bold text-on-surface outline-none placeholder:text-tertiary/20 text-center font-space opacity-40 group-hover:opacity-100 transition-opacity" />
                                    <input type="number" placeholder="-" value={entry.power} onChange={e => update(i, 'power', e.target.value)} className="w-full text-sm bg-transparent font-bold text-on-surface outline-none placeholder:text-tertiary/20 text-center font-space opacity-40 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Coaching Analysis — Editorial Style */}
                    {coaching && (
                        <div className="p-6 bg-primary/5 rounded-[2.5rem] flex flex-col gap-4 border border-primary/5">
                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.25em] flex items-center gap-2 font-lexend"><Info className="w-4 h-4" /> Profil Performance</h3>
                            <div>
                                <p className="font-extrabold text-on-surface text-lg mb-1 font-lexend tracking-tight">{coaching.title}</p>
                                <p className="text-sm font-medium leading-relaxed text-tertiary">{coaching.description}</p>
                            </div>
                            <div className="pt-4 border-t border-primary/10">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60 mb-2 font-lexend">Recommandation Stratégique</h4>
                                <p className="text-sm leading-relaxed text-on-surface italic font-medium">"{coaching.advice}"</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* COLUMN 2: Performance Metrics */}
                <div className="flex flex-col gap-8">
                    {model ? (
                        <>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-8 rounded-[3rem] bg-linear-to-br from-primary to-primary-container text-white shadow-2xl shadow-primary/30 relative overflow-hidden col-span-2 flex flex-col justify-center min-h-[180px]">
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-2 font-lexend">Vitesse Critique (VC)</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <p className="text-7xl font-black tracking-tighter font-space">{model.cp.toFixed(2)}</p>
                                        <span className="text-xl font-bold text-white/60 font-lexend">km/h</span>
                                    </div>
                                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full w-fit">
                                        <Timer className="w-3 h-3 text-white/80" />
                                        <p className="text-xs text-white font-black font-space tracking-wide">{paceStr} <span className="text-[8px] opacity-60">/km</span></p>
                                    </div>
                                </div>
                                
                                <div className="p-6 rounded-[2.5rem] bg-surface-container shadow-sm flex flex-col justify-center transform transition-all hover:scale-[1.03] group">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-tertiary mb-2 font-lexend group-hover:text-primary transition-colors">Index Endurance</p>
                                    <p className="text-5xl font-black tracking-tighter text-on-surface font-space">{model.e_riegel.toFixed(2)}</p>
                                </div>

                                <div className="p-6 rounded-[2.5rem] bg-surface-container shadow-sm flex flex-col justify-center transform transition-all hover:scale-[1.03] group">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-tertiary mb-2 font-lexend group-hover:text-primary transition-colors">Seuil Lactique</p>
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-5xl font-black tracking-tighter text-on-surface font-space">{hrThreshold ? hrThreshold.toFixed(0) : '—'}</p>
                                        <span className="text-xs font-bold text-tertiary/40 font-lexend uppercase">bpm</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Predictions — Subtle Table */}
                            {predictions.length > 0 && (
                                <div className="bg-surface-container p-6 rounded-[2.5rem]">
                                    <h3 className="text-[10px] font-black text-tertiary uppercase tracking-[0.3em] mb-4 font-lexend">Prédictions de Performance</h3>
                                    <div className="grid grid-cols-4 gap-4 px-2 mb-2 pb-2 border-b border-on-surface/5">
                                        <p className="text-[9px] font-black text-tertiary opacity-40 uppercase font-space">Distance</p>
                                        <p className="text-[9px] font-black text-tertiary opacity-40 uppercase font-space col-span-2">Temps Estimé</p>
                                        <p className="text-[9px] font-black text-tertiary opacity-40 uppercase font-space text-right">Allure</p>
                                    </div>
                                    <div className="space-y-3">
                                        {predictions.map((p, i) => (
                                            <div key={i} className="grid grid-cols-4 gap-4 px-2 items-center">
                                                <p className="text-xs font-black text-on-surface font-lexend">{p.distance >= 1000 ? `${p.distance/1000}k` : p.distance}</p>
                                                <p className="text-sm font-black text-primary font-space col-span-2">{formatTime(p.time)}</p>
                                                <p className="text-[11px] font-bold text-tertiary text-right font-space">{speedToPace(p.speed)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="h-full min-h-[400px] flex items-center justify-center bg-surface-container/50 border-2 border-dashed border-tertiary/10 rounded-[3rem]">
                            <p className="text-xs text-tertiary/60 font-black uppercase tracking-widest text-center px-8 font-lexend">Saisissez au moins 2 tests<br/>pour déloquer l'analyse</p>
                        </div>
                    )}
                </div>

                {/* COLUMN 3: Training Zones */}
                <div className="flex flex-col gap-6">
                    {model && (
                        <div className="bg-surface-container p-6 rounded-[2.5rem] shadow-sm">
                            <h3 className="text-[10px] font-black text-on-surface uppercase tracking-[0.3em] mb-6 font-lexend flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" /> Zones d'Entraînement
                            </h3>
                            <div className="flex flex-col gap-4">
                                {masterZones.map((z, i) => (
                                    <div key={i} className={`flex flex-col p-4 rounded-3xl ${z.color} transition-all hover:scale-[1.02] cursor-default border border-on-surface/5`}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${z.dot}`}></div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.1em] font-lexend">{z.name}</p>
                                        </div>
                                        <div className="flex flex-col gap-1 pl-4.5">
                                            <p className="text-sm font-black font-space tracking-tight">{z.pace} <span className="text-[8px] opacity-40 ml-1 uppercase">/km</span></p>
                                            <div className="flex items-center gap-3">
                                                {z.hr && <p className="text-[11px] font-bold opacity-70 font-space whitespace-nowrap">{z.hr} <span className="text-[8px] opacity-50 uppercase tracking-tighter">bpm</span></p>}
                                                {z.watt && <p className="text-[11px] font-bold opacity-70 font-space whitespace-nowrap">{z.watt}</p>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-8 text-[9px] font-medium text-tertiary leading-relaxed text-center px-4">
                                *Les zones sont calculées dynamiquement selon votre modèle de puissance critique et de fatigue métabolique.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
