import type { FeatureCollection, Polygon } from 'geojson';

/**
 * Official Barangay Purisima (Pob.), Tago boundary supplied from the
 * Philippine administrative boundary dataset (PSGC 1606818018).
 */
export const PURISIMA_BOUNDARY_GEOJSON: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [126.21489920200008, 9.024555006000071],
            [126.2353713440001, 9.013927434000038],
            [126.23663900200006, 9.02189379300006],
            [126.2246126440001, 9.034314559000052],
            [126.21489920200008, 9.024555006000071],
          ],
        ],
      },
      properties: {
        ADM4_EN: 'Purisima (Pob.)',
        ADM4_PCODE: 'PH1606818018',
        ADM4_REF: null,
        ADM3_EN: 'Tago',
        ADM3_PCODE: 'PH1606818',
        ADM2_EN: 'Surigao del Sur',
        ADM2_PCODE: 'PH16068',
        ADM1_EN: 'Region XIII (Caraga)',
        ADM1_PCODE: 'PH16',
        ADM0_EN: 'Philippines (the)',
        ADM0_PCODE: 'PH',
        date: '2022-11-09',
        validOn: '2023-11-06',
        validTo: null,
        Shape_Leng: 0.0788147686594,
        Shape_Area: 0.000221508260121,
        AREA_SQKM: 2.69370080651,
        psgc_id: 'PH1606818018',
        psgc_code: '1606818018',
        psgc_name: 'Purisima',
        psgc_status: 'matched',
        match_confidence: 1,
        psgc_type: 'barangay',
        match_method: 'exact',
        sga_member: false,
      },
    },
  ],
};

