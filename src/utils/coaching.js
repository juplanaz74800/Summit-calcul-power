import { formatTime, speedToPace } from './formatters';

export function getRunningCoaching(e_riegel, cp, paceStr) {
    let profileLabel = '';
    let description = '';
    let advice = '';
    let session = {};

    if (e_riegel < 0.90) {
        profileLabel = "Profil Vitesse / Piste";
        description = `Avec un indice de ${e_riegel.toFixed(2)}, tu possèdes une très bonne vitesse de base mais tu faiblis sur la distance.`;
        advice = "L'objectif est de développer l'endurance aérobie et le seuil pour mieux soutenir ton rythme sur la durée.";
        
        const tempoSpeed = cp * 0.93;
        const pace = speedToPace(tempoSpeed);
        session = {
            name: "Tempo Run (Seuil Aérobie)",
            debutant: `2 x 8 min à ${pace}/km (Récup: 2 min footing lent)`,
            confirme: `3 x 10 min à ${pace}/km (Récup: 2 min footing lent)`,
            expert: `3 x 15 min à ${pace}/km (Récup: 2 min footing lent)`
        };
    } else if (e_riegel >= 0.90 && e_riegel <= 0.94) {
        profileLabel = "Profil Équilibré / 10k-Semi";
        description = `Avec un indice de ${e_riegel.toFixed(2)}, tu as un profil complet et polyvalent.`;
        advice = "Ton équilibre est bon. Pour progresser, il faut augmenter ton plafond en travaillant la VMA et le « Sweet Spot ».";
        
        const sweetSpotSpeed = cp * 1.02;
        const pace = speedToPace(sweetSpotSpeed);
        session = {
            name: "Intervalles au Seuil",
            debutant: `4 x 1000m à ${pace}/km (Récup: 1 min 30s footing)`,
            confirme: `5 x 1000m ou 3 x 2000m à ${pace}/km (Récup: 1 min 30s footing)`,
            expert: `4 x 2000m à ${pace}/km (Récup: 1 min 30s footing)`
        };
    } else {
        profileLabel = "Profil Endurance / Marathon";
        description = `Avec un indice de ${e_riegel.toFixed(2)}, tu es un vrai diésel. Tu maintiens très bien l'effort sur la fatigue.`;
        advice = "Tu as une excellente endurance mais tu manques de réserves de vitesse. Il faut redescendre sur des distances courtes !";
        
        const vmaSpeed = cp * 1.12;
        const pace = speedToPace(vmaSpeed);
        session = {
            name: "VMA Courte",
            debutant: `8 x 300m à ${pace}/km (Récup: 1 min sur place ou marche)`,
            confirme: `12 x 400m à ${pace}/km (Récup: 1 min sur place ou marche)`,
            expert: `16 x 400m à ${pace}/km (Récup: 1 min sur place ou marche)`
        };
    }

    return { title: profileLabel, description, advice, session };
}

