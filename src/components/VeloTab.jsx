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

    const masterZones = useMemo(() => {
        if (!model) return [];
        const cp = model.cp;
        const hrt = hrThreshold;
        
        const z = (name, fs, fe, fh_s, fh_e, color, dot) => ({
            name,
            watt: `${(fs * cp).toFixed(0)} - ${(fe * cp).toFixed(0)} W`,
            hr: hrt ? (fh_e ? `${Math.round(fh_s * hrt)} - ${Math.round(fh_e * hrt)}` : `> ${Math.round(fh_s * hrt)}`) : null,
            color, dot
        });

        return [
            z('RÉCUPÉRATION', 0.50, 0.65, 0, 0.8, 'bg-blue-500/10 text-blue-800', 'bg-blue-500'),
            z('ENDURANCE', 0.65, 0.80, 0.8, 0.9, 'bg-emerald-500/10 text-emerald-800', 'bg-emerald-500'),
            z('TEMPO', 0.80, 0.85, 0.9, 0.95, 'bg-lime-500/10 text-lime-800', 'bg-lime-500'),
            z('SEUIL BAS', 0.85, 0.96, 0.95, 1.0, 'bg-amber-500/10 text-amber-800', 'bg-amber-500'),
            z('SEUIL HAUT', 0.96, 1.05, 1.0, 1.1, 'bg-red-500/10 text-red-800', 'bg-red-500'),
            { 
                name: 'VO₂ MAX', 
                watt: `> ${(1.1 * cp).toFixed(0)} W`, 
                hr: hrt ? `> ${Math.round(1.05 * hrt)}` : null, 
                color: 'bg-purple-500/10 text-purple-800', dot: 'bg-purple-500' 
            },
        ];
    }, [model, hrThreshold]);

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
        <div className="bg-surface-container-low p-5 sm:p-8 lg:p-10 rounded-[3rem] shadow-2xl shadow-on-surface/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-6">
                <h2 className="text-3xl font-black text-on-surface flex items-center gap-4 font-lexend tracking-tight">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-inner"><Zap className="text-primary w-6 h-6" /></div>
                    Tableau de Bord — Vélo
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
                            <Zap className="w-4 h-4"/> Tests de Puissance
                        </h3>
                        
                        <div className="space-y-3">
                            <div className="grid grid-cols-[1.5fr_2fr_1.2fr] gap-3 px-3 text-[9px] font-black text-tertiary/50 uppercase tracking-[0.1em] font-space text-center">
                                <div>Secs</div>
                                <div className="text-left">Watts moy</div>
                                <div>BPM</div>
                            </div>
                            
                            {activeEntries.map((entry, i) => (
                                <div key={i} className="grid grid-cols-[1.5fr_2fr_1.2fr] gap-3 items-center bg-surface-container-low/50 hover:bg-surface-container-high p-2 rounded-2xl transition-all group">
                                    <input type="number" placeholder="120" value={entry.duration} onChange={e => update(i, 'duration', e.target.value)} className="w-full text-xs bg-primary/5 px-2 py-2 rounded-xl font-black text-primary outline-none text-center font-space" />
                                    <input type="number" placeholder="300" value={entry.power} onChange={e => update(i, 'power', e.target.value)} className="w-full text-sm bg-transparent font-black text-on-surface outline-none placeholder:text-tertiary/20 font-space" />
                                    <input type="number" placeholder="-" value={entry.hr} onChange={e => update(i, 'hr', e.target.value)} className="w-full text-sm bg-transparent font-bold text-on-surface outline-none placeholder:text-tertiary/20 text-center font-space opacity-40 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Coaching Analysis — Editorial Style */}
                    {coaching && (
                        <div className="p-6 bg-primary/5 rounded-[2.5rem] flex flex-col gap-4 border border-primary/5">
                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.25em] flex items-center gap-2 font-lexend"><Info className="w-4 h-4" /> Profil Cycliste</h3>
                            <div>
                                <p className="font-extrabold text-on-surface text-lg mb-1 font-lexend tracking-tight">{coaching.title}</p>
                                <p className="text-sm font-medium leading-relaxed text-tertiary">{coaching.description}</p>
                            </div>
                            <div className="pt-4 border-t border-primary/10">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60 mb-2 font-lexend">Conseil Stratégique</h4>
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
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-2 font-lexend">Puissance Critique (PC)</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <p className="text-7xl font-black tracking-tighter font-space">{model.cp.toFixed(0)}</p>
                                        <span className="text-xl font-bold text-white/60 font-lexend">W</span>
                                    </div>
                                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full w-fit">
                                        <Activity className="w-3 h-3 text-white/80" />
                                        <p className="text-xs text-white font-black font-space tracking-wide">{(model.cp / (weight > 0 ? weight : 70)).toFixed(1)} <span className="text-[8px] opacity-60 uppercase">w/kg</span></p>
                                    </div>
                                </div>
                                
                                <div className="p-6 rounded-[2.5rem] bg-surface-container shadow-sm flex flex-col justify-center transform transition-all hover:scale-[1.03] group">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-tertiary mb-2 font-lexend group-hover:text-primary transition-colors">Index Endurance</p>
                                    <p className="text-5xl font-black tracking-tighter text-on-surface font-space">{model.e_riegel.toFixed(2)}</p>
                                </div>

                                <div className="p-6 rounded-[2.5rem] bg-surface-container shadow-sm flex flex-col justify-center transform transition-all hover:scale-[1.03] group">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-tertiary mb-2 font-lexend group-hover:text-primary transition-colors">W' (Réserve)</p>
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-5xl font-black tracking-tighter text-on-surface font-space">{(model.wprime / 1000).toFixed(1)}</p>
                                        <span className="text-xs font-bold text-tertiary/40 font-lexend uppercase">kJ</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Technical Locomotor — Subtle Card */}
                            <div className="bg-surface-container p-6 rounded-[3rem]">
                                <h3 className="text-[10px] font-black text-tertiary uppercase tracking-[0.3em] mb-6 font-lexend">Profil Locomoteur & Physique</h3>
                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-tertiary/50 uppercase tracking-widest font-space">Pmax (Sprint)</label>
                                        <input type="number" value={maxPowerInput} onChange={e => setMaxPowerInput(e.target.value)} placeholder={maxPower ? maxPower.toFixed(0) : '400'} className="w-full px-4 py-2.5 bg-surface-container-low text-on-surface font-black font-space rounded-2xl outline-none focus:ring-1 focus:ring-primary/20 transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-tertiary/50 uppercase tracking-widest font-space">Poids (kg)</label>
                                        <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} className="w-full px-4 py-2.5 bg-surface-container-low text-on-surface font-black font-space rounded-2xl outline-none focus:ring-1 focus:ring-primary/20 transition-all" />
                                    </div>
                                </div>
                                <label className="flex items-center gap-3 text-[10px] font-black text-tertiary cursor-pointer hover:text-primary transition-colors px-1 select-none">
                                    <input type="checkbox" checked={isEndurance} onChange={e => setIsEndurance(e.target.checked)} className="rounded-md border-primary/20 text-primary w-4 h-4" />
                                    Spécialisation Endurance / Ultra
                                </label>
                                
                                {locomotorProfile && (
                                    <div className="mt-8 pt-6 border-t border-on-surface/5">
                                        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/5">
                                            <div className="flex justify-between items-center mb-3">
                                                <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest font-space italic">Capacité de Réserve</p>
                                                <p className="text-xl font-black text-on-surface font-space">{locomotorProfile.reservePower.toFixed(0)} <span className="text-[10px] opacity-40 uppercase">W</span></p>
                                            </div>
                                            <p className="text-lg font-black text-on-surface font-lexend tracking-tight leading-none mb-1">{locomotorProfile.profile}</p>
                                            <p className="text-xs font-medium text-tertiary">{locomotorProfile.modality}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
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
                                <Activity className="w-4 h-4 text-primary" /> Zones de Puissance
                            </h3>
                            <div className="flex flex-col gap-3">
                                {masterZones.map((z, i) => (
                                    <div key={i} className={`flex flex-col p-4 rounded-3xl ${z.color} transition-all hover:scale-[1.02] cursor-default border border-on-surface/5`}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${z.dot}`}></div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.1em] font-lexend">{z.name}</p>
                                        </div>
                                        <div className="flex flex-col gap-1 pl-4.5">
                                            <p className="text-sm font-black font-space tracking-tight">{z.watt}</p>
                                            {z.hr && <p className="text-[11px] font-bold opacity-70 font-space whitespace-nowrap">{z.hr} <span className="text-[8px] opacity-50 uppercase tracking-tighter">bpm</span></p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-8 text-[9px] font-medium text-tertiary leading-relaxed text-center px-4 font-space opacity-50 uppercase tracking-widest">
                                *Precision Cycling Model v4.2
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

