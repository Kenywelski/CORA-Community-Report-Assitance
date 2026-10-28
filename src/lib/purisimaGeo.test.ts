import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PURISIMA_COORDINATES,
  PURISIMA_CENTER,
  PURISIMA_INFO,
  VERIFIED_PURISIMA_BOUNDARY,
  getOpenStreetMapNodeUrl,
  getOpenStreetMapLargerUrl,
  isValidBoundaryGeoJSON,
  getBoundaryBounds,
  verifyPointWithinBarangayBoundary,
  type VerifiedBoundaryMetadata,
} from './purisimaGeo';

test('PURISIMA_COORDINATES matches verified OpenStreetMap node 8928665117 in Tago, Surigao del Sur', () => {
  assert.equal(PURISIMA_COORDINATES.lat, 9.0178894);
  assert.equal(PURISIMA_COORDINATES.lng, 126.2335553);
  assert.deepEqual(PURISIMA_CENTER, [9.0178894, 126.2335553]);
  assert.equal(PURISIMA_INFO.barangay, 'Barangay Purisima');
  assert.equal(PURISIMA_INFO.municipality, 'Tago');
  assert.equal(PURISIMA_INFO.province, 'Surigao del Sur');
  assert.equal(PURISIMA_INFO.country, 'Philippines');
  assert.equal(PURISIMA_INFO.markerPopupText, 'Barangay Purisima, Tago, Surigao del Sur');
});

test('OpenStreetMap URL helpers generate valid links for Barangay Purisima', () => {
  const nodeUrl = getOpenStreetMapNodeUrl();
  assert.ok(nodeUrl.includes('openstreetmap.org/node/8928665117'));
  assert.ok(nodeUrl.includes('9.01789/126.23356'));

  const largerUrl = getOpenStreetMapLargerUrl(16);
  assert.ok(largerUrl.includes('mlat=9.0178894'));
  assert.ok(largerUrl.includes('mlon=126.2335553'));
});

test('VERIFIED_PURISIMA_BOUNDARY defaults to null so no fabricated polygon is shown', () => {
  assert.equal(VERIFIED_PURISIMA_BOUNDARY, null);
  const check = verifyPointWithinBarangayBoundary(PURISIMA_COORDINATES);
  assert.equal(check.hasVerifiedBoundary, false);
  assert.equal(check.isInside, null);
});

test('isValidBoundaryGeoJSON and verifyPointWithinBarangayBoundary work with a valid GeoJSON polygon', () => {
  const sampleBoundary: VerifiedBoundaryMetadata = {
    name: 'Barangay Purisima',
    municipality: 'Tago',
    province: 'Surigao del Sur',
    country: 'Philippines',
    source: 'NAMRIA / PSA PSGC 1606818018',
    verifiedAt: '2026-10-01',
    psgcCode: '1606818018',
    geojson: {
      type: 'Feature',
      properties: { name: 'Purisima' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [126.225, 9.010],
            [126.240, 9.010],
            [126.240, 9.025],
            [126.225, 9.025],
            [126.225, 9.010],
          ],
        ],
      },
    },
  };

  assert.equal(isValidBoundaryGeoJSON(sampleBoundary.geojson), true);
  assert.equal(isValidBoundaryGeoJSON({ type: 'Point', coordinates: [126.2335553, 9.0178894] }), false);

  const bounds = getBoundaryBounds(sampleBoundary.geojson);
  assert.deepEqual(bounds, [
    [9.010, 126.225],
    [9.025, 126.240],
  ]);

  const insideCheck = verifyPointWithinBarangayBoundary(PURISIMA_COORDINATES, sampleBoundary);
  assert.equal(insideCheck.hasVerifiedBoundary, true);
  assert.equal(insideCheck.isInside, true);

  const outsideCheck = verifyPointWithinBarangayBoundary({ lat: 9.10, lng: 126.50 }, sampleBoundary);
  assert.equal(outsideCheck.hasVerifiedBoundary, true);
  assert.equal(outsideCheck.isInside, false);
});
