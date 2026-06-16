import urllib.request, json, sys

def fetch(url):
    with urllib.request.urlopen(url, timeout=8) as r:
        return json.loads(r.read())

print("=" * 55)
print("CHECK 1 + 2: /api/sim/state — gap types + positions")
print("=" * 55)
d   = fetch("http://localhost:8000/api/sim/state")
lap = d.get("lapState", [])
pos = d.get("positions", {})

for e in lap[:4]:
    gap = e.get("gap")
    print(f"  {e['driver']:4s}  gap={gap}  ({type(gap).__name__})  gapLabel={e.get('gapLabel')}")

print(f"\n  Arc cache check: {len(pos)} drivers have x/y positions")
if pos:
    sample_drv = next(iter(pos))
    sp = pos[sample_drv]
    print(f"  Sample ({sample_drv}): x={sp.get('x')}  y={sp.get('y')}")

print()
print("=" * 55)
print("CHECK 3: /api/telemetry/multi")
print("=" * 55)
url = "http://localhost:8000/api/telemetry/multi?drivers=VER&drivers=HAM&window=45"
try:
    md = fetch(url)
    if md:
        for k, v in md.items():
            spd = v.get("speed", [])
            print(f"  {k}: {len(spd)} speed points  teamColor={v.get('teamColor')}")
    else:
        print("  Response empty — drivers may not be cached for this session")
        # Try with actual session drivers
        status = fetch("http://localhost:8000/api/status")
        print(f"  Current session: {status.get('currentSession')}")
except Exception as ex:
    print(f"  ERROR: {ex}")

print()
print("=" * 55)
print("CHECK 4: /api/circuit/metadata — corner + DRS counts")
print("=" * 55)
m = fetch("http://localhost:8000/api/circuit/metadata")
if "error" in m:
    print(f"  ERROR: {m['error']}")
else:
    print(f"  totalCorners : {m['totalCorners']}")
    print(f"  DRS zones    : {len(m.get('drsZones', []))}")
    print(f"  Sectors      : {len(m.get('sectors', []))}")
    # Spot check first corner
    corners = m.get("corners", [])
    if corners:
        c = corners[0]
        print(f"  Corner 1     : x={c['x']}  y={c['y']}")
