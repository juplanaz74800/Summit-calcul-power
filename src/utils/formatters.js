/**
 * Convert "HH:MM:SS" or "MM:SS" or seconds string to total seconds.
 */
export function timeToSeconds(str) {
    if (!str || typeof str !== 'string') return 0;
    const parts = str.split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
}

/**
 * Convert pace string "MM:SS" (min/km) to speed in km/h.
 */
export function paceToSpeed(str) {
    const secs = timeToSeconds(str);
    if (secs <= 0) return 0;
    return 3600 / secs;
}

/**
 * Convert speed (km/h) to pace string "MM:SS /km".
 */
export function speedToPace(speed) {
    if (!Number.isFinite(speed) || speed <= 0) return '--:--';
    const totalSec = 3600 / speed;
    const min = Math.floor(totalSec / 60);
    const sec = Math.round(totalSec % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to "HH:MM:SS".
 */
export function formatTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.round(totalSeconds % 60);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Convert swim speed (m/s) to pace string "MM:SS /100m".
 */
export function swimSpeedToPace(speedMs) {
    if (!Number.isFinite(speedMs) || speedMs <= 0) return '--:--';
    const secPer100 = 100 / speedMs;
    const min = Math.floor(secPer100 / 60);
    const sec = Math.round(secPer100 % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}
