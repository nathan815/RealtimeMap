//////////////////////////////////////
// Functions for anything map related
//////////////////////////////////////

const MARKER_INFO_WINDOW_CONTENT = '<div class="map-info-window"> <h3>%s</h3> Latitude: %s <br> Longitude: %s <br> %s</div>';

function initMap(coords) {
  log('Initializing map centered at your location...');
  var loc = { lat: coords.latitude, lng: coords.longitude };
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: MAP_ZOOM,
    center: loc,
    mapTypeId: 'hybrid'
  });

  oms = new OverlappingMarkerSpiderfier(map, { 
    basicFormatEvents: true,
    keepSpiderfied: true
  });

  var marker = addMarkerToMap({
    key: userId,
    loc: loc, 
    title: htmlentities(userName)+' <br><span>You</span>'
  });

  drawRadius(marker);
  
  google.maps.event.addListener(map, 'click', closeInfoWindows);

}

function drawRadius(marker) {
  var circle = new google.maps.Circle({
    map: map,
    radius: RADIUS*1000, // meters
    fillColor: '#0774E0',
    fillOpacity: 0.2,
    strokeColor: '#ffffff',
    strokeWeight: 1.5
  });
  circle.bindTo('center', marker, 'position');
}

function addMarkerToMap(data) {
  var marker = new google.maps.Marker({
    animation: google.maps.Animation.DROP,
    position: data.loc,
    label: (typeof data.label !== 'undefined' ? data.label : null)
  });

  var infoWindow = new google.maps.InfoWindow({
    content: getInfoWindowContentString(data)
  });

  mapMarkers[data.key] = marker;
  mapInfoWindows[data.key] = infoWindow;

  google.maps.event.addListener(mapMarkers[data.key], 'spider_click', function(e) {  // 'spider_click', not plain 'click'
    closeInfoWindows();
    infoWindow.open(map, mapMarkers[data.key]);
  });
  oms.addMarker(mapMarkers[data.key]);

  return marker;

}

function updateMarker(data) {
  mapMarkers[data.key].setPosition(data.loc);
  mapInfoWindows[data.key].setContent(getInfoWindowContentString(data));
}

function removeMarkerFromMap(key) {
  oms.removeMarker(mapMarkers[key]);
  mapMarkers.splice(key, 1);
  mapInfoWindows.splice(key, 1);
}

function doesMarkerExist(key) {
  return key in mapMarkers;
}

function closeInfoWindows() {
  for(var index in mapInfoWindows) {
    mapInfoWindows[index].close();
  }
}

function getInfoWindowContentString(data) {
  var extra = "";
  if(data.distance)
    extra = 'Distance: ' + data.distance + ' km';
  return sprintf(MARKER_INFO_WINDOW_CONTENT, data.title, data.loc.lat, data.loc.lng, extra);
}