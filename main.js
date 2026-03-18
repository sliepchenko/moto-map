import { initMap } from './src/mapController.js';

const GOOGLE_MAPS_API_KEY = 'AIzaSyD_XkQAhqeRRkLct-LBdcwP5QfIMvU0B4I';

const mapWrapper = await initMap(GOOGLE_MAPS_API_KEY);

mapWrapper.on('load', () => {
  console.log('Moto Map ready — centred on Zagreb.');
});
