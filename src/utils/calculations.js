import { paceToSpeed, timeToSeconds } from './formatters';

/**
 * Fit a critical power / velocity model from time-value pairs.
 * Uses both hyperbolic (CP) model and Riegel power-law model.
 * @param {Array<{t: number, v: number}>} data - array of {t: seconds, v: value}
 * @returns {{ cp: number, wprime: number, e_riegel: number, s_riegel: number }}
 */
export function fitModel(data) {
    if (!data || data.length < 2) return null;
    const sorted = [...data].sort((a, b) => a.t - b.t);

    // --- Hyperbolic CP model (2-parameter) ---
    let cp, wprime;
    if (sorted.length === 2) {
        const [a, b] = sorted;
        wprime = (a.v - b.v) * a.t * b.t / (b.t - a.t);
        cp = (b.v * b.t - a.v * a.t) / (b.t - a.t);
    } else {
        // 3-parameter least squares
        const n = sorted.length;
        const sumT = sorted.reduce((s, d) => s + d.t, 0);
        const sumV = sorted.reduce((s, d) => s + d.v, 0);
        const sumTV = sorted.reduce((s, d) => s + d.t * d.v, 0);
        const sumTT = sorted.reduce((s, d) => s + d.t * d.t, 0);
        const denom = n * sumTT - sumT * sumT;
        if (Math.abs(denom) < 1e-9) {
            cp = sumV / n;
            wprime = 0;
        } else {
            // Linear regression on: v = cp + wprime/t  =>  v*t = cp*t + wprime
            const sumVT = sorted.reduce((s, d) => s + d.v * d.t, 0);
            const denomVT = n * sumTT - sumT * sumT;
            cp = (n * sumVT - sumT * sumV * 1) / denomVT;
            // Recompute with proper model
            const sumInvT = sorted.reduce((s, d) => s + 1 / d.t, 0);
            const sumInvTT = sorted.reduce((s, d) => s + 1 / (d.t * d.t), 0);
            const sumVInvT = sorted.reduce((s, d) => s + d.v / d.t, 0);
            const denom2 = n * sumInvTT - sumInvT * sumInvT;
            if (Math.abs(denom2) > 1e-9) {
                wprime = (n * sumVInvT - sumInvT * sumV) / denom2;
                cp = (sumV - wprime * sumInvT) / n;
            } else {
                cp = sumV / n;
                wprime = 0;
            }
        }
    }

    // --- Riegel power-law model ---
    // v = s * t^(e-1)  =>  ln(v) = ln(s) + (e-1)*ln(t)
    const n = sorted.length;
    const lnT = sorted.map(d => Math.log(d.t));
    const lnV = sorted.map(d => Math.log(d.v));
    const sumLnT = lnT.reduce((s, v) => s + v, 0);
    const sumLnV = lnV.reduce((s, v) => s + v, 0);
    const sumLnTT = lnT.reduce((s, v) => s + v * v, 0);
    const sumLnTV = lnT.reduce((s, v, i) => s + v * lnV[i], 0);
    const denomR = n * sumLnTT - sumLnT * sumLnT;
    let e_riegel, s_riegel;
    if (Math.abs(denomR) < 1e-9) {
        e_riegel = 1;
        s_riegel = Math.exp(sumLnV / n);
    } else {
        const slope = (n * sumLnTV - sumLnT * sumLnV) / denomR;
        const intercept = (sumLnV - slope * sumLnT) / n;
        e_riegel = slope + 1; // because v = s * t^(e-1), slope = e-1
        s_riegel = Math.exp(intercept);
    }

    return {
        cp: Math.max(0, cp),
        wprime: Math.max(0, wprime),
        e_riegel,
        s_riegel
    };
}

/**
 * Generate curve data for Recharts from a model.
 */
export function generateCurve(model, maxTimeSeconds) {
    if (!model) return [];
    const points = [];
    const steps = 100;
    const minT = 30;
    const maxT = Math.max(maxTimeSeconds, 600);

    for (let i = 0; i <= steps; i++) {
        const t = minT + (maxT - minT) * (i / steps);
        const cpModel = model.cp + model.wprime / t;
        const riegelModel = model.s_riegel * Math.pow(t, model.e_riegel - 1);

        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.round(t % 60);
        let timeFormatted;
        if (h > 0) timeFormatted = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        else timeFormatted = `${m}:${s.toString().padStart(2, '0')}`;

        points.push({
            time: t,
            timeFormatted,
            cpModel: Number.isFinite(cpModel) ? cpModel : null,
            riegelModel: Number.isFinite(riegelModel) ? riegelModel : null,
            unit: ''
        });
    }
    return points;
}

/**
 * Compute HR threshold using HbLim/CHR method (linear regression of HR*t vs t).
 */
export function computeHRThreshold(entries) {
    // entries: [{tMinutes, hr}]
    const valid = entries
        .map(e => ({ tMinutes: e.tMinutes, hbLim: e.hr * e.tMinutes }))
        .filter(e => e.tMinutes > 0 && Number.isFinite(e.hbLim) && e.hbLim > 0);

    if (valid.length < 2) return null;

    const n = valid.length;
    const sumT = valid.reduce((s, e) => s + e.tMinutes, 0);
    const sumHb = valid.reduce((s, e) => s + e.hbLim, 0);
    const sumTHb = valid.reduce((s, e) => s + e.tMinutes * e.hbLim, 0);
    const sumTT = valid.reduce((s, e) => s + e.tMinutes * e.tMinutes, 0);

    const denom = n * sumTT - sumT * sumT;
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-9) return null;

    const slope = ((n * sumTHb - sumT * sumHb) / denom) * 0.98;
    return Number.isFinite(slope) && slope > 0 ? slope : null;
}

/**
 * Compute CSS (Critical Swim Speed) from 3 swim paces.
 * Uses linear regression: distance = CSS * time + d_prime
 */
export function computeSwimCSS(paces) {
    // paces: { v100: "MM:SS", v400: "MM:SS", v1000: "MM:SS" }
    const distances = [
        { dist: 100, pace: paces.v100 },
        { dist: 400, pace: paces.v400 },
        { dist: 1000, pace: paces.v1000 }
    ];

    const data = distances.map(d => {
        const secPer100 = timeToSeconds(d.pace);
        if (secPer100 <= 0) return null;
        const totalTime = secPer100 * (d.dist / 100);
        return { t: totalTime, dist: d.dist };
    }).filter(Boolean);

    if (data.length < 2) return null;

    const n = data.length;
    const sumT = data.reduce((s, d) => s + d.t, 0);
    const sumD = data.reduce((s, d) => s + d.dist, 0);
    const sumTD = data.reduce((s, d) => s + d.t * d.dist, 0);
    const sumTT = data.reduce((s, d) => s + d.t * d.t, 0);

    const denom = n * sumTT - sumT * sumT;
    if (Math.abs(denom) < 1e-9) return null;

    const css = (n * sumTD - sumT * sumD) / denom; // m/s
    const d_prime = (sumD - css * sumT) / n;

    return { css, d_prime };
}
