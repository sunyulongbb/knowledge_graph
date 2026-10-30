"""Build local SVG XYZ tiles from Natural Earth; Python standard library only.

Sources: nvkelso/natural-earth-vector geojson, Natural Earth 50m (public domain).
Download ne_50m_admin_0_countries and ne_50m_populated_places_simple into map-source.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'scripts' / 'map-source'
OUT = ROOT / 'public' / 'maps' / 'world'

def project(point, size):
    lon, lat = point[:2]
    lat = max(-85.05112878, min(85.05112878, lat))
    return ((lon + 180) / 360 * size,
            (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * size)

def clip(points, axis, bound, greater):
    if not points:
        return []
    result = []
    previous = points[-1]
    for point in points:
        inside = point[axis] >= bound if greater else point[axis] <= bound
        was_inside = previous[axis] >= bound if greater else previous[axis] <= bound
        if inside != was_inside:
            ratio = (bound - previous[axis]) / (point[axis] - previous[axis])
            result.append((previous[0] + ratio * (point[0] - previous[0]), previous[1] + ratio * (point[1] - previous[1])))
        if inside:
            result.append(point)
        previous = point
    return result

def clip_line(a, b, left, top, right, bottom):
    dx, dy = b[0] - a[0], b[1] - a[1]
    start, end = 0, 1
    for p, q in [(-dx, a[0]-left), (dx, right-a[0]), (-dy, a[1]-top), (dy, bottom-a[1])]:
        if p == 0:
            if q < 0:
                return None
        elif p < 0:
            start = max(start, q/p)
        else:
            end = min(end, q/p)
        if start > end:
            return None
    return (a[0]+start*dx, a[1]+start*dy), (a[0]+end*dx, a[1]+end*dy)

def build():
    countries = json.loads((SOURCE / 'ne_50m_admin_0_countries.geojson').read_text(encoding='utf8'))['features']
    cities = json.loads((SOURCE / 'ne_50m_populated_places_simple.geojson').read_text(encoding='utf8'))['features']
    localized = json.loads((SOURCE / 'ne_50m_populated_places.geojson').read_text(encoding='utf8'))['features']
    city_names = {str(feature['properties']['NE_ID']): feature['properties'].get('NAME_ZH') for feature in localized}
    country_names = {}
    for feature in countries:
        prop = feature['properties']
        for field in ['NAME', 'NAME_EN', 'ADMIN']:
            if prop.get(field):
                country_names[prop[field]] = prop.get('NAME_ZH') or prop['NAME']
    OUT.mkdir(parents=True, exist_ok=True)
    places = []
    for feature in countries:
        prop = feature['properties']
        places.append(dict(name=prop.get('NAME_ZH') or prop['NAME'], english=prop['NAME'], kind='country',
                           lon=prop['LABEL_X'], lat=prop['LABEL_Y'], zoom=prop.get('MIN_LABEL', 2), rank=prop.get('LABELRANK', 4)))
    for feature in cities:
        prop = feature['properties']
        places.append(dict(name=city_names.get(str(prop['ne_id'])) or prop['name'], english=prop.get('nameascii') or prop['name'], kind='city',
                           country=country_names.get(prop.get('adm0name'), prop.get('adm0name', '')), countryEnglish=prop.get('adm0name', ''), lon=prop['longitude'], lat=prop['latitude'],
                           zoom=prop.get('min_zoom') or 5, rank=prop.get('scalerank', 5)))
    (OUT / 'places.json').write_text(json.dumps(sorted(places, key=lambda p: (p['kind'] != 'country', p['rank'])), ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    count = 0
    for zoom in range(6):
        n = 2 ** zoom
        size = n * 256
        polygons = []
        for feature in countries:
            geo = feature['geometry']
            if not geo:
                continue
            shapes = geo['coordinates'] if geo['type'] == 'MultiPolygon' else [geo['coordinates']]
            for shape in shapes:
                rings = [[project(point, size) for point in ring] for ring in shape]
                flat = [point for ring in rings for point in ring]
                if flat:
                    polygons.append((rings, (min(p[0] for p in flat), min(p[1] for p in flat), max(p[0] for p in flat), max(p[1] for p in flat))))
        for x in range(n):
            directory = OUT / 'tiles' / str(zoom) / str(x)
            directory.mkdir(parents=True, exist_ok=True)
            for y in range(n):
                left, top, right, bottom = x * 256, y * 256, (x + 1) * 256, (y + 1) * 256
                paths = []
                for rings, bounds in polygons:
                    if bounds[2] < left or bounds[0] > right or bounds[3] < top or bounds[1] > bottom:
                        continue
                    parts = []
                    lines = []
                    for ring in rings:
                        for a, b in zip(ring, ring[1:]):
                            segment = clip_line(a, b, left-1, top-1, right+1, bottom+1)
                            if segment:
                                (ax, ay), (bx, by) = segment
                                lines.append(f'M{ax-left:.1f},{ay-top:.1f}L{bx-left:.1f},{by-top:.1f}')
                        for axis, bound, greater in [(0, left - 1, True), (0, right + 1, False), (1, top - 1, True), (1, bottom + 1, False)]:
                            ring = clip(ring, axis, bound, greater)
                        if len(ring) > 2:
                            parts.append('M' + 'L'.join(f'{px-left:.1f},{py-top:.1f}' for px, py in ring) + 'Z')
                    if parts:
                        paths.append('<path stroke="none" d="' + ''.join(parts) + '"/>')
                        if lines:
                            paths.append('<path fill="none" d="' + ''.join(lines) + '"/>')
                svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#eef3f7"/><g fill="#fafbf8" fill-rule="evenodd" stroke="#c3cdd2" stroke-width="0.55" stroke-linejoin="round">' + ''.join(paths) + '</g></svg>'
                (directory / f'{y}.svg').write_text(svg, encoding='utf8')
                count += 1
        print(f'zoom={zoom}: {n*n} tiles', flush=True)
    (OUT / 'manifest.json').write_text(json.dumps(dict(tileSize=256, minZoom=0, maxNativeZoom=5, maxZoom=9, countries=len(countries), cities=len(cities), tiles=count, source='Natural Earth 50m', attribution='Made with Natural Earth', license='Public domain'), indent=2), encoding='utf8')
    print(f'Built {count} offline tiles, {len(countries)} countries/regions and {len(cities)} cities.', flush=True)

if __name__ == '__main__':
    build()