export function getCyclingCoaching(e_riegel, cp, isEndurance) {
    let profileLabel = '';
    let description = '';
    let advice = '';
    let session = {};

    if (e_riegel < 0.85) {
        profileLabel = "Profil Puncheur / Sprinteur";
        description = `Indice de ${e_riegel.toFixed(2)}. Ta force réside dans les efforts courts et intenses, mais tu fatigues rapidement sur la durée.`;
        advice = "Focus sur le recrutement aérobie profond (Endurance fondamentale) et le Sweet Spot pour durer musculairement.";
        
        const pHigh = Math.round(cp * 1.05);
        const pLow = Math.round(cp * 0.95);
        session = {
            name: "Criss-Cross au Seuil",
            debutant: `2 x 10min alternant (2min à ${pLow}W / 1min à ${pHigh}W)`,
            confirme: `2 x 15min alternant (2min à ${pLow}W / 1min à ${pHigh}W)`,
            expert: `3 x 15min alternant (2min à ${pLow}W / 1min à ${pHigh}W)`
        };
    } else if (e_riegel >= 0.85 && e_riegel <= 0.92) {
        profileLabel = "Profil Poursuiteur / Rouleur";
        description = `Indice de ${e_riegel.toFixed(2)}. Un mix de capacité aérobie et d'aptitude à répéter les efforts intenses.`;
        advice = "Ton profil est très polyvalent. Idéal pour développer la PMA (Puissance Maximale Aérobie) intermittente.";
        
        const pmaSpeed = Math.round(cp * 1.20);
        session = {
            name: "PMA Intermittente",
            debutant: `2 blocs de (6 x 30s à ${pmaSpeed}W / 30s récup). 5min récup entre blocs`,
            confirme: `3 blocs de (8 x 30s à ${pmaSpeed}W / 30s récup). 5min récup entre blocs`,
            expert: `3 blocs de (10 x 30s à ${pmaSpeed}W / 30s récup). 5min récup entre blocs`
        };
    } else {
        profileLabel = "Profil Triathlète Longue Distance";
        description = `Indice de ${e_riegel.toFixed(2)}. Gros moteur d'endurance, tu résistes extrêmement bien à la fatigue musculaire périphérique.`;
        advice = "Ta base endurante est énorme. Booster le plafond PMA est la seule façon d'augmenter significativement ta PC.";
        
        const pmaLong = Math.round(cp * 1.10);
        session = {
            name: "PMA Longue",
            debutant: `4 x 2min à ${pmaLong}W (Récup: 2min pédalage souple)`,
            confirme: `6 x 2min à ${pmaLong}W (Récup: 2min pédalage souple)`,
            expert: `5 x 3min à ${pmaLong}W (Récup: 2min 30s pédalage souple)`
        };
    }

    return { title: profileLabel, description, advice, session };
}

export function getTrailCoaching(ratio, vamCritical) {
    let profileLabel = '';
    let description = '';
    let advice = '';
    let session = {};

    if (ratio < 0.85) {
        profileLabel = "Profil Rouleur / Terrains Roulants";
        description = `Ratio de ${ratio.toFixed(2)}. Tu es bien plus performant sur le plat ou les pentes douces que dans le raide.`;
        advice = "Travail spécifique de force en côte et renforcement musculaire (chaîne postérieure) requis.";
        
        const vamTarget = Math.round(vamCritical * 1.08);
        session = {
            name: "Force en côte (> 15%)",
            debutant: `6 x 1 min à ${vamTarget} m/h VAM (Récup: Descente souple)`,
            confirme: `8 à 10 x 1 min à ${vamTarget} m/h VAM (Récup: Descente souple)`,
            expert: `12 x 1 min ou 6 x 2 min à ${vamTarget} m/h VAM (Récup: Descente)`
        };
    } else if (ratio >= 0.85 && ratio <= 1.05) {
        profileLabel = "Profil Polyvalent / Tout-Terrain";
        description = `Ratio de ${ratio.toFixed(2)}. Ton allure s'adapte très bien à la pente de manière constante.`;
        advice = "Continue d'équilibrer tes entraînements. Tu peux mettre l'accent sur les variations d'allures (Fartlek) en terrain technique.";
        
        const vamTarget = Math.round(vamCritical * 0.95);
        session = {
            name: "Fartlek Vallonné (Montagnes Russes)",
            debutant: `45min avec 4 relances de 2min en bosse douce à ${vamTarget} m/h`,
            confirme: `1h avec 6 relances de 3min en bosse douce à ${vamTarget} m/h`,
            expert: `1h15 avec 8 relances de 3min en bosse douce à ${vamTarget} m/h`
        };
    } else {
        profileLabel = "Profil Grimpeur / Force";
        description = `Ratio de ${ratio.toFixed(2)}. Tu excelles dès que la pente s'élève, mais tu pêches sûrement sur le roulant.`;
        advice = "Il te faut un travail de survitesse et d'élasticité sur le plat et faux-plat descendant pour regagner de la foulée.";
        
        session = {
            name: "Vitesse sur Plat",
            debutant: `Footing 30min + 6 x 400m sur plat à 105% VC Plat`,
            confirme: `Footing 30min + 8 Lignes droites + 6 x 800m à 105% VC Plat`,
            expert: `Footing 30min + 8 Lignes droites + 8 x 1000m à 105% VC Plat`
        };
    }

    return { title: profileLabel, description, advice, session };
}

/**
 * Helper to calculate time for a specific segment of points.
 */
