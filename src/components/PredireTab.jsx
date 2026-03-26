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
        <div className="space-y-6">
            <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-[2rem] shadow-[0_2px_40px_rgb(0,0,0,0.04)] border border-stone-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                    <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-3">
                        <div className="p-2.5 bg-stone-100 rounded-xl"><Zap className="text-stone-600 w-5 h-5" /></div>
                        Estimateur & Profil
                    </h2>
                    
                    {/* Mode Toggle */}
                    <div className="flex p-1 bg-stone-100 rounded-xl w-fit border border-stone-200/60">
                        <button onClick={() => setMode('running')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'running' ? 'bg-white text-blue-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>Course</button>
                        <button onClick={() => setMode('cycling')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'cycling' ? 'bg-white text-blue-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>Vélo</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_1fr] gap-6 lg:gap-8 items-start">
                    
                    {/* COLUMN 1: Inputs & Info */}
                    <div className="flex flex-col gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-2">Performances de réf.</h3>
                            <p className="text-xs text-stone-500 leading-relaxed mb-4">
                                Idéalement un test court (~5 min), un moyen (~15 min), et un long (~35 min) pour calibrer la courbe.
                            </p>
                            
                            <div className="space-y-3">
                                {entries.map((e, i) => (
                                    <div key={e.id} className="bg-white p-4 rounded-xl border border-stone-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-5 h-5 flex items-center justify-center bg-stone-100 rounded-full text-[10px] font-bold text-stone-600">{i + 1}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Durée</label>
                                                <input type="text" value={e.duration} placeholder="00:05:00" onChange={ev => update(e.id, 'duration', ev.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">{metricLabel}</label>
                                                <input type="text" value={e.value} placeholder={mode === 'running' ? '04:00' : '250'} onChange={ev => update(e.id, 'value', ev.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Estimator Box */}
                        <div className="bg-stone-50 rounded-2xl border border-stone-100 p-5 mt-2">
                            <h4 className="text-sm font-bold text-stone-800 mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-stone-500" /> Estimation</h4>
                            <p className="text-xs text-stone-500 mb-4">{mode === 'running' ? 'Temps pour une distance :' : 'Temps pour une puissance :'}</p>
                            
                            <div className="space-y-4">
                                {mode === 'running' ? (
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Distance (m)</label>
                                        <input type="number" min={100} value={targetDist} onChange={e => setTargetDist(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium focus:border-blue-500 outline-none" />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Puissance (W)</label>
                                        <input type="number" min={50} value={targetPower} onChange={e => setTargetPower(e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium focus:border-blue-500 outline-none" />
                                    </div>
                                )}
                                
                                {prediction ? (
                                    <div className="pt-3 border-t border-stone-200/60">
                                        {prediction.type === 'running' ? (
                                            <>
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-2xl font-black text-stone-800 tracking-tight">{prediction.formattedTime}</span>
                                                </div>
                                                <div className="flex gap-3 text-sm">
                                                    <span className="font-mono text-blue-600 font-bold">{prediction.pace}/km</span>
                                                    <span className="text-stone-500">{prediction.speed.toFixed(1)} km/h</span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-2xl font-black text-stone-800 tracking-tight">{prediction.formattedTime}</span>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-600 italic">Temps max. estimé</p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="pt-3 border-t border-stone-200/60 opacity-50">
                                        <span className="text-xl font-bold text-stone-300">--:--:--</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COLUMN 2: Chart & Curve */}
                    <div className="flex flex-col gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Loi de Puissance</h3>
                                <div className="text-[10px] font-bold text-stone-400 bg-stone-100 px-2 py-1 rounded-md">Modèle de Riegel</div>
                            </div>
                            
                            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 h-[350px] flex flex-col">
                                {model ? (
                                    <>
                                        <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 uppercase mb-4 px-2">
                                            <span>Vue max : {maxHours}h</span>
                                            <div className="flex-1 mx-4">
                                                <input type="range" min={1} max={10} step={0.5} value={maxHours} onChange={e => setMaxHours(Number(e.target.value))} className="w-full h-1 accent-blue-500 rounded-full bg-stone-200 appearance-none cursor-pointer" />
                                            </div>
                                        </div>
                                        <div className="flex-1 w-full relative min-h-[220px]">
                                            <div className="absolute inset-0">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={curve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                        <XAxis dataKey="timeFormatted" tick={TICK} axisLine={false} tickLine={false} dy={10} />
                                                        <YAxis tick={TICK} axisLine={false} tickLine={false} />
                                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Line type="monotone" dataKey="riegelModel" name={mode === 'running' ? 'Vitesse (km/h)' : 'Puissance (W)'} stroke="#3b82f6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-stone-100 rounded-xl bg-stone-50/50 text-center p-6">
                                        <p className="text-xs text-stone-400 font-medium tracking-wide leading-relaxed">Ajoutez 2 ou 3 performances de référence pour générer la courbe.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COLUMN 3: Table */}
                    <div className="flex flex-col gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-2">Tableau des Allures / Puissances</h3>
                            
                            {tableData ? (
                                <div className="overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-stone-50/80 border-b border-stone-100 text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                            <tr>
                                                <th className="px-3 py-3">Intensité</th>
                                                <th className="px-3 py-3 text-right">Cible</th>
                                                <th className="px-3 py-3 text-right">Durée Max</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {tableData.map((r, i) => (
                                                <tr key={i} className="hover:bg-stone-50 transition-colors group">
                                                    <td className="px-3 py-2">
                                                        <span className="text-xs font-bold text-stone-700">{Math.round(r.perc * 100)}%</span>
                                                        <span className="text-[10px] font-bold text-stone-400 ml-1">{mode === 'running' ? 'VC' : 'CP'}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {mode === 'running' ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">{r.pace}</span>
                                                                <span className="text-[10px] font-medium text-stone-400 mt-0.5">{r.speed.toFixed(1)} km/h</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">{Math.round(r.speed)} W</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <span className="text-xs font-medium text-stone-600">{r.timeDisplay}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-stone-50/50 rounded-xl border border-stone-100">
                                    <p className="text-xs font-medium text-stone-400">Ajoutez des performances pour voir le tableau.</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
