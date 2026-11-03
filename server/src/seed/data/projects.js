const LAKH = 100_000;

/**
 * The two live projects from the brief: 420 apartments in all, 2 and 3 BHK,
 * ₹65 lakh to ₹1.2 crore. RERA numbers, addresses and facts are made up but
 * follow the Gujarat RERA format.
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
    facts: [
      {
        key: 'towers',
        label: 'Towers',
        value: '4 towers of 14 floors, 240 apartments in all',
      },
      {
        key: 'amenities',
        label: 'Amenities',
        value:
          'Clubhouse, swimming pool, gym, kids’ play area, jogging track, indoor games room and a multipurpose hall',
      },
      {
        key: 'parking',
        label: 'Parking',
        value:
          'One covered car park with every 2 BHK and two with every 3 BHK; visitor parking at ground level',
      },
      {
        key: 'construction_status',
        label: 'Construction status',
        value: 'Towers A and B are built up to the 9th floor; Towers C and D up to the 5th floor',
      },
      {
        key: 'home_loans',
        label: 'Home loans',
        value: 'Approved by SBI, HDFC Bank, ICICI Bank and Bank of Baroda',
      },
      {
        key: 'payment_plan',
        label: 'Payment plan',
        value: 'Construction-linked: 10% on booking, the rest in stages as construction progresses',
      },
      {
        key: 'price_note',
        label: 'About prices',
        value:
          'Prices are base prices. GST, stamp duty and registration are extra. The sales team confirms the final price for a specific apartment.',
      },
      {
        key: 'water_power',
        label: 'Water and power',
        value: '24-hour Narmada water supply; power backup for lifts and common areas',
      },
      {
        key: 'vastu',
        label: 'Vastu',
        value: 'Every apartment is east or north facing',
      },
      {
        key: 'connectivity',
        label: 'Connectivity',
        value: '2 km from Vaishnodevi Circle on SG Highway; schools and hospitals within 3 km',
      },
      {
        key: 'site_office',
        label: 'Site office',
        value: 'Open every day from 10 am to 7 pm, including Sundays, with a sample flat to see',
      },
    ],
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
    facts: [
      {
        key: 'towers',
        label: 'Towers',
        value: '3 towers of 12 floors, 180 apartments in all',
      },
      {
        key: 'amenities',
        label: 'Amenities',
        value:
          'Clubhouse, gym, landscaped garden, kids’ play area, senior citizens’ sit-out and a party lawn. There is no swimming pool.',
      },
      {
        key: 'parking',
        label: 'Parking',
        value:
          'One covered car park with every apartment; extra parking on request, subject to availability',
      },
      {
        key: 'construction_status',
        label: 'Construction status',
        value: 'All 3 towers are structurally complete; finishing work is in progress',
      },
      {
        key: 'home_loans',
        label: 'Home loans',
        value: 'Approved by SBI, HDFC Bank, Axis Bank and Kotak Mahindra Bank',
      },
      {
        key: 'payment_plan',
        label: 'Payment plan',
        value: 'Construction-linked: 10% on booking, the rest in stages up to possession',
      },
      {
        key: 'price_note',
        label: 'About prices',
        value:
          'Prices are base prices. GST, stamp duty and registration are extra. The sales team confirms the final price for a specific apartment.',
      },
      {
        key: 'water_power',
        label: 'Water and power',
        value:
          '24-hour water supply from borewell and AUDA lines; power backup for lifts and common areas',
      },
      {
        key: 'connectivity',
        label: 'Connectivity',
        value: '10 minutes to SP Ring Road; schools, a hospital and a supermarket within 2 km',
      },
      {
        key: 'site_office',
        label: 'Site office',
        value: 'Open every day from 10 am to 7 pm, including Sundays, with a sample flat to see',
      },
    ],
  },
];
