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

    const speedZones = useMemo(() => {
        if (!model) return [];
        const cp = model.cp;
        const bonus = model.e_riegel >= 0.9 ? 0.03 : 0;
        const lo = f => ((f + bonus) * cp);
        const range = (a, b) => `${speedToPace(lo(a))} - ${speedToPace(lo(b))} /km`;
        return [
            { name: 'Zone 1 (Récup)', range: `${lo(0.6).toFixed(1)} - ${lo(0.7).toFixed(1)} km/h`, pace: range(0.6, 0.7), text: 'text-blue-700', border: 'border-blue-100' },
            { name: 'Zone 2 (Endurance)', range: `${lo(0.7).toFixed(1)} - ${lo(0.8).toFixed(1)} km/h`, pace: range(0.7, 0.8), text: 'text-emerald-700', border: 'border-emerald-100' },
            { name: 'Zone 3 (Tempo)', range: `${lo(0.8).toFixed(1)} - ${lo(0.88).toFixed(1)} km/h`, pace: range(0.8, 0.88), text: 'text-lime-700', border: 'border-lime-100' },
            { name: 'Zone 4 (Seuil)', range: `${lo(0.88).toFixed(1)} - ${lo(0.96).toFixed(1)} km/h`, pace: range(0.88, 0.96), text: 'text-amber-700', border: 'border-amber-100' },
            { name: 'Zone 5 (VO₂)', range: `${lo(0.96).toFixed(1)} - ${lo(1.05).toFixed(1)} km/h`, pace: range(0.96, 1.05), text: 'text-red-700', border: 'border-red-100' },
            { name: 'Zone 6 (Vitesse)', range: `> ${lo(1.05).toFixed(1)} km/h`, pace: `< ${speedToPace(lo(1.05))} /km`, text: 'text-purple-700', border: 'border-purple-100' },
        ];
    }, [model]);

    const powerZones = useMemo(() => {
        if (!powerModel) return [];
        const cp = powerModel.cp;
        const lo = f => Math.round(f * cp);
        return [
            { name: 'Zone 1 (Récup)', range: `${lo(0.55)} - ${lo(0.75)} W`, text: 'text-blue-700', border: 'border-blue-100' },
            { name: 'Zone 2 (Endurance)', range: `${lo(0.75)} - ${lo(0.88)} W`, text: 'text-emerald-700', border: 'border-emerald-100' },
            { name: 'Zone 3 (Tempo)', range: `${lo(0.88)} - ${lo(0.95)} W`, text: 'text-lime-700', border: 'border-lime-100' },
            { name: 'Zone 4 (Seuil)', range: `${lo(0.95)} - ${lo(1.0)} W`, text: 'text-amber-700', border: 'border-amber-100' },
            { name: 'Zone 5 (VO₂)', range: `${lo(1.0)} - ${lo(1.15)} W`, text: 'text-red-700', border: 'border-red-100' },
            { name: 'Zone 6 (Anaérobie)', range: `> ${lo(1.15)} W`, text: 'text-purple-700', border: 'border-purple-100' },
        ];
    }, [powerModel]);

    const hrZones = useMemo(() => {
        if (!hrThreshold) return [];
        const t = hrThreshold;
        return [
            { name: 'Zone 1', range: `≤ ${(0.85 * t).toFixed(0)} bpm`, text: 'text-blue-700', border: 'border-blue-100' },
            { name: 'Zone 2', range: `${(0.85 * t).toFixed(0)} - ${(0.9 * t).toFixed(0)} bpm`, text: 'text-emerald-700', border: 'border-emerald-100' },
            { name: 'Zone 3', range: `${(0.9 * t).toFixed(0)} - ${(0.95 * t).toFixed(0)} bpm`, text: 'text-lime-700', border: 'border-lime-100' },
            { name: 'Zone 4', range: `${(0.95 * t).toFixed(0)} - ${t.toFixed(0)} bpm`, text: 'text-amber-700', border: 'border-amber-100' },
            { name: 'Zone 5', range: `> ${t.toFixed(0)} bpm`, text: 'text-red-700', border: 'border-red-100' },
        ];
    }, [hrThreshold]);

    const paceStr = model ? speedToPace(model.cp) : '';

    const coaching = useMemo(() => {
        if (!model) return null;
        return getRunningCoaching(model.e_riegel, model.cp, paceStr);
    }, [model, paceStr]);

    return (
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-[2rem] shadow-[0_2px_40px_rgb(0,0,0,0.04)] border border-stone-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-3">
                    <div className="p-2.5 bg-stone-100 rounded-xl"><Timer className="text-stone-600 w-5 h-5" /></div>
                    Tableau de bord - Course
                </h2>
                <label className="flex items-center gap-2 text-xs font-medium text-stone-600 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-stone-100 transition-colors">
                    <input type="checkbox" checked={use3} onChange={e => setUse3(e.target.checked)} className="rounded border-stone-300 text-stone-800 focus:ring-stone-500" />
                    Utiliser 3 tests
                </label>
            </div>

            {/* Dashboard Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_1fr] gap-6 lg:gap-8 items-start">
                
                {/* COLUMN 1: Inputs & Data */}
                <div className="flex flex-col gap-6">
                    <div className="bg-white p-5 rounded-[2rem] border border-stone-200 shadow-sm space-y-4">
                        <h3 className="text-xs font-bold text-stone-800 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 bg-stone-100 rounded flex items-center justify-center"><Activity className="w-3 h-3 text-stone-600"/></div>
                            Tests de Référence
                        </h3>
                        
                        <div className="space-y-2.5">
                            <div className="flex px-2 text-[8px] font-bold text-stone-400 uppercase tracking-widest">
                                <div className="w-16">Durée</div>
                                <div className="flex-1">Allure</div>
                                <div className="w-16 text-center">BPM</div>
                                <div className="w-16 text-center">Watts</div>
                            </div>
                            
                            {active.map((entry, i) => (
                                <div key={i} className="flex items-center gap-2 bg-stone-50/50 hover:bg-stone-50 p-1.5 rounded-xl border border-stone-100 transition-colors focus-within:border-stone-300 focus-within:bg-white">
                                    <div className="w-16 shrink-0">
                                        <input type="text" placeholder="05:00" value={entry.duration} onChange={e => update(i, 'duration', e.target.value)} className="w-full text-xs bg-stone-200/50 px-2 py-1 rounded-lg font-black text-stone-600 outline-none text-center" />
                                    </div>
                                    <div className="flex-1">
                                        <input type="text" placeholder="04:00" value={entry.pace} onChange={e => update(i, 'pace', e.target.value)} className="w-full text-sm bg-transparent font-bold text-stone-700 outline-none placeholder:text-stone-300 pl-1" />
                                    </div>
                                    <div className="w-16 shrink-0 border-l border-stone-200 pl-2">
                                        <input type="number" placeholder="-" value={entry.hr} onChange={e => update(i, 'hr', e.target.value)} className="w-full text-sm bg-transparent font-semibold text-stone-600 outline-none placeholder:text-stone-300 text-center" />
                                    </div>
                                    <div className="w-16 shrink-0 border-l border-stone-200 pl-2">
                                        <input type="number" placeholder="-" value={entry.power} onChange={e => update(i, 'power', e.target.value)} className="w-full text-sm bg-transparent font-semibold text-stone-600 outline-none placeholder:text-stone-300 text-center" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Coaching Analysis */}
                    {coaching && (
                        <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm mt-4 flex flex-col gap-3">
                            <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5"><Info className="w-4 h-4 text-blue-600" /> Profil d'Entraînement</h3>
                            <div>
                                <p className="font-bold text-blue-900 text-base mb-1">{coaching.title}</p>
                                <p className="text-sm font-medium leading-relaxed text-blue-800 mb-2">{coaching.description}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">Conseil Coach</h4>
                                <p className="text-sm leading-relaxed text-blue-900/80 mb-3">{coaching.advice}</p>
                            </div>
                            <div className="p-3 bg-white/60 rounded-xl border border-blue-200/50">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-2">Séance Type : {coaching.session.name}</h4>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-100/50 px-1.5 py-0.5 rounded">Débutant</span>
                                        <p className="text-blue-900 font-semibold text-xs mt-0.5">{coaching.session.debutant}</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-100/50 px-1.5 py-0.5 rounded">Confirmé</span>
                                        <p className="text-blue-900 font-semibold text-xs mt-0.5">{coaching.session.confirme}</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-100/50 px-1.5 py-0.5 rounded">Expert</span>
                                        <p className="text-blue-900 font-semibold text-xs mt-0.5">{coaching.session.expert}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* COLUMN 2: KPIs & Chart */}
                <div className="flex flex-col gap-6 lg:border-none border-y border-stone-100 py-6 lg:py-0">
                    {model ? (
                        <>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Métriques Clés</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 rounded-[2rem] bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden col-span-2 sm:col-span-1 flex flex-col justify-center">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100 mb-1 relative z-10">Vitesse Critique (VC)</p>
                                    <div className="flex items-baseline gap-1 mt-1 relative z-10">
                                        <p className="text-5xl font-black tracking-tight text-white">{model.cp.toFixed(2)}</p>
                                        <span className="text-lg font-bold text-blue-100">km/h</span>
                                    </div>
                                    <p className="text-sm text-blue-100 mt-2 font-medium relative z-10">{paceStr} /km</p>
                                </div>
                                
                                <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-emerald-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Index Endurance</p>
                                    <p className="text-4xl font-black tracking-tight text-stone-800 mt-1">{model.e_riegel.toFixed(2)}</p>
                                </div>

                                {powerModel && (
                                    <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-amber-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1 flex items-center gap-1"><Zap className="w-3 h-3 text-stone-400"/>Puissance Crit.</p>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <p className="text-4xl font-black tracking-tight text-stone-800">{powerModel.cp.toFixed(0)}</p>
                                            <span className="text-sm font-bold text-stone-400">W</span>
                                        </div>
                                    </div>
                                )}

                                <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-rose-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">FC Seuil Estimée</p>
                                    <div className="flex items-baseline gap-1 mt-1">
                                        <p className="text-4xl font-black tracking-tight text-stone-800">{hrThreshold ? hrThreshold.toFixed(0) : '—'}</p>
                                        <span className="text-sm font-bold text-stone-400">bpm</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-stone-200 rounded-3xl">
                            <p className="text-sm text-stone-400 text-center px-8">Saisis au moins 2 tests pour afficher l'analyse.</p>
                        </div>
                    )}
                </div>

                {/* COLUMN 3: Zones & Predictions */}
                <div className="flex flex-col gap-6">
                    {model && (
                        <>
                            {/* Training Zones */}
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5"><Activity className="w-4 h-4 text-stone-500" /> Zones</h3>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {speedZones.map((sz, i) => {
                                        const hrInfo = hrZones[i] ? hrZones[i].range.replace(' bpm', '') : (i === 5 ? 'Max' : '-');
                                        const pzInfo = powerZones[i] ? powerZones[i].range.replace(' W', '') : '-';
                                        
                                        // Intense colors for zones as requested
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
                                                        <span className="text-xs font-bold text-stone-800">{sz.name}</span>
                                                        <span className="text-[10px] font-bold text-stone-400">Z{i+1}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                                                        <div>
                                                            <p className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">Allure</p>
                                                            <p className="text-xs font-semibold text-stone-700">{sz.pace.replace(' /km', '')}</p>
                                                        </div>
                                                        {hrZones.length > 0 && (
                                                            <div>
                                                                <p className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">FC</p>
                                                                <p className="text-xs font-semibold text-stone-700">{hrInfo}</p>
                                                            </div>
                                                        )}
                                                        {powerZones.length > 0 && (
                                                            <div className="col-span-2">
                                                                <p className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">Puissance</p>
                                                                <p className="text-xs font-semibold text-stone-700">{pzInfo} <span className="text-[10px] font-normal text-stone-400">W</span></p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Predictions */}
                            {predictions.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5"><Target className="w-4 h-4 text-stone-500" /> Prédictions</h3>
                                    </div>
                                    <div className="overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm">
                                        <table className="w-full text-[11px] text-left">
                                            <thead className="bg-stone-50 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                                                <tr>
                                                    <th className="px-3 py-2">Dist</th>
                                                    <th className="px-3 py-2 font-mono">Temps</th>
                                                    <th className="px-3 py-2 text-right">Allure</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-50">
                                                {predictions.map((p, i) => (
                                                    <tr key={i} className="hover:bg-stone-50/50">
                                                        <td className="px-3 py-2.5 font-bold text-stone-700">{p.distance >= 1000 ? `${p.distance/1000}k` : p.distance}</td>
                                                        <td className="px-3 py-2.5 font-mono text-stone-600 font-semibold">{formatTime(p.time)}</td>
                                                        <td className="px-3 py-2.5 text-right font-medium text-stone-500">{speedToPace(p.speed)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
