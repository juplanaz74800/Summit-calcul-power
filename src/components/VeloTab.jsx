import { useState, useMemo } from 'react';
import { Zap, Info, Timer, Activity } from 'lucide-react';
import { fitModel, generateCurve, computeHRThreshold } from '../utils/calculations';
import { getCyclingCoaching } from '../utils/coaching';
import { ResponsiveContainer, ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts';

const TICK_STYLE = { fill: '#78716c', fontSize: 11, fontWeight: 500 };

export default function VeloTab() {
    const [entries, setEntries] = useState([
        { duration: '120', power: '400', hr: '180' },
        { duration: '300', power: '330', hr: '175' },
        { duration: '1200', power: '250', hr: '170' },
    ]);
    const [use3, setUse3] = useState(true);
    const [maxHours, setMaxHours] = useState(2);
    const [weight, setWeight] = useState(70);
    const [maxPowerInput, setMaxPowerInput] = useState('');
    const [isEndurance, setIsEndurance] = useState(true);

    const activeEntries = use3 ? entries : entries.slice(0, 2);

    const update = (idx, key, val) => {
        const next = [...entries];
        next[idx] = { ...next[idx], [key]: val };
        setEntries(next);
    };

    const model = useMemo(() => {
        const data = activeEntries.map(e => ({ t: Number(e.duration), v: Number(e.power) })).filter(d => d.t > 0 && d.v > 0);
        return data.length >= 2 ? fitModel(data) : null;
    }, [activeEntries]);

    const curveData = useMemo(() => {
        if (!model) return [];
        const maxT = Math.max(...activeEntries.map(e => Number(e.duration)), 0);
        return generateCurve(model, Math.max(maxT * 1.25, maxHours * 3600, 900));
    }, [model, activeEntries, maxHours]);

    const coaching = useMemo(() => {
        if (!model) return null;
        return getCyclingCoaching(model.e_riegel, model.cp, isEndurance);
    }, [model, isEndurance]);

    const hrThreshold = useMemo(() => {
        return computeHRThreshold(activeEntries.map(e => ({ tMinutes: Number(e.duration) / 60, hr: Number(e.hr) })));
    }, [activeEntries]);

    const maxPower = useMemo(() => activeEntries.reduce((m, e) => { const p = Number(e.power); return Number.isFinite(p) && p > m ? p : m; }, 0), [activeEntries]);

    const powerZones = useMemo(() => {
        if (!model) return [];
        const cp = model.cp;
        return [
            { name: 'Zone 1 (Récup)', range: `${(0.50 * cp).toFixed(0)} - ${(0.65 * cp).toFixed(0)} W`, text: 'text-blue-700', border: 'border-blue-100' },
            { name: 'Zone 2 (Endurance)', range: `${(0.65 * cp).toFixed(0)} - ${(0.80 * cp).toFixed(0)} W`, text: 'text-emerald-700', border: 'border-emerald-100' },
            { name: 'Zone 3 (Tempo)', range: `${(0.80 * cp).toFixed(0)} - ${(0.85 * cp).toFixed(0)} W`, text: 'text-lime-700', border: 'border-lime-100' },
            { name: 'Sous-zone 4 (Seuil bas)', range: `${(0.85 * cp).toFixed(0)} - ${(0.96 * cp).toFixed(0)} W`, text: 'text-amber-700', border: 'border-amber-100' },
            { name: 'Sur-zone 4 (Seuil haut)', range: `${(0.96 * cp).toFixed(0)} - ${(1.05 * cp).toFixed(0)} W`, text: 'text-red-700', border: 'border-red-100' },
            { name: 'Zone 5 (VO₂ max)', range: `> ${(1.1 * cp).toFixed(0)} W`, text: 'text-purple-700', border: 'border-purple-100' },
        ];
    }, [model]);

    const hrZones = useMemo(() => {
        if (!hrThreshold) return [];
        const t = hrThreshold;
        return [
            { name: 'Zone 1', range: `≤ ${(0.8 * t).toFixed(0)} bpm`, text: 'text-blue-700', border: 'border-blue-100' },
            { name: 'Zone 2', range: `${(0.8 * t).toFixed(0)} - ${(0.9 * t).toFixed(0)} bpm`, text: 'text-emerald-700', border: 'border-emerald-100' },
            { name: 'Zone 3', range: `${(0.9 * t).toFixed(0)} - ${(0.95 * t).toFixed(0)} bpm`, text: 'text-lime-700', border: 'border-lime-100' },
            { name: 'Zone 4', range: `${(0.95 * t).toFixed(0)} - ${t.toFixed(0)} bpm`, text: 'text-amber-700', border: 'border-amber-100' },
            { name: 'Zone 5', range: `> ${t.toFixed(0)} bpm`, text: 'text-red-700', border: 'border-red-100' },
        ];
    }, [hrThreshold]);

    const locomotorProfile = useMemo(() => {
        if (!model) return null;
        const pInput = parseFloat(maxPowerInput);
        const usedMax = Number.isFinite(pInput) && pInput > 0 ? pInput : maxPower;
        if (!Number.isFinite(usedMax) || usedMax <= 0) return null;
        const reserve = Math.max(usedMax - model.cp, 0);
        const cpRel = weight > 0 ? model.cp / weight : null;
        const maxRel = weight > 0 ? usedMax / weight : null;
        const resRel = weight > 0 ? reserve / weight : null;
        const e = model.e_riegel;
        const relThresh = maxRel ?? (usedMax > 0 ? usedMax / 70 : 0);

        let profile, modality;
        if (isEndurance) {
            if (e > 0.85 && relThresh > 14.5) { profile = 'Profil complet'; modality = 'HIIT long + seuil'; }
            else if (e <= 0.85 && relThresh > 14.5) { profile = 'Profil vitesse'; modality = 'HIIT long + travail seuil 1'; }
            else if (e > 0.85 && relThresh <= 14.5) { profile = 'Profil endurant'; modality = 'HIIT court + sprint'; }
            else { profile = 'Profil moyen'; modality = 'HIIT court + sprint'; }
        } else {
            if (e > 0.85 && relThresh > 14.5) { profile = 'Profil complet'; modality = 'HIIT long + seuil'; }
            else if (e <= 0.85 && relThresh > 14.5) { profile = 'Profil vitesse'; modality = 'HIIT long'; }
            else if (e > 0.85 && relThresh <= 14.5) { profile = 'Profil endurance'; modality = 'HIIT court + vitesse endurance'; }
            else { profile = 'Profil moyen'; modality = 'HIIT court + sprint'; }
        }

        return { profile, modality, eFit: e, cpFit: model.cp, cpRelative: cpRel, maxPowerUsed: usedMax, maxPowerRelative: maxRel, reservePower: reserve, reserveRelative: resRel, title: isEndurance ? "Résultats pour l'endurance" : "Résultats pour l'intensité" };
    }, [model, maxPowerInput, maxPower, weight, isEndurance]);

    return (
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-[2rem] shadow-[0_2px_40px_rgb(0,0,0,0.04)] border border-stone-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-3">
                    <div className="p-2.5 bg-stone-100 rounded-xl"><Zap className="text-stone-600 w-5 h-5" /></div>
                    Tableau de bord - Vélo
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
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Données d'effort</h3>
                        </div>
                        {activeEntries.map((entry, i) => (
                            <div key={i} className="bg-stone-50 p-4 rounded-2xl border border-stone-100/80">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-stone-200 text-[10px] font-bold text-stone-600">Test {i + 1}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">Durée (secs)</label>
                                        <input type="number" value={entry.duration} onChange={e => update(i, 'duration', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm transition-all focus:border-stone-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">Watts moy</label>
                                        <input type="number" value={entry.power} onChange={e => update(i, 'power', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm transition-all focus:border-stone-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider">FC moy</label>
                                        <input type="number" value={entry.hr} onChange={e => update(i, 'hr', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm transition-all focus:border-stone-400 focus:ring-0 outline-none text-stone-800 font-medium" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Coaching Analysis */}
                    {coaching && (
                        <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm mt-4 flex flex-col gap-3">
                            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5"><Info className="w-4 h-4 text-emerald-600" /> Profil d'Entraînement</h3>
                            <div>
                                <p className="font-bold text-emerald-900 text-base mb-1">{coaching.title}</p>
                                <p className="text-sm font-medium leading-relaxed text-emerald-800 mb-2">{coaching.description}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">Conseil Coach</h4>
                                <p className="text-sm leading-relaxed text-emerald-900/80 mb-3">{coaching.advice}</p>
                            </div>
                            <div className="p-3 bg-white/60 rounded-xl border border-emerald-200/50">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-2">Séance Type : {coaching.session.name}</h4>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-100/50 px-1.5 py-0.5 rounded">Débutant</span>
                                        <p className="text-emerald-900 font-semibold text-xs mt-0.5">{coaching.session.debutant}</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-100/50 px-1.5 py-0.5 rounded">Confirmé</span>
                                        <p className="text-emerald-900 font-semibold text-xs mt-0.5">{coaching.session.confirme}</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-100/50 px-1.5 py-0.5 rounded">Expert</span>
                                        <p className="text-emerald-900 font-semibold text-xs mt-0.5">{coaching.session.expert}</p>
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
                                <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-blue-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1 flex items-center gap-1"><Zap className="w-3 h-3 text-stone-400"/>Puissance Critique</p>
                                    <div className="flex items-baseline gap-1 mt-1">
                                        <p className="text-4xl font-black tracking-tight text-stone-800">{model.cp.toFixed(0)}</p>
                                        <span className="text-sm font-bold text-stone-400">W</span>
                                    </div>
                                </div>
                                
                                <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-emerald-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Index Endurance</p>
                                    <p className="text-4xl font-black tracking-tight text-stone-800 mt-1">{model.e_riegel.toFixed(2)}</p>
                                </div>

                                <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm border-t-4 border-t-amber-500 flex flex-col justify-center transform transition-transform hover:-translate-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">W' (Réserve)</p>
                                    <div className="flex items-baseline gap-1 mt-1">
                                        <p className="text-4xl font-black tracking-tight text-stone-800">{(model.wprime / 1000).toFixed(1)}</p>
                                        <span className="text-sm font-bold text-stone-400">kJ</span>
                                    </div>
                                </div>

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

                {/* COLUMN 3: Zones & Profil */}
                <div className="flex flex-col gap-6">
                    {model && (
                        <>
                            {/* Training Zones */}
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5"><Activity className="w-4 h-4 text-stone-500" /> Zones</h3>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {powerZones.map((pz, i) => {
                                        const hzInfo = hrZones[i] ? hrZones[i].range.replace(' bpm', '') : (i === 5 ? 'Max' : '-');
                                        
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
                                                        <span className="text-xs font-bold text-stone-800">{pz.name}</span>
                                                        <span className="text-[10px] font-bold text-stone-400">Z{i+1}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                                                        <div>
                                                            <p className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">Watts</p>
                                                            <p className="text-xs font-semibold text-stone-700">{pz.range.replace(' W', '')}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">FC</p>
                                                            <p className="text-xs font-semibold text-stone-700">{hzInfo}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Locomotor Profile */}
                            <div>
                                <div className="flex items-center gap-2 mb-3 mt-2">
                                    <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">Profil Profil Loco.</h3>
                                </div>
                                <div className="p-4 rounded-xl border border-stone-100 bg-white shadow-sm space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-stone-400 mb-1 uppercase tracking-wide">Pmax (W)</label>
                                            <input type="number" value={maxPowerInput} onChange={e => setMaxPowerInput(e.target.value)} placeholder={maxPower ? maxPower.toFixed(0) : '400'} className="w-full px-3 py-2 bg-stone-50 border border-stone-100 rounded-lg text-sm transition-all focus:border-stone-300 outline-none text-stone-700" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-stone-400 mb-1 uppercase tracking-wide">Poids (kg)</label>
                                            <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} className="w-full px-3 py-2 bg-stone-50 border border-stone-100 rounded-lg text-sm transition-all focus:border-stone-300 outline-none text-stone-700" />
                                        </div>
                                    </div>
                                    
                                    <label className="flex items-center gap-2 text-[11px] font-bold text-stone-500 cursor-pointer select-none">
                                        <input type="checkbox" checked={isEndurance} onChange={e => setIsEndurance(e.target.checked)} className="rounded border-stone-300 text-stone-800 focus:ring-stone-500 w-3.5 h-3.5" />
                                        Focus Endur. longue dist.
                                    </label>

                                    {locomotorProfile ? (
                                        <div className="pt-3 border-t border-stone-100">
                                            <div className="flex justify-between items-end mb-2">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase">Réserve Anaérobie</p>
                                                <div className="text-right">
                                                    <span className="text-lg font-bold text-stone-800">{locomotorProfile.reservePower.toFixed(0)} <span className="text-[10px] text-stone-500">W</span></span>
                                                    {locomotorProfile.reserveRelative !== null && <span className="text-[10px] font-medium text-stone-400 ml-1">({locomotorProfile.reserveRelative.toFixed(1)} W/kg)</span>}
                                                </div>
                                            </div>
                                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mt-2">
                                                <p className="text-[10px] text-blue-600 font-bold uppercase mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> Recommandation</p>
                                                <p className="text-sm font-black text-blue-900 mb-0.5">{locomotorProfile.profile}</p>
                                                <p className="text-xs font-medium text-blue-800">{locomotorProfile.modality}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-3 border-t border-stone-100">
                                            <p className="text-[11px] text-stone-400 text-center">Calcul du profil et de la réserve désactivé (vérifier PM)</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
