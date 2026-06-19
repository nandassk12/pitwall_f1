import API_BASE from '../config';

// Module-level cache — fetched once per session load
let _colorCache = null;

// Static fallback — used before session loads
const FALLBACK_COLORS = {
  "Red Bull Racing":  "#3671C6",
  "Ferrari":          "#E8002D",
  "Mercedes":         "#27F4D2",
  "McLaren":          "#FF8000",
  "Aston Martin":     "#229971",
  "Alpine":           "#FF87BC",
  "Williams":         "#64C4FF",
  "AlphaTauri":       "#6692FF",
  "Alfa Romeo":       "#C92D4B",
  "Haas F1 Team":     "#B6BABD",
  "RB":               "#6692FF",
  "Kick Sauber":      "#52E252",
  "Sauber":           "#52E252",
};

export async function loadTeamColors() {
  try {
    const res = await fetch(`${API_BASE}/api/team-colors`);
    if (res.ok) {
      _colorCache = await res.json();
    }
  } catch (e) {
    console.warn('[TeamColors] Failed to load, using fallback:', e);
  }
}

export function getTeamColor(teamName) {
  if (!teamName) return '#888899';
  const map = _colorCache || FALLBACK_COLORS;

  // Best effort matching (case-insensitive substring match) just like the original map
  for (const [key, value] of Object.entries(map)) {
    if (teamName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(teamName.toLowerCase())) {
      return value;
    }
  }

  return map[teamName] ?? '#888899';
}

export function getTeamColorMap() {
  return _colorCache || FALLBACK_COLORS;
}
