/**
 * utils/geolocation.js
 *
 * Utility per la validazione della posizione durante il clock-in.
 */

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }

  return Number(value);
}

function isGeolocationClockInEnabled() {
  return process.env.GEOLOCATION_CLOCK_IN_ENABLED === "true";
}

function isValidLatitude(latitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
}

function isValidLongitude(longitude) {
  return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadiusMeters = 6371000;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function isValidLocation({ latitude, longitude }) {
  const numericLatitude = toNumber(latitude);
  const numericLongitude = toNumber(longitude);

  return (
    isValidLatitude(numericLatitude) &&
    isValidLongitude(numericLongitude)
  );
}

function validateClockInLocation(location = {}) {
  if (!isGeolocationClockInEnabled()) {
    return {
      allowed: true,
      enabled: false,
      code: "LOCATION_CHECK_DISABLED",
    };
  }

  const userLatitude = toNumber(location.latitude);
  const userLongitude = toNumber(location.longitude);
  const userAccuracy = toNumber(location.accuracy);

  if (!isValidLatitude(userLatitude) || !isValidLongitude(userLongitude)) {
    return {
      allowed: false,
      enabled: true,
      code: "INVALID_LOCATION",
    };
  }

  const officeLatitude = toNumber(process.env.OFFICE_LAT);
  const officeLongitude = toNumber(process.env.OFFICE_LNG);
  const radiusMeters = toNumber(process.env.OFFICE_RADIUS_METERS);

  const hasValidOfficeConfig =
    isValidLatitude(officeLatitude) &&
    isValidLongitude(officeLongitude) &&
    Number.isFinite(radiusMeters) &&
    radiusMeters > 0;

  if (!hasValidOfficeConfig) {
    return {
      allowed: false,
      enabled: true,
      code: "LOCATION_CONFIG_ERROR",
    };
  }

  const distanceMeters = calculateDistanceMeters(
    userLatitude,
    userLongitude,
    officeLatitude,
    officeLongitude
  );

  const allowed = distanceMeters <= radiusMeters;

  return {
    allowed,
    enabled: true,
    code: allowed ? "LOCATION_VALID" : "LOCATION_OUT_OF_RANGE",
    latitude: userLatitude,
    longitude: userLongitude,
    accuracy: Number.isFinite(userAccuracy) ? userAccuracy : null,
    distanceMeters: Math.round(distanceMeters),
    radiusMeters,
  };
}

module.exports = {
  calculateDistanceMeters,
  isGeolocationClockInEnabled,
  isValidLocation,
  isValidLatitude,
  isValidLongitude,
  toNumber,
  validateClockInLocation,
};
