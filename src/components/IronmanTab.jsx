import { useState, useMemo } from 'react';
import { Flag, Calendar, ChevronRight, Activity, Dumbbell, Clock } from 'lucide-react';

export default function IronmanTab() {
    const [disciplines, setDisciplines] = useState({
        swim: { cp: '1.15', index: '0.92' },
        bike: { cp: '250', index: '0.89' },
        run: { cp: '14.5', index: '0.91' },
    });
    const [volumes, setVolumes] = useState({ runKm: '50', bikeH: '8', swimKm: '10' });
    const [prepMonths, setPrepMonths] = useState(6);
    const [halfIM, setHalfIM] = useState(true);
    const [raceDate, setRaceDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        return d.toISOString().split('T')[0];
    });

    const updateDisc = (disc, k, v) => setDisciplines(prev => ({ ...prev, [disc]: { ...prev[disc], [k]: v } }));

    const avgIndex = useMemo(() => {
        const vals = Object.values(disciplines).map(d => parseFloat(d.index)).filter(Number.isFinite);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }, [disciplines]);

    const profile = useMemo(() => {
        if (avgIndex >= 0.95) return {
            label: 'Profil endurant', color: 'emerald', icon: '🟢', desc: `Tes index d'endurance sont élevés. Tu as un bon potentiel pour les longues distances.`
        };
        if (avgIndex >= 0.9) return {
            label: 'Profil équilibré', color: 'blue', icon: '🔵', desc: `Tes index d'endurance sont corrects. Tu peux viser un bon IM avec un bon plan.`
        };
        return { label: 'Profil rapide', color: 'orange', icon: '🟠', desc: `Tes index d'endurance sont bas. Concentre-toi sur le développement de l'endurance de base.` };
    }, [avgIndex]);


    const phases = useMemo(() => {
        const totalWeeks = prepMonths * 4;
        if (totalWeeks < 8) return [];
        const phases = [];
        if (halfIM) {
            const dev = Math.round(totalWeeks * 0.25);
            const vo2 = Math.round(totalWeeks * 0.2);
            const seuil2 = Math.round(totalWeeks * 0.2);
            const spec = totalWeeks - dev - vo2 - seuil2;
            phases.push({ name: 'Développement seuil', weeks: dev, color: 'bg-emerald-500', focus: `Construire l'endurance de base dans les 3 disciplines. Volume progressif.` });
            phases.push({ name: 'VO₂ & Puissance', weeks: vo2, color: 'bg-blue-500', focus: `Intervalles intenses et développement de la puissance maximale aérobie.` });
            phases.push({ name: 'Seuil 2 (pré-HIM)', weeks: seuil2, color: 'bg-amber-500', focus: `Préparation au Half-Ironman. Séances à intensité spécifique de course.` });
            phases.push({ name: 'Spécifique IM', weeks: spec, color: 'bg-red-500', focus: `Préparation finale : sorties longues, enchaînements, nutrition de course.` });
        } else {
            const dev = Math.round(totalWeeks * 0.4);
            const seuil = Math.round(totalWeeks * 0.3);
            const spec = totalWeeks - dev - seuil;
            phases.push({ name: 'Développement aérobie', weeks: dev, color: 'bg-emerald-500', focus: `Construire la base aérobie et augmenter le volume progressivement.` });
            phases.push({ name: 'Seuil & Tempo', weeks: seuil, color: 'bg-amber-500', focus: `Développer l'allure de course avec des séances au seuil.` });
            phases.push({ name: 'Spécifique IM', weeks: spec, color: 'bg-red-500', focus: `Affûtage et spécifique : enchaînements, nutrition, stratégie.` });
        }
        return phases;
    }, [prepMonths, halfIM]);

    const sessionRecommendations = useMemo(() => {
        const sessions = {
            swim: [],
            bike: [],
            run: [],
        };
        const swimIdx = parseFloat(disciplines.swim.index) || 0;
        const bikeIdx = parseFloat(disciplines.bike.index) || 0;
        const runIdx = parseFloat(disciplines.run.index) || 0;

        // Swim
        if (swimIdx < 0.9) sessions.swim.push({ name: 'Endurance CSS', desc: '8x200m à 95% CSS, r=20s', intensity: 'Seuil' });
        else sessions.swim.push({ name: 'Vitesse longue', desc: '4x400m à 98% CSS, r=30s', intensity: 'VO₂' });
        sessions.swim.push({ name: 'Sortie longue', desc: '3000-4000m continu à 80% CSS', intensity: 'Endurance' });

        // Bike
        if (bikeIdx < 0.9) sessions.bike.push({ name: 'Tempo long', desc: '2x30min à 88-92% PC', intensity: 'Seuil' });
        else sessions.bike.push({ name: 'Intervalles VO₂', desc: '5x5min à 105-110% PC, r=3min', intensity: 'VO₂' });
        sessions.bike.push({ name: 'Sortie longue', desc: '4-5h à 70-75% PC', intensity: 'Endurance' });

        // Run
        if (runIdx < 0.9) sessions.run.push({ name: 'Seuil fractionné', desc: '4x2000m à 95% VC, r=90s', intensity: 'Seuil' });
        else sessions.run.push({ name: '30/30', desc: '2 séries 12x30/30 à 105% VC', intensity: 'VO₂' });
        sessions.run.push({ name: 'Sortie longue', desc: '25-35 km à 75-80% VC', intensity: 'Endurance' });

        return sessions;
    }, [disciplines]);

    const totalWeeks = prepMonths * 4;

    return (
        <div className="space-y-6">
            {/* Discipline Inputs */}
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-8">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-xl"><Flag className="text-orange-500 w-6 h-6" /></div>
                    Planificateur Ironman
                </h2>

                <div className="grid gap-6 md:grid-cols-3">
                    {[
                        { key: 'swim', label: 'Natation', unit: 'm/s (CSS)', icon: '🏊', color: 'from-cyan-500 to-blue-500' },
                        { key: 'bike', label: 'Vélo', unit: 'W (CP)', icon: '🚴', color: 'from-yellow-500 to-orange-500' },
                        { key: 'run', label: 'Course', unit: 'km/h (VC)', icon: '🏃', color: 'from-red-500 to-rose-500' },
                    ].map(d => (
                        <div key={d.key} className={`relative overflow-hidden p-6 rounded-3xl bg-gradient-to-br ${d.color} text-white shadow-xl`}>
                            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
                            <p className="text-3xl mb-3">{d.icon}</p>
                            <p className="font-bold text-lg mb-4">{d.label}</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] uppercase tracking-widest text-white/70 mb-1 font-bold">{d.unit}</label>
                                    <input type="text" value={disciplines[d.key].cp} onChange={e => updateDisc(d.key, 'cp', e.target.value)} className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/50 text-sm font-medium outline-none focus:bg-white/30 transition-colors backdrop-blur-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase tracking-widest text-white/70 mb-1 font-bold">Index d'endurance</label>
                                    <input type="text" value={disciplines[d.key].index} onChange={e => updateDisc(d.key, 'index', e.target.value)} className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/50 text-sm font-medium outline-none focus:bg-white/30 transition-colors backdrop-blur-sm" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Volumes & Settings */}
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Dumbbell className="w-4 h-4 text-slate-500" /> Volumes hebdomadaires</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1 font-bold">CAP (km/sem)</label>
                                <input type="number" value={volumes.runKm} onChange={e => setVolumes(v => ({ ...v, runKm: e.target.value }))} className="w-full px-3 py-2 bg-white border rounded-lg text-sm font-medium outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1 font-bold">Vélo (h/sem)</label>
                                <input type="number" value={volumes.bikeH} onChange={e => setVolumes(v => ({ ...v, bikeH: e.target.value }))} className="w-full px-3 py-2 bg-white border rounded-lg text-sm font-medium outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1 font-bold">Nat. (km/sem)</label>
                                <input type="number" value={volumes.swimKm} onChange={e => setVolumes(v => ({ ...v, swimKm: e.target.value }))} className="w-full px-3 py-2 bg-white border rounded-lg text-sm font-medium outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-500" /> Paramètres</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1 font-bold">Date de course</label>
                                <input type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} className="w-full px-3 py-2 bg-white border rounded-lg text-sm font-medium outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1 font-bold">Durée (mois)</label>
                                <input type="range" min={2} max={12} value={prepMonths} onChange={e => setPrepMonths(Number(e.target.value))} className="block w-full mt-2 accent-slate-800" />
                                <p className="text-sm font-bold text-slate-700 text-center mt-1">{prepMonths} mois ({totalWeeks} sem)</p>
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={halfIM} onChange={e => setHalfIM(e.target.checked)} className="rounded border-slate-300 text-orange-500 focus:ring-orange-300" />
                            Inclure un Half-Ironman en préparation
                        </label>
                    </div>
                </div>
            </div>

            {/* Profil */}
            <div className={`relative overflow-hidden p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl`}>
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400 mb-1">Profil athlète</p>
                        <h3 className="text-2xl font-bold">{profile.icon} {profile.label}</h3>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400">Index moyen d'endurance</p>
                        <p className="text-3xl font-bold text-white">{avgIndex.toFixed(2)}</p>
                    </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed relative z-10">{profile.desc}</p>
            </div>

            {/* Phases */}
            {phases.length > 0 && (
                <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-1.5 bg-slate-100 rounded-lg"><Clock className="w-5 h-5 text-slate-600" /></div>
                        <h3 className="text-xl font-bold text-slate-800">Phases d'entraînement</h3>
                    </div>
                    {/* Timeline bar */}
                    <div className="flex rounded-full overflow-hidden h-3 w-full mb-8 shadow-inner bg-slate-100">
                        {phases.map((p, i) => (
                            <div key={i} className={`${p.color} transition-all`} style={{ width: `${(p.weeks / totalWeeks) * 100}%` }} title={`${p.name}: ${p.weeks} semaines`} />
                        ))}
                    </div>
                    <div className="grid gap-4">
                        {phases.map((p, i) => (
                            <div key={i} className="flex items-start gap-4 p-5 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow bg-white">
                                <div className={`w-3 h-3 rounded-full mt-1.5 ${p.color} shadow-sm`} />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-bold text-slate-800 flex items-center gap-2">{p.name} <ChevronRight className="w-3 h-3 text-slate-300" /></h4>
                                        <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-500">{p.weeks} sem.</span>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">{p.focus}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sessions */}
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-1.5 bg-orange-100 rounded-lg"><Activity className="w-5 h-5 text-orange-600" /></div>
                    <h3 className="text-xl font-bold text-slate-800">Séances cibles</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                    {[
                        { key: 'swim', label: '🏊 Natation', color: 'border-cyan-200' },
                        { key: 'bike', label: '🚴 Vélo', color: 'border-orange-200' },
                        { key: 'run', label: '🏃 Course', color: 'border-red-200' },
                    ].map(d => (
                        <div key={d.key} className={`rounded-2xl border-2 ${d.color} p-5 bg-white shadow-sm space-y-3`}>
                            <p className="font-bold text-slate-800">{d.label}</p>
                            {sessionRecommendations[d.key].map((s, i) => (
                                <div key={i} className="p-3 bg-slate-50 rounded-xl space-y-1">
                                    <div className="flex justify-between">
                                        <p className="text-xs font-bold text-slate-700">{s.name}</p>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-slate-400 px-2 py-0.5 rounded-full">{s.intensity}</span>
                                    </div>
                                    <p className="text-xs text-slate-500">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
