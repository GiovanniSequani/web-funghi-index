import type { StyleSpecification } from 'maplibre-gl';

export const PLACE_LABEL_LAYER_ID = 'esri-places-layer';

export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri, DigitalGlobe, GeoEye',
    },
    'esri-places': {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri',
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
    },
    {
      id: PLACE_LABEL_LAYER_ID,
      type: 'raster',
      source: 'esri-places',
    },
  ],
};
