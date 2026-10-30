export function earthPoint(value: any): { type: 'Point'; coordinates: [number, number] } | null {
  if (!value || typeof value !== 'object') return null;
  const { latitude, longitude, globe } = value;
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (globe && !['earth', 'Q2', 'http://www.wikidata.org/entity/Q2', 'https://www.wikidata.org/entity/Q2'].includes(globe)) return null;
  return { type: 'Point', coordinates: [longitude, latitude] };
}

/** Only structured coordinate values with a coordinate datatype are spatial data. */
export function attributeEarthPoint(value: any, datatype = ''): ReturnType<typeof earthPoint> {
  return ['globe-coordinate', 'globecoordinate'].includes(datatype.toLowerCase()) ? earthPoint(value) : null;
}
