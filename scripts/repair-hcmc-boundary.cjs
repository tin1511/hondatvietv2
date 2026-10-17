const fs = require('node:fs');
const path = require('node:path');

const GEO_PATH = path.join(process.cwd(), 'public/data/vietnam-provinces.geojson');
const SOURCE_URL = 'https://raw.githubusercontent.com/nguyenduy1133/Free-GIS-Data/main/Vietnam%20Administrative%20Divisions%20(Post-2025)%20-%20%C4%90%C6%A1n%20v%E1%BB%8B%20h%C3%A0nh%20ch%C3%ADnh%20Vi%E1%BB%87t%20Nam%20(T%E1%BB%AB%202025)/Provinces.geojson';

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(tinh|thanh pho|tp|province|city)\s+/, '')
    .replace(/\s+(province|city)$/, '')
    .trim();
}

function getName(properties = {}) {
  const raw = properties.TinhThanh || properties.tinh_thanh || properties.vietnameseName ||
    properties.Name || properties.name || properties.Ten_Tinh || properties.TEN_TINH ||
    properties.TenTinh || properties.tenTinh || properties.ten_tinh || properties.province_name ||
    properties.PROV_NAME || properties.name_vi || properties.province || properties.Province ||
    properties.NAME_1 || properties.NAME_2 || properties.NAME;
  return String(raw ?? '').replace(/\([^)]*\)/g, '').trim();
}

function collectPoints(value, points = []) {
  if (Array.isArray(value) && value.length >= 2 &&
      typeof value[0] === 'number' && typeof value[1] === 'number') {
    points.push(value);
  } else if (Array.isArray(value)) {
    value.forEach(item => collectPoints(item, points));
  }
  return points;
}

function validGeometry(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return false;
  const points = collectPoints(geometry.coordinates);
  return points.length >= 10 && points.every(([lng, lat]) =>
    Number.isFinite(lng) && Number.isFinite(lat) &&
    lng >= 90 && lng <= 140 && lat >= -5 && lat <= 40
  );
}

async function main() {
  const local = JSON.parse(fs.readFileSync(GEO_PATH, 'utf8'));
  if (local?.type !== 'FeatureCollection' || !Array.isArray(local.features)) {
    throw new Error('Local boundary asset is not a GeoJSON FeatureCollection.');
  }

  const localFeature = local.features.find(feature =>
    normalizeName(getName(feature?.properties)) === 'ho chi minh'
  );
  if (!localFeature) throw new Error('Could not find the Hồ Chí Minh feature in the local asset.');

  if (validGeometry(localFeature.geometry)) {
    console.log('[map-data-repair] PASS: Hồ Chí Minh already has a non-placeholder polygon; no change needed.');
    return;
  }

  console.log('[map-data-repair] Invalid placeholder geometry detected for Hồ Chí Minh; retrieving current boundary source.');
  const response = await fetch(SOURCE_URL, {
    headers: { Accept: 'application/geo+json, application/json' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('Boundary source returned HTTP ' + response.status + '.');

  const source = await response.json();
  if (source?.type !== 'FeatureCollection' || !Array.isArray(source.features)) {
    throw new Error('Remote boundary source is not a GeoJSON FeatureCollection.');
  }

  const candidates = source.features.filter(feature =>
    normalizeName(getName(feature?.properties)) === 'ho chi minh' &&
    validGeometry(feature?.geometry)
  );
  if (candidates.length !== 1) {
    const available = source.features.map(feature => getName(feature?.properties)).filter(Boolean);
    throw new Error('Expected exactly one valid Hồ Chí Minh boundary; found ' + candidates.length +
      '. Source names: ' + available.join(', '));
  }

  // Replace geometry only; preserve the app's local canonical properties and data schema.
  localFeature.geometry = candidates[0].geometry;
  if (!validGeometry(localFeature.geometry)) {
    throw new Error('Downloaded Hồ Chí Minh geometry failed validation.');
  }

  const temporaryPath = GEO_PATH + '.tmp';
  fs.writeFileSync(temporaryPath, JSON.stringify(local, null, 2) + '\n', 'utf8');
  fs.renameSync(temporaryPath, GEO_PATH);
  console.log('[map-data-repair] PASS: replaced only the invalid Hồ Chí Minh placeholder with validated boundary geometry.');
}

main().catch(error => {
  console.error('[map-data-repair] FAIL: ' + (error?.message || String(error)));
  process.exitCode = 1;
});
