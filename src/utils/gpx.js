/**
 * Calculate Haversine distance between two GPS points.
 */
export function haversine(p1, p2) {
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function gradeFromEle(ele1, ele2, dist) {
    if (dist < 1) return 0;
    return ((ele2 - ele1) / dist) * 100;
}

function smoothGrades(grades, windowSize) {
    const half = Math.floor(windowSize / 2);
    return grades.map((_, i) => {
        let sum = 0, count = 0;
        for (let j = Math.max(1, i - half); j <= Math.min(grades.length - 1, i + half); j++) {
            sum += grades[j]; count++;
        }
        return count > 0 ? sum / count : grades[i];
    });
}

/**
 * Parse a GPX XML string and extract track points.
 */
export function parseGPX(xmlString) {
    if (!xmlString || !xmlString.includes('<gpx')) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    if (doc.querySelector('parsererror')) return null;

    const pts = Array.from(doc.getElementsByTagName('trkpt')).map(pt => {
        const lat = Number(pt.getAttribute('lat'));
        const lon = Number(pt.getAttribute('lon'));
        const eleNode = pt.getElementsByTagName('ele')[0];
        const ele = eleNode ? Number(eleNode.textContent) : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(ele)) return null;
        return { lat, lon, ele };
    }).filter(Boolean);

    return pts.length >= 2 ? pts : null;
}

/**
 * Analyze a GPX track: compute distances, profile, detect climbs/descents.
 */
