const fs = require('node:fs');
const path = require('node:path');

const geoPath = path.join(process.cwd(), 'public/data/vietnam-provinces.geojson');
const unitsPath = path.join(process.cwd(), 'src/data/administrativeUnits.ts');

function fail(message) {
  console.error('[map-data] FAIL: ' + message);
  process.exitCode = 1;
}

function normalizeName(value) {
  return String(value ?? '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .replace(/^(tỉnh|thành phố|tp\.?|province|city)\s+/i, '')
    .toLocaleLowerCase('vi');
}

function getProvinceName(properties = {}) {
  const raw = properties.TinhThanh || properties.tinh_thanh || properties.vietnameseName ||
    properties.Name || properties.name || properties.Ten_Tinh || properties.TEN_TINH ||
    properties.TenTinh || properties.tenTinh || properties.ten_tinh || properties.province_name ||
    properties.PROV_NAME || properties.name_vi || properties.province || properties.Province ||
    properties.NAME_1;
  return String(raw ?? '').replace(/\([^)]*\)/g, '').trim()
    .replace(/^(tỉnh|thành phố|tp\.?)\s+/i, '');
}

function collectCoordinates(value, points = []) {
  if (Array.isArray(value) && value.length >= 2 &&
      typeof value[0] === 'number' && typeof value[1] === 'number') {
    points.push(value);
  } else if (Array.isArray(value)) {
    value.forEach(item => collectCoordinates(item, points));
  }
  return points;
}

function main() {
  if (!fs.existsSync(geoPath)) {
    fail('Missing boundary asset: ' + geoPath);
    return;
  }

  const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
  if (geo?.type !== 'FeatureCollection' || !Array.isArray(geo.features)) {
    fail('Boundary file is not a GeoJSON FeatureCollection.');
    return;
  }

  const unitsSource = fs.readFileSync(unitsPath, 'utf8');
  const listStart = unitsSource.indexOf('const POST_2025_PROVINCES');
  const listEnd = unitsSource.indexOf('\n];', listStart);
  if (listStart < 0 || listEnd < 0) {
    fail('Could not parse POST_2025_PROVINCES in administrativeUnits.ts.');
    return;
  }
  const expectedNames = [...unitsSource.slice(listStart, listEnd).matchAll(/shortName:\s*'([^']+)'/g)]
    .map(match => match[1]);
  if (expectedNames.length !== 34 || new Set(expectedNames.map(normalizeName)).size !== 34) {
    fail('Expected 34 unique official names in source, found ' + expectedNames.length + '.');
    return;
  }

  const expected = new Set(expectedNames.map(normalizeName));
  const valid = [];
  const invalid = [];

  for (const [index, feature] of geo.features.entries()) {
    const name = getProvinceName(feature?.properties);
    const points = collectCoordinates(feature?.geometry?.coordinates);
    const geometryTypeValid = ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type);
    const coordinatesValid = points.length >= 10 && points.every(([lng, lat]) =>
      Number.isFinite(lng) && Number.isFinite(lat) &&
      lng >= 90 && lng <= 140 && lat >= -5 && lat <= 40
    );
    if (feature?.type !== 'Feature' || !name || !geometryTypeValid || !coordinatesValid) {
      invalid.push('feature #' + (index + 1) + ' (' + (name || 'unnamed') + ')');
      continue;
    }
    valid.push({ name, normalized: normalizeName(name) });
  }

  const names = valid.map(feature => feature.normalized);
  const unique = new Set(names);
  const unknown = [...unique].filter(name => !expected.has(name));
  const missing = [...expected].filter(name => !unique.has(name));

  if (geo.features.length !== 34) fail('Expected 34 features, found ' + geo.features.length + '.');
  if (invalid.length) fail('Invalid or placeholder geometries: ' + invalid.join(', ') + '.');
  if (unique.size !== 34) fail('Expected 34 distinct province names, found ' + unique.size + '.');
  if (unknown.length) fail('Unknown province names: ' + unknown.join(', ') + '.');
  if (missing.length) fail('Missing official province names: ' + missing.join(', ') + '.');

  if (process.exitCode) return;
  console.log('[map-data] PASS: GeoJSON has 34 distinct current provincial units with valid polygon geometry.');
  console.log('[map-data] PASS: all names match POST_2025_PROVINCES in administrativeUnits.ts.');
}

main();
