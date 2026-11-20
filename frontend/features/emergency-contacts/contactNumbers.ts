export const parseEmergencyContactNumbers = (value: string): string[] =>
  value.split(/[,;\n]+/).map((number) => number.trim()).filter(Boolean);

export const emergencyContactTelHref = (number: string): string =>
  `tel:${number.replace(/[^0-9+]/g, '')}`;