export function analyzeProfile(points) {
    if (!points || points.length < 2) return null;

    // Compute cumulative distances and elevations
    const distances = [0];
    const elevations = [points[0].ele];
    for (let i = 1; i < points.length; i++) {
        const d = haversine(points[i - 1], points[i]);
        distances.push(distances[i - 1] + d);
        elevations.push(points[i].ele);
    }

    // Compute per-segment grades
    const rawGrades = distances.map((_, i) => {
        if (i === 0) return 0;
        return gradeFromEle(elevations[i - 1], elevations[i], distances[i] - distances[i - 1]);
    });

    const smoothed = smoothGrades(rawGrades, 25);

    const MIN_SEGMENT_LENGTH = 400;
    const CLIMB_THRESHOLD = 4;
    const DESCENT_THRESHOLD = -4;
    const CLIMB_SOFT = CLIMB_THRESHOLD + 0.6;
    const DESCENT_SOFT = DESCENT_THRESHOLD - 0.6;

    // Detect climbs
    const detectSegments = (grades, enterThreshold, sustainThreshold, isClimb) => {
        const segments = [];
        let seg = { start: null, end: null, distance: 0, elevation: 0 };
        let buf = { start: null, distance: 0, elevation: 0 };
        const GAP = 400;

        for (let i = 1; i < distances.length; i++) {
            const d = distances[i] - distances[i - 1];
            const eleDiff = elevations[i] - elevations[i - 1];
            const g = grades[i];
            const enter = isClimb ? g >= enterThreshold : g <= enterThreshold;
            const sustain = isClimb ? g >= sustainThreshold : g <= sustainThreshold;

            if (seg.start === null) {
                if (enter) { seg.start = i - 1; seg.end = i; seg.distance += d; seg.elevation += eleDiff; }
                continue;
            }

            if (sustain) {
                if (buf.distance > 0) {
                    seg.distance += buf.distance; seg.elevation += buf.elevation;
                    buf = { start: null, distance: 0, elevation: 0 };
                }
                seg.end = i; seg.distance += d; seg.elevation += eleDiff;
            } else {
                if (buf.start === null) buf.start = i - 1;
                buf.distance += d; buf.elevation += eleDiff;
                if (buf.distance > GAP) {
                    if (seg.end !== null) segments.push({ ...seg });
                    seg = { start: null, end: null, distance: 0, elevation: 0 };
                    buf = { start: null, distance: 0, elevation: 0 };
                }
            }
        }
        if (seg.start !== null) segments.push({ ...seg });
        return segments;
    };

    const climbSegs = detectSegments(smoothed, CLIMB_SOFT, CLIMB_THRESHOLD - 1, true);
    const descentSegs = detectSegments(smoothed, DESCENT_SOFT, DESCENT_THRESHOLD + 1, false);

    // Build climb/descent data
    const buildSegmentData = (segs, isClimb) => {
        return segs
            .filter(s => s.start !== null && s.end !== null && Math.abs(s.distance) >= MIN_SEGMENT_LENGTH)
            .map(s => {
                const perSegGrades = [];
                for (let i = s.start + 1; i <= s.end; i++) {
                    const dd = distances[i] - distances[i - 1];
                    if (dd >= 5) perSegGrades.push(gradeFromEle(elevations[i - 1], elevations[i], dd));
                }
                const avg = perSegGrades.length ? perSegGrades.reduce((a, b) => a + b, 0) / perSegGrades.length : 0;
                const difficulty = avg * avg * (s.distance / 1000) * Math.abs(s.elevation);
                return {
                    startKm: distances[s.start] / 1000,
                    endKm: distances[s.end] / 1000,
                    distanceM: distances[s.end] - distances[s.start],
                    dPlus: isClimb ? Math.abs(s.elevation) : null,
                    dMinus: !isClimb ? Math.abs(s.elevation) : null,
                    avgGrade: avg,
                    difficulty,
                    type: isClimb ? 'Montée' : 'Descente'
                };
            })
            .filter(s => isClimb ? (s.dPlus > 10) : (s.dMinus > Math.abs(DESCENT_THRESHOLD)));
    };

    const climbs = buildSegmentData(climbSegs, true);
    const descents = buildSegmentData(descentSegs, false);

    // Build profile data with slope type per point (climb/flat/descent)
    const FLAT_THRESHOLD = 2; // ±2% = flat
    const profile = distances.map((d, i) => {
        const grade = smoothed[i] || 0;
        let slopeType;
        if (grade > FLAT_THRESHOLD) slopeType = 'climb';
        else if (grade < -FLAT_THRESHOLD) slopeType = 'descent';
        else slopeType = 'flat';
        return { distanceKm: d / 1000, elevation: elevations[i], grade, slopeType };
    });

    // Build separate elevation series for coloring
    // Each point gets elevation in the matching key, null in others
    const coloredProfile = profile.map(p => ({
        distanceKm: p.distanceKm,
        elevation: p.elevation,
        climb: p.slopeType === 'climb' ? p.elevation : null,
        flat: p.slopeType === 'flat' ? p.elevation : null,
        descent: p.slopeType === 'descent' ? p.elevation : null,
        slopeType: p.slopeType,
    }));

    // Fill gaps so colored areas connect properly
    for (let i = 1; i < coloredProfile.length; i++) {
        const prev = coloredProfile[i - 1];
        const curr = coloredProfile[i];
        // Bridge: when type changes, set boundary point elevation on both sides
        if (prev.slopeType !== curr.slopeType) {
            if (prev.slopeType === 'climb') curr.climb = curr.elevation;
            else if (prev.slopeType === 'flat') curr.flat = curr.elevation;
            else if (prev.slopeType === 'descent') curr.descent = curr.elevation;
        }
    }

    // Stats
    const totalDistanceKm = distances[distances.length - 1] / 1000;

    // Compute real D+ from raw elevation data (sum of all positive elevation changes)
    let realDplus = 0;
    let realDminus = 0;
    for (let i = 1; i < elevations.length; i++) {
        const diff = elevations[i] - elevations[i - 1];
        if (diff > 0) realDplus += diff;
        else realDminus += Math.abs(diff);
    }
    const totalDplus = realDplus;
    const dplusPerKm = totalDistanceKm > 0 ? totalDplus / totalDistanceKm : 0;

    // D+ distribution by grade (using smoothed grades)
    const gradeBuckets = [
        { label: '0-5%', min: 0, max: 5, dplus: 0, distance: 0 },
        { label: '5-10%', min: 5, max: 10, dplus: 0, distance: 0 },
        { label: '10-15%', min: 10, max: 15, dplus: 0, distance: 0 },
        { label: '15-20%', min: 15, max: 20, dplus: 0, distance: 0 },
        { label: '>20%', min: 20, max: Infinity, dplus: 0, distance: 0 },
    ];
    for (let i = 1; i < distances.length; i++) {
        const diff = elevations[i] - elevations[i - 1];
        if (diff <= 0) continue; // only positive elevation
        const grade = Math.abs(smoothed[i] || 0);
        const segDist = distances[i] - distances[i - 1];
        for (const bucket of gradeBuckets) {
            if (grade >= bucket.min && grade < bucket.max) {
                bucket.dplus += diff;
                bucket.distance += segDist;
                break;
            }
        }
    }
    const dplusByGrade = gradeBuckets.map(b => ({
        label: b.label,
        dplus: Math.round(b.dplus),
        distance: Math.round(b.distance),
        pct: totalDplus > 0 ? ((b.dplus / totalDplus) * 100).toFixed(1) : '0',
    }));

    // Major climbs (>100m D+) for chart labels
    const majorClimbs = climbs
        .filter(c => (c.dPlus ?? 0) >= 100)
        .map(c => ({
            startKm: c.startKm,
            endKm: c.endKm,
            midKm: (c.startKm + c.endKm) / 2,
            dPlus: c.dPlus,
            avgGrade: c.avgGrade,
        }));

    // Weighted average grade
    const totalWeight = climbs.reduce((s, c) => s + c.difficulty * c.distanceM * (c.dPlus ?? 0), 0);
    const globalGrade = totalWeight > 0
        ? climbs.reduce((s, c) => s + c.avgGrade * c.difficulty * c.distanceM * (c.dPlus ?? 0), 0) / totalWeight
        : 0;

    const topClimbs = [...climbs].sort((a, b) => b.difficulty - a.difficulty).slice(0, 5);
    const topDescents = [...descents].sort((a, b) => b.difficulty - a.difficulty).slice(0, 5);
    const toughestClimb = climbs.length ? climbs.reduce((a, b) => b.difficulty > a.difficulty ? b : a) : null;
    const toughestDescent = descents.length ? descents.reduce((a, b) => b.difficulty > a.difficulty ? b : a) : null;

    return {
        profile,
        coloredProfile,
        climbs,
        descents,
        majorClimbs,
        dplusByGrade,
        stats: { totalDistanceKm, totalDplus, totalDminus: realDminus, dplusPerKm, globalGrade },
        topClimbs,
        topDescents,
        toughestClimb,
        toughestDescent
    };
}
