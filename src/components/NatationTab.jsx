import { useState, useMemo } from 'react';
import { Waves, Activity } from 'lucide-react';
import { computeSwimCSS } from '../utils/calculations';
import { timeToSeconds, swimSpeedToPace } from '../utils/formatters';

export default function NatationTab() {
    const [paces, setPaces] = useState({ v100: '01:30', v400: '01:35', v1000: '01:20' });

    const css = useMemo(() => computeSwimCSS(paces), [paces]);
    const cssPace = css ? swimSpeedToPace(css.css) : '';

    const zones = useMemo(() => {
        if (!css) return [];
        const s = css.css;
        return [
            { name: 'Zone 1 (Facile)', pct: '60-75%', pace: `${swimSpeedToPace(s * 0.65)} - ${swimSpeedToPace(s * 0.75)} /100m` },
            { name: 'Zone 2 (Endurance)', pct: '75-85%', pace: `${swimSpeedToPace(s * 0.75)} - ${swimSpeedToPace(s * 0.85)} /100m` },
            { name: 'Zone 3 (Seuil)', pct: '85-95%', pace: `${swimSpeedToPace(s * 0.85)} - ${swimSpeedToPace(s * 0.95)} /100m` },
            { name: 'Zone 4 (VO₂)', pct: '95-105%', pace: `${swimSpeedToPace(s * 0.95)} - ${swimSpeedToPace(s * 1.05)} /100m` },
            { name: 'Zone 5 (Vitesse)', pct: '>105%', pace: `< ${swimSpeedToPace(s * 1.05)} /100m` },
        ];
    }, [css]);

    return (
        <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl"><Waves className="text-blue-500 w-6 h-6" /></div>
                    CSS Natation
                </h2>

                <p className="text-slate-600 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100 inline-block text-sm font-medium">
                    Entre ton meilleur rythme moyen par 100 m pour les distances suivantes afin de calculer la CSS.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {[
                        { key: 'v100', dist: '100m' },
                        { key: 'v400', dist: '400m' },
                        { key: 'v1000', dist: '1000m' },
                    ].map(({ key, dist }) => (
                        <div key={key} className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Distance</span>
                                <span className="text-sm font-bold text-slate-800">{dist}</span>
                            </div>
                            <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Allure (MM:SS)</label>
                            <input
                                type="text"
                                value={paces[key]}
                                onChange={e => setPaces(p => ({ ...p, [key]: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white border-transparent focus:border-blue-500 border rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-blue-100 transition-all outline-none text-slate-700 font-medium"
                            />
                        </div>
                    ))}
                </div>

                {/* CSS Result */}
                {css && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="relative overflow-hidden p-6 rounded-[2rem] bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-500/20">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100 mb-1">Vitesse critique natation (CSS)</p>
                            <p className="text-5xl font-bold tracking-tight">{cssPace} <span className="text-lg font-medium text-cyan-200">/100m</span></p>
                            <p className="text-sm text-cyan-100 mt-2 font-medium opacity-80">{css.css.toFixed(2)} m/s</p>
                        </div>
                    </div>
                )}

                {/* Zones */}
                {css && (
                    <div className="mt-10">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-1.5 bg-slate-100 rounded-lg"><Activity className="w-5 h-5 text-slate-600" /></div>
                            <h3 className="text-xl font-bold text-slate-800">Allures d'entraînement</h3>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                            <table className="min-w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Zone</th>
                                        <th className="px-6 py-4">% CSS</th>
                                        <th className="px-6 py-4">Plage d'allure</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {zones.map((z, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800">{z.name}</td>
                                            <td className="px-6 py-4 font-medium text-slate-500">{z.pct}</td>
                                            <td className="px-6 py-4 text-blue-600 font-mono font-medium">{z.pace}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
