const COOKIE_DAYS = 7;
const METERS_IN_KM = 1000;
const DEFAULT_RADIUS = 600; // km
const MAP_ZOOM = 6;
const NAME_MAX_CHAR = 25; // change in database rules also

// User variables
var userId;
var userName;
var userLocation;

// Firebase variables
var userRef;
var geoFire;
var geoFireRef;
var geoQuery;

// Map variables
var oms;
var map;
var mapMarkers = [];
var mapInfoWindows = [];

firebase.initializeApp(firebaseConfig);

window.onload = function() { 
  if ("geolocation" in navigator)
    setTimeout(init, 500);
  else
    log('Your browser does not support geolocation. Try Chrome or Firefox.');
};

function init() {

  var name = getOrAskForName();
  if(!name) {
    log('You must enter a name. <a href="javascript:init()">Try again</a>');
    return;
  }
  log(sprintf('Welcome %s!', htmlentities(name)));

  // Check if user id cookie exists
  // If it does, we'll use that id for firebase reference
  if(readCookie('_userId')) 
    userRef = firebase.database().ref('users').child(readCookie('_userId'));

  // If user has a user node already
  // Just use the existing node and update name
  if(userRef) {
    userRef.update({
      name: name
    });
  }
  else {
    // Create a new user node with the given name
    userRef = firebase.database().ref('users').push({
      name: name
    });
    createCookie('_userId', userRef.key, COOKIE_DAYS);
  }

  userId = userRef.key;
  geoFireRef = firebase.database().ref().child('_geofire/users');
  geoFire = new GeoFire(geoFireRef);

  getLocation().then(function(coords) {
    log(sprintf('Your coordinates are: %f, %f', coords.latitude, coords.longitude));
    userLocation = [coords.latitude, coords.longitude];
    initMap(coords);
    saveLocation(userId, coords);
  }).catch(function(err) {
    switch(err.code) {
      case 1: log('You\'ll need to allow Geolocation access in order to use this site.'); break;
      case 2: log('Geolocation is unavailable right now. Try again later.'); break;
      case 3: log('Geolocation timed out. Try again later.'); break;
      default: log('Geolocation Error Message: ' + err.message);
    }
  });
}

function getOrAskForName(changeName) {
  changeName = changeName || false;
  var name = readCookie('_userName');
  if(!name || changeName || name.length > NAME_MAX_CHAR) {
    var msg = changeName ? 'Enter a new name. Page will be reloaded.' : 'Enter your name: ';
    name = prompt(msg);
    if(!name)
      return false;
    else if(name.length > NAME_MAX_CHAR) {
      alert(sprintf('Name cannot be greater than %i chars', NAME_MAX_CHAR));
      return false;
    }
    createCookie('_userName', name, COOKIE_DAYS);
  }
  userName = name;
  show('changeName', true);
  return name;
}

function changeName() {
  // if user changed name update it in their node
  // and reload the page
  var name = getOrAskForName(true);
  if(name) {
    log('Updating name...');
    userRef.update({
      name: name
    }).then(function() {
      log('Reloading...');
      window.location.reload(true);
    }).catch(function(err) {
      log('Unable to change name: ' + err);
    });
  }
}

function getLocation() {
  showLoading();
  log('Getting location via HTML5 Geolocation API...');
  return new Promise(function(resolve, reject) {
    navigator.geolocation.getCurrentPosition(function(position) {
      resolve(position.coords); 
      hideLoading();
    }, function(err) {
      reject(err);
      hideLoading();
    });
  });
}

function saveLocation(userId, coords) {
  var location = [coords.latitude, coords.longitude];
  return geoFire.set(userId, location).then(function() {
    log('Added/updated your Geofire location in Firebase');
    geoQueryStart(location, DEFAULT_RADIUS);
  }).catch(function(err) {
    log('Could not add/update location: ' + err);
  });
}

function geoQueryStart(location, radius) {
  log(sprintf('Starting GeoQuery (realtime): Users within %.2f km radius', radius));
  geoQuery = geoFire.query({
   center: location,
   radius: radius
  });
  geoQuery.on("key_entered", geoOnKeyEnteredOrMoved);
  geoQuery.on("key_moved", geoOnKeyEnteredOrMoved);
  geoQuery.on("key_exited", geoOnKeyExited);
}

function geoQueryUpdate(critera) {
  log(sprintf('Updating GeoQuery with radius %.2f km', critera.radius));
  geoQuery.updateCriteria(critera);
}

function geoQueryCancel() {
  if(!geoQuery) 
    return;
  log('Cancelling GeoQuery');
  geoQuery.cancel();
}

function geoOnKeyEnteredOrMoved(key, loc) {
  firebase.database().ref('users').child(key).once('value').then(function(snapshot) {
    // If this key is the current user, skip it
    if(key == userId) 
      return;
    var val = snapshot.val();
    var distance = getRoundedDistance(userLocation, loc);
    
    var data = {
      key: key,
      loc: {lat: loc[0], lng: loc[1] },
      title: htmlentities(val.name),
      distance: distance
    };

    if(doesMarkerExist(key)) {
      log(sprintf('User %s location changed - distance: %.4f km', htmlentities(val.name), distance));
      updateMarker(data);
    }
    else {
      log(sprintf('User %s is within your radius - distance: %.4f km', htmlentities(val.name), distance));
      addMarkerToMap(data);
    }

  });
}

function geoOnKeyExited(key, location) {
  firebase.database().ref('users').child(key).once('value').then(function(snapshot) {
    var val = snapshot.val();
    log(sprintf('User %s is no longer within your radius.', htmlentities(val.name)));
    removeMarkerFromMap(key);
  });
}