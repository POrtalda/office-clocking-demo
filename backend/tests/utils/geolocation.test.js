const {
  calculateDistanceMeters,
  isGeolocationClockInEnabled,
  isValidLatitude,
  isValidLongitude,
  isValidLocation,
  toNumber,
  validateClockInLocation,
} = require("../../utils/geolocation");

describe("geolocation utils", () => {
  describe("toNumber", () => {
    test("converte stringhe numeriche in numeri", () => {
      expect(toNumber("45.123")).toBe(45.123);
    });

    test("restituisce NaN per valori vuoti", () => {
      expect(Number.isNaN(toNumber(""))).toBe(true);
      expect(Number.isNaN(toNumber(null))).toBe(true);
      expect(Number.isNaN(toNumber(undefined))).toBe(true);
    });
  });

  describe("isGeolocationClockInEnabled", () => {
    const originalEnv = process.env.GEOLOCATION_CLOCK_IN_ENABLED;

    afterEach(() => {
      process.env.GEOLOCATION_CLOCK_IN_ENABLED = originalEnv;
    });

    test("restituisce true solo se GEOLOCATION_CLOCK_IN_ENABLED è true", () => {
      process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
      expect(isGeolocationClockInEnabled()).toBe(true);

      process.env.GEOLOCATION_CLOCK_IN_ENABLED = "false";
      expect(isGeolocationClockInEnabled()).toBe(false);
    });
  });

  describe("isValidLatitude", () => {
    test("accetta latitudini valide", () => {
      expect(isValidLatitude(45)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
    });

    test("rifiuta latitudini non valide", () => {
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(NaN)).toBe(false);
    });
  });

  describe("isValidLongitude", () => {
    test("accetta longitudini valide", () => {
      expect(isValidLongitude(7)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
    });

    test("rifiuta longitudini non valide", () => {
      expect(isValidLongitude(-181)).toBe(false);
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(NaN)).toBe(false);
    });
  });

  describe("isValidLocation", () => {
    test("accetta coordinate valide anche come stringhe", () => {
      expect(
        isValidLocation({
          latitude: "45.123",
          longitude: "7.123",
        })
      ).toBe(true);
    });

    test("rifiuta coordinate mancanti o fuori range", () => {
      expect(
        isValidLocation({
          latitude: "",
          longitude: "7.123",
        })
      ).toBe(false);

      expect(
        isValidLocation({
          latitude: "45.123",
          longitude: "200",
        })
      ).toBe(false);
    });
  });

  describe("calculateDistanceMeters", () => {
    test("calcola 0 metri tra due punti uguali", () => {
      expect(calculateDistanceMeters(45, 7, 45, 7)).toBeCloseTo(0, 5);
    });

    test("calcola una distanza maggiore di 0 tra due punti diversi", () => {
      const distance = calculateDistanceMeters(45, 7, 45.001, 7.001);

      expect(distance).toBeGreaterThan(0);
    });
  });

  describe("validateClockInLocation", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    test("consente il clock-in se il controllo geolocalizzazione è disattivato", () => {
      process.env.GEOLOCATION_CLOCK_IN_ENABLED = "false";

      expect(validateClockInLocation()).toEqual({
        allowed: true,
        enabled: false,
        code: "LOCATION_CHECK_DISABLED",
      });
    });

    test("rifiuta coordinate utente non valide se il controllo è attivo", () => {
      process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";

      const result = validateClockInLocation({
        latitude: "",
        longitude: "7.123",
      });

      expect(result).toEqual({
        allowed: false,
        enabled: true,
        code: "INVALID_LOCATION",
      });
    });

    test("rifiuta se la configurazione ufficio non è valida", () => {
      process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
      process.env.OFFICE_LAT = "";
      process.env.OFFICE_LNG = "";
      process.env.OFFICE_RADIUS_METERS = "150";

      const result = validateClockInLocation({
        latitude: "45.123",
        longitude: "7.123",
      });

      expect(result).toEqual({
        allowed: false,
        enabled: true,
        code: "LOCATION_CONFIG_ERROR",
      });
    });

    test("consente il clock-in se l'utente è dentro il raggio configurato", () => {
      process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
      process.env.OFFICE_LAT = "45";
      process.env.OFFICE_LNG = "7";
      process.env.OFFICE_RADIUS_METERS = "150";

      const result = validateClockInLocation({
        latitude: "45",
        longitude: "7",
        accuracy: "20",
      });

      expect(result.allowed).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.code).toBe("LOCATION_VALID");
      expect(result.distanceMeters).toBe(0);
      expect(result.radiusMeters).toBe(150);
      expect(result.accuracy).toBe(20);
    });

    test("rifiuta il clock-in se l'utente è fuori dal raggio configurato", () => {
      process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
      process.env.OFFICE_LAT = "45";
      process.env.OFFICE_LNG = "7";
      process.env.OFFICE_RADIUS_METERS = "50";

      const result = validateClockInLocation({
        latitude: "45.01",
        longitude: "7.01",
      });

      expect(result.allowed).toBe(false);
      expect(result.enabled).toBe(true);
      expect(result.code).toBe("LOCATION_OUT_OF_RANGE");
      expect(result.distanceMeters).toBeGreaterThan(50);
      expect(result.radiusMeters).toBe(50);
    });
  });
});