import { useState, useMemo, useEffect } from 'react';
import { Zap, Info, Activity } from 'lucide-react';
import { fitModel, generateCurve } from '../utils/calculations';
import { timeToSeconds, paceToSpeed, speedToPace, formatTime } from '../utils/formatters';
import { ResponsiveContainer, ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const TICK = { fill: '#78716c', fontSize: 11, fontWeight: 500 };

export default function PredireTab() {
    const [mode, setMode] = useState('running');
    const [targetDist, setTargetDist] = useState(5000);
    const [entries, setEntries] = useState([
        { id: 1, duration: '00:05:00', value: '03:50' },
        { id: 2, duration: '00:15:00', value: '04:20' },
        { id: 3, duration: '00:35:00', value: '04:40' },
    ]);
    const [showTable, setShowTable] = useState(false);
    const [maxHours, setMaxHours] = useState(1);
    const [targetPower, setTargetPower] = useState('250');

    const metricLabel = mode === 'running' ? 'Allure (min/km)' : 'Puissance (W)';

    useEffect(() => {
        setEntries(prev => prev.map((e, i) => {
            const dur = mode === 'running' ? ['00:05:00', '00:15:00', '00:35:00'][i] : ['00:10:00', '00:30:00', '00:45:00'][i];
            const val = mode === 'running' ? ['03:50', '04:10', '04:30'][i] : ['280', '260', '240'][i];
            return { ...e, duration: dur || e.duration, value: val || e.value };
        }));
    }, [mode]);

    const update = (id, k, v) => setEntries(prev => prev.map(e => e.id === id ? { ...e, [k]: v } : e));

    const model = useMemo(() => {
        const data = entries.map(e => {
            const t = timeToSeconds(e.duration);
            const v = mode === 'running' ? paceToSpeed(e.value) : Number(e.value);
            return { t, v };
        }).filter(d => d.t > 0 && d.v > 0);
        return data.length >= 2 ? fitModel(data) : null;
    }, [entries, mode]);

    const curve = useMemo(() => {
        if (!model) return [];
        const maxT = Math.max(...entries.map(e => timeToSeconds(e.duration))) || 0;
        return generateCurve(model, Math.max(maxT * 1.5, maxHours * 3600, 1800));
    }, [model, entries, maxHours]);

    const prediction = useMemo(() => {
        if (!model) return null;
        const { s_riegel, e_riegel } = model;
        if (mode === 'running') {
            const km = targetDist / 1000;
            if (s_riegel <= 0 || km <= 0) return null;
            const t = Math.pow(km * 3600 / s_riegel, 1 / e_riegel);
            if (!Number.isFinite(t) || t <= 0) return null;
            const speed = s_riegel * Math.pow(t, e_riegel - 1);
            return { type: 'running', timeSeconds: t, formattedTime: formatTime(t), speed, pace: speedToPace(speed) };
        } else {
            const pw = Number(targetPower);
            if (pw <= 0 || s_riegel <= 0) return null;
            const exp = Math.abs(e_riegel - 1) > 0.01 ? e_riegel - 1 : 0.01;
            const t = Math.pow(pw / s_riegel, 1 / exp);
            if (!Number.isFinite(t) || t <= 0) return null;
            return { type: 'cycling', targetPower: pw, maintainableTime: t, formattedTime: formatTime(t) };
        }
    }, [model, mode, targetDist, targetPower]);

    const tableData = useMemo(() => {
        if (!model) return null;
        const { s_riegel, e_riegel, cp } = model;
        const percs = [1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1, 0.95, 0.9, 0.85, 0.8];
        const exp = Math.abs(e_riegel - 1) > 0.01 ? e_riegel - 1 : 0.01;
        return percs.map(p => {
            const target = p * cp;
            if (s_riegel <= 0 || p <= 0) return { perc: p, timeDisplay: '00:00:00', speed: target, pace: '—' };
            const t = Math.pow(target / s_riegel, 1 / exp);
            return {
                perc: p,
                timeDisplay: formatTime(t),
                speed: target,
                pace: mode === 'running' ? speedToPace(target) : '—'
            };
        });
    }, [model, mode]);

    return (
        <div className="space-y-8">
            <div className="bg-surface-container-low p-6 sm:p-8 lg:p-10 rounded-[3rem] shadow-2xl shadow-on-surface/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-8">
                    <h2 className="text-3xl font-black text-on-surface flex items-center gap-4 font-lexend tracking-tight">
                        <div className="p-3 bg-primary/10 rounded-2xl shadow-inner"><Zap className="text-primary w-6 h-6" /></div>
                        Estimateur & Profil
                    </h2>
                    
                    {/* Mode Toggle — Premium Segmented Control */}
                    <div className="flex p-1.5 bg-surface-container-high/50 rounded-2xl w-fit">
                        <button 
                            onClick={() => setMode('running')} 
                            className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${mode === 'running' ? 'bg-surface text-primary shadow-lg shadow-primary/5' : 'text-tertiary hover:text-on-surface'}`}
                        >
                            Course
                        </button>
                        <button 
                            onClick={() => setMode('cycling')} 
                            className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${mode === 'cycling' ? 'bg-surface text-primary shadow-lg shadow-primary/5' : 'text-tertiary hover:text-on-surface'}`}
                        >
                            Vélo
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-8 lg:gap-12 items-start text-on-surface">
                    
                    {/* COLUMN 1: Inputs & Estimator */}
                    <div className="flex flex-col gap-8">
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.25em] mb-4 font-lexend">Performances de Réf.</h3>
                            
                            <div className="space-y-4">
                                {entries.map((e, i) => (
                                    <div key={e.id} className="bg-surface-container p-5 rounded-[2rem] shadow-sm transition-all hover:bg-surface-container-high group">
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] font-space italic">Test {i + 1}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="block text-[8px] font-black text-tertiary uppercase tracking-widest font-space">Durée</label>
                                                <input type="text" value={e.duration} placeholder="00:05:00" onChange={ev => update(e.id, 'duration', ev.target.value)} className="w-full px-3 py-2 bg-surface-container-low/50 text-on-surface font-black font-space rounded-xl outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-[8px] font-black text-tertiary uppercase tracking-widest font-space">{metricLabel.split(' (')[0]}</label>
                                                <input type="text" value={e.value} placeholder={mode === 'running' ? '04:00' : '250'} onChange={ev => update(e.id, 'value', ev.target.value)} className="w-full px-3 py-2 bg-surface-container-low/50 text-on-surface font-black font-space rounded-xl outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Estimator Box — Action Oriented */}
                        <div className="bg-primary p-7 rounded-[2.5rem] shadow-xl shadow-primary/20 text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-6 font-lexend flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Prédiction
                            </h4>
                            
                            <div className="space-y-6">
                                {mode === 'running' ? (
                                    <div className="space-y-2">
                                        <label className="block text-[8px] font-black uppercase tracking-widest text-white/40 font-space">Distance (mètres)</label>
                                        <input type="number" min={100} value={targetDist} onChange={e => setTargetDist(Number(e.target.value))} className="w-full px-4 py-3 bg-white/10 border-none text-white font-black font-space rounded-2xl outline-none focus:bg-white/20 transition-all text-lg" />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="block text-[8px] font-black uppercase tracking-widest text-white/40 font-space">Puissance Cible (W)</label>
                                        <input type="number" min={50} value={targetPower} onChange={e => setTargetPower(e.target.value)} className="w-full px-4 py-3 bg-white/10 border-none text-white font-black font-space rounded-2xl outline-none focus:bg-white/20 transition-all text-lg" />
                                    </div>
                                )}
                                
                                {prediction ? (
                                    <div className="pt-6 border-t border-white/10 mt-2">
                                        <div className="flex flex-col">
                                            <span className="text-5xl font-black font-space tracking-tighter leading-none mb-2">{prediction.formattedTime}</span>
                                            {prediction.type === 'running' ? (
                                                <div className="flex gap-4 text-[10px] font-black uppercase tracking-[0.1em] text-white/70 font-space">
                                                    <span>{prediction.pace}/km</span>
                                                    <span>{prediction.speed.toFixed(1)} km/h</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 font-lexend italic">Capacité de maintien estimée</span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-6 border-t border-white/10 opacity-30">
                                        <span className="text-3xl font-black font-space tracking-tight">--:--:--</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COLUMN 2: Law of Power — Visualization */}
                    <div className="flex flex-col gap-8">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] font-lexend">Modèle de Riegel</h3>
                                <div className="text-[8px] font-black text-tertiary/40 uppercase tracking-[0.2em] font-space italic border border-on-surface/5 px-2 py-1 rounded-lg">Power Law v4.0</div>
                            </div>
                            
                            <div className="bg-surface-container rounded-[3rem] shadow-sm p-8 h-[450px] flex flex-col group transition-all hover:shadow-lg hover:shadow-on-surface/5">
                                {model ? (
                                    <>
                                        <div className="flex items-center justify-between text-[9px] font-black text-tertiary uppercase mb-8 px-2 font-space">
                                            <span className="text-primary">Horizontal : {maxHours}h max</span>
                                            <div className="flex-1 mx-6">
                                                <input type="range" min={1} max={10} step={0.5} value={maxHours} onChange={e => setMaxHours(Number(e.target.value))} className="w-full h-1 accent-primary rounded-full bg-surface-container-high appearance-none cursor-pointer" />
                                            </div>
                                        </div>
                                        <div className="flex-1 w-full relative min-h-[250px]">
                                            <div className="absolute inset-0">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={curve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} strokeOpacity={0.2} />
                                                        <XAxis dataKey="timeFormatted" tick={{ ...TICK, fill: 'var(--color-tertiary)', opacity: 0.5, fontSize: 9 }} axisLine={false} tickLine={false} dy={15} fontVariant="lining-nums" />
                                                        <YAxis tick={{ ...TICK, fill: 'var(--color-tertiary)', opacity: 0.5, fontSize: 9 }} axisLine={false} tickLine={false} />
                                                        <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', backgroundColor: 'var(--color-surface)', boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.1)', padding: '16px' }} />
                                                        <Line type="monotone" dataKey="riegelModel" name={mode === 'running' ? 'km/h' : 'Watts'} stroke="var(--color-primary)" strokeWidth={4} dot={false} isAnimationActive={false} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                        <div className="mt-8 pt-6 border-t border-on-surface/5 flex justify-center">
                                            <p className="text-[9px] font-black text-tertiary/30 uppercase tracking-[0.4em] font-lexend italic">Visualisation du déclin de performance</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-tertiary/10 rounded-[2.5rem] bg-surface-container-low/50 text-center p-12">
                                        <Zap className="w-8 h-8 text-tertiary/20 mb-4" />
                                        <p className="text-xs text-tertiary font-black uppercase tracking-widest leading-relaxed font-lexend">Initialisation requise<br/><span className="text-[9px] opacity-40 font-medium">Ajoutez des tests pour tracer la courbe</span></p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COLUMN 3: Data Table */}
                    <div className="flex flex-col gap-8">
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-on-surface uppercase tracking-[0.3em] mb-4 font-lexend">Table de Correspondance</h3>
                            
                            {tableData ? (
                                <div className="overflow-hidden rounded-[2.5rem] shadow-sm bg-surface-container">
                                    <table className="w-full text-left">
                                        <thead className="bg-surface-container-high/50 text-[8px] font-black text-tertiary/60 uppercase tracking-[0.2em] font-space italic">
                                            <tr>
                                                <th className="px-5 py-4">Intensité</th>
                                                <th className="px-5 py-4 text-right">Cible</th>
                                                <th className="px-5 py-4 text-right">T. Max</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-on-surface/5">
                                            {tableData.map((r, i) => (
                                                <tr key={i} className="hover:bg-surface-container-high/50 transition-colors group cursor-default">
                                                    <td className="px-5 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-on-surface font-space">{Math.round(r.perc * 100)}%</span>
                                                            <span className="text-[8px] font-black text-tertiary uppercase font-space opacity-40">{mode === 'running' ? 'VMA' : 'CP'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        {mode === 'running' ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xs font-black text-primary font-space">{r.pace}/km</span>
                                                                <span className="text-[9px] font-medium text-tertiary italic">{r.speed.toFixed(1)} km/h</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-black text-primary font-space">{Math.round(r.speed)} W</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <span className="text-xs font-black text-on-surface font-space opacity-60 group-hover:opacity-100 transition-opacity">{r.timeDisplay}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center bg-surface-container/50 rounded-[2.5rem] border border-tertiary/5">
                                    <p className="text-[10px] font-black text-tertiary/40 uppercase tracking-widest font-lexend">Données indisponibles</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
