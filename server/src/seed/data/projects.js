import { FACT_SHEETS } from './factSheets.js';

const LAKH = 100_000;

/**
 * The two live projects from the brief: 420 apartments in all, 2 and 3 BHK,
 * ₹65 lakh to ₹1.2 crore. RERA numbers and addresses are made up but follow the
 * Gujarat RERA format. Fact sheets live in factSheets.js.
 */
export const PROJECTS = [
  {
    code: 'P1',
    name: 'Project 1',
    reraNumber: 'PR/GJ/AHMEDABAD/AHMEDABAD CITY/AUDA/RAA11842/180324',
    tagline: 'Spacious 2 and 3 BHK homes off SG Highway',
    location: {
      address: 'Near Vaishnodevi Circle, SG Highway',
      city: 'Ahmedabad',
      mapUrl: 'https://maps.google.com/?q=23.1365,72.5420',
    },
    configurations: [
      {
        bhk: 2,
        carpetAreaSqft: { min: 690, max: 760 },
        priceRange: { min: 65 * LAKH, max: 78 * LAKH },
        unitsAvailable: 31,
      },
      {
        bhk: 3,
        carpetAreaSqft: { min: 1050, max: 1240 },
        priceRange: { min: 92 * LAKH, max: 120 * LAKH },
        unitsAvailable: 52,
      },
    ],
    possessionDate: new Date('2027-12-31T00:00:00+05:30'),
    facts: FACT_SHEETS.P1,
  },
  {
    code: 'P2',
    name: 'Project 2',
    reraNumber: 'PR/GJ/AHMEDABAD/DASKROI/AUDA/RAA12907/090824',
    tagline: 'Green, quiet 2 BHK and 3 BHK homes in South Bopal',
    location: {
      address: 'Off Bopal–Ghuma Road, South Bopal',
      city: 'Ahmedabad',
      mapUrl: 'https://maps.google.com/?q=23.0197,72.4636',
    },
    configurations: [
      {
        bhk: 2,
        carpetAreaSqft: { min: 680, max: 740 },
        priceRange: { min: 65 * LAKH, max: 74 * LAKH },
        unitsAvailable: 44,
      },
      {
        bhk: 3,
        carpetAreaSqft: { min: 980, max: 1120 },
        priceRange: { min: 88 * LAKH, max: 105 * LAKH },
        unitsAvailable: 18,
      },
    ],
    possessionDate: new Date('2027-06-30T00:00:00+05:30'),
    facts: FACT_SHEETS.P2,
  },
];