function calculateTimeForSegment(profile, forceVelocity, intensityPct) {
    if (!profile || profile.length < 2) return 0;
    
    const intensity = intensityPct / 100;
    const vc = forceVelocity.vc * intensity;
    const ratio = forceVelocity.ratio;
    let seconds = 0;

    for (let i = 1; i < profile.length; i++) {
        const dKm = profile[i].distanceKm - (profile[i-1]?.distanceKm || 0);
        if (dKm <= 0) continue;

        const grade = profile[i].grade;
        let speed;

        if (grade >= 0) {
            const refSlope = 12; 
            const ratioWeight = refSlope > 0 ? Math.min(grade / refSlope, 1) : 0;
            const effectiveRatio = grade > 0 ? (1 + (ratio - 1) * ratioWeight) : 1;
            const baseTheoreticalSpeed = vc / (1 + (grade / 100) * 8); 
            speed = baseTheoreticalSpeed * effectiveRatio;
        } else {
            const absGrade = Math.abs(grade);
            if (absGrade <= 10) {
                speed = vc * (1 + (absGrade / 10) * 0.15);
            } else if (absGrade <= 25) {
                speed = vc * (1.15 - ((absGrade - 10) / 15) * 0.45);
            } else {
                speed = vc * (0.7 / (1 + (absGrade - 25) / 15));
            }
        }

        if (speed > 0.5) {
            seconds += (dKm / speed) * 3600;
        } else {
            seconds += (dKm / 0.5) * 3600;
        }
    }
    return seconds;
}

/**
 * Generate a comprehensive report for a GPX track based on athlete profile.
 */
export function getTrailReport(analysis, forceVelocity, intensityPct = 85) {
    if (!analysis || !forceVelocity || !analysis.profile) return null;

    // Total Track Time
    const totalSeconds = calculateTimeForSegment(analysis.profile, forceVelocity, intensityPct);

    // Nutrition & Hydration
    const durationHours = totalSeconds / 3600;
    const waterLiters = durationHours * 0.65;
    const carbsGrams = durationHours * 75;

    // Detailed Segment Times (Climbs)
    const topClimbEstimates = analysis.topClimbs.map(c => {
        const segmentPts = analysis.profile.filter(p => p.distanceKm >= c.startKm && p.distanceKm <= c.endKm);
        const seconds = calculateTimeForSegment(segmentPts, forceVelocity, intensityPct);
        const distKm = c.distanceM / 1000;
        return {
            ...c,
            estimatedTimeSeconds: seconds,
            formattedTime: formatTime(seconds),
            avgPace: seconds > 0 ? speedToPace(distKm / (seconds / 3600)) : '--:--'
        };
    });

    // Detailed Segment Times (Descents)
    const topDescentEstimates = analysis.topDescents.map(c => {
        const segmentPts = analysis.profile.filter(p => p.distanceKm >= c.startKm && p.distanceKm <= c.endKm);
        const seconds = calculateTimeForSegment(segmentPts, forceVelocity, intensityPct);
        const distKm = c.distanceM / 1000;
        return {
            ...c,
            estimatedTimeSeconds: seconds,
            formattedTime: formatTime(seconds),
            avgPace: seconds > 0 ? speedToPace(distKm / (seconds / 3600)) : '--:--'
        };
    });

    // Crux Analysis (Hardest part)
    const crux = topClimbEstimates.length ? topClimbEstimates.reduce((a, b) => b.difficulty > a.difficulty ? b : a) : null;
    let cruxAdvice = "";
    if (crux) {
        if (crux.avgGrade > 15) {
            cruxAdvice = "Pente très raide : privilégie la marche active avec les mains sur les genoux ou bâtons.";
        } else if (crux.distanceM > 2000) {
            cruxAdvice = "Montée très longue : garde une intensité constante pour ne pas exploser.";
        } else {
            cruxAdvice = "Section exigeante : gère ton souffle et évite les à-coups.";
        }
    }

    return {
        estimatedSeconds: totalSeconds,
        formattedTime: formatTime(totalSeconds),
        waterLiters: waterLiters.toFixed(1),
        carbsGrams: Math.round(carbsGrams),
        climbDist: analysis.stats.totalDplus,
        avgPace: speedToPace(analysis.stats.totalDistanceKm / (totalSeconds / 3600)),
        crux,
        cruxAdvice,
        intensityPct,
        topClimbEstimates,
        topDescentEstimates
    };
}
