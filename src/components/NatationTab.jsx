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

                <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 max-w-lg mb-8">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center"><Activity className="w-3 h-3 text-slate-600"/></div>
                        Allures sur 100m
                    </h3>
                    
                    <div className="space-y-2.5">
                        <div className="flex px-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="w-20">Test</div>
                            <div className="flex-1">Allure moy. (MM:SS)</div>
                        </div>
                        
                        {[
                            { key: 'v100', dist: '100m' },
                            { key: 'v400', dist: '400m' },
                            { key: 'v1000', dist: '1000m' },
                        ].map(({ key, dist }) => (
                            <div key={key} className="flex items-center gap-3 bg-slate-50/50 hover:bg-slate-50 p-1.5 rounded-xl border border-slate-100 transition-colors focus-within:border-slate-300 focus-within:bg-white">
                                <div className="w-20 shrink-0 text-center">
                                    <span className="text-[10px] font-black text-slate-500 bg-slate-200/50 px-2 py-1 rounded-lg inline-block w-full">{dist}</span>
                                </div>
                                <div className="flex-1">
                                    <input type="text" placeholder="01:30" value={paces[key]} onChange={e => setPaces(p => ({ ...p, [key]: e.target.value }))} className="w-full text-sm bg-transparent font-bold text-slate-700 outline-none placeholder:text-slate-300 pl-2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CSS Result */}
                {css && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="p-6 rounded-[2rem] bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden flex flex-col justify-center">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100 mb-1 relative z-10">Vitesse critique natation (CSS)</p>
                            <div className="flex items-baseline gap-1 mt-1 relative z-10">
                                <p className="text-5xl font-black tracking-tight text-white">{cssPace}</p>
                                <span className="text-lg font-bold text-blue-100">/100m</span>
                            </div>
                            <p className="text-sm text-blue-100 mt-2 font-medium relative z-10">{css.css.toFixed(2)} m/s</p>
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
