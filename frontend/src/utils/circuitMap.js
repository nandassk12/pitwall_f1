export const CIRCUIT_SVG_MAP = {
  'bahrain':           'bahrain',
  'saudi arabia':      'saudi_arabia',
  'saudi_arabia':      'saudi_arabia',
  'australia':         'australia',
  'melbourne':         'australia',
  'japan':             'japan',
  'suzuka':            'japan',
  'china':             'china',
  'shanghai':          'china',
  'miami':             'miami',
  'emilia romagna':    'imola',
  'imola':             'imola',
  'monaco':            'monaco',
  'canada':            'canada',
  'montreal':          'canada',
  'spain':             'spain',
  'barcelona':         'spain',
  'austria':           'austria',
  'spielberg':         'austria',
  'great britain':     'great_britain',
  'silverstone':       'great_britain',
  'british':           'great_britain',
  'united kingdom':    'great_britain',
  'uk':                'great_britain',
  'hungary':           'hungary',
  'hungaroring':       'hungary',
  'belgium':           'belgium',
  'spa':               'belgium',
  'netherlands':       'netherlands',
  'zandvoort':         'netherlands',
  'italy':             'italy',
  'monza':             'italy',
  'azerbaijan':        'azerbaijan',
  'baku':              'azerbaijan',
  'singapore':         'singapore',
  'united states':     'usa',
  'usa':               'usa',
  'cota':              'usa',
  'mexico':            'mexico',
  'brazil':            'brazil',
  'interlagos':        'brazil',
  'sao paulo':         'brazil',
  'las vegas':         'las_vegas',
  'qatar':             'qatar',
  'lusail':            'qatar',
  'abu dhabi':         'abu_dhabi',
  'yas marina':        'abu_dhabi',
  'united arab emirates': 'abu_dhabi',
  'uae':               'abu_dhabi',
  'madrid':            'madrid',
  'florida':           'miami',
  'saudi':             'saudi_arabia',
  'mexico city':       'mexico',
  'brasil':            'brazil',
  'las vegas strip':   'las_vegas',
};

export function resolveCircuitId(country = '', venue = '') {
  // Try combined string first, then country alone, then venue alone
  const candidates = [
    `${country} ${venue}`.toLowerCase().trim(),
    country.toLowerCase().trim(),
    venue.toLowerCase().trim(),
  ];
  for (const search of candidates) {
    for (const [key, id] of Object.entries(CIRCUIT_SVG_MAP)) {
      if (search.includes(key)) return id;
    }
  }
  return null;
}

export async function fetchCircuitSvg(circuitId) {
  if (!circuitId) return null;
  try {
    const res = await fetch(`/circuits/${circuitId}.svg`);
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } catch {
    return null;
  }
}

export function injectCircuitStyles(svgText, options = {}) {
  const {
    strokeColor = '#e10600',
    strokeWidth = '3',
    backgroundColor = 'transparent',
    width = '100%',
    height = '100%',
  } = options;

  return svgText
    .replace(/stroke="[^"]*"/g, `stroke="${strokeColor}"`)
    .replace(/stroke:[^;"}]*/g, `stroke:${strokeColor}`)
    .replace(/fill="(?!none)[^"]*"/g, 'fill="none"')
    .replace(/fill:(?!none)[^;"}]*/g, 'fill:none')
    .replace(/stroke-width="[^"]*"/g, `stroke-width="${strokeWidth}"`)
    .replace(
      /<svg/,
      `<svg style="width:${width};height:${height};background:${backgroundColor};display:block"`
    );
}
