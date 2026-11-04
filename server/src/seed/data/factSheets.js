/**
 * The sales head's approved fact sheets: everything the assistant may tell a
 * buyer. The seed loads them into `Project.facts`; after that the sales head
 * edits them from the admin screen. The assistant answers only from these
 * entries (via get_facts) and hands anything else to a sales executive.
 *
 * Coverage follows what Ahmedabad buyers ask before a site visit:
 * - the building: towers, structure, lifts, parking, amenities, security, fire safety, green features
 * - inside the home: flooring, bathroom tiles and fittings, kitchen, furniture, doors and windows,
 *   walls and paint, electrical, plumbing pipelines, gas pipeline, vastu
 * - location: address advantages, distances, schools and hospitals nearby
 * - money: price note, other charges (GST, stamp duty, registration), maintenance, payment plan, home loans
 * - process: booking steps, documents, legal approvals, possession, cancellation, NRI buyers,
 *   customisation, resale and rental, warranty, pets, site office, floor plans, tax benefits
 *
 * Specifications, distances and charges are illustrative for this demo, like the
 * projects themselves. Keys are stable (the assistant's topic search uses them);
 * labels and values are what buyers read.
 */

const COMMON_FACTS = [
  {
    key: 'other_charges',
    label: 'Charges besides the base price',
    value:
      'GST at 5% on under-construction homes, stamp duty of 4.9% and registration fee of 1% of the document value (no registration fee when a woman is the sole buyer, as per Gujarat rules), legal and documentation charges, the maintenance deposit and the PNG gas connection deposit. The sales team gives an all-inclusive cost sheet for a specific apartment.',
  },
  {
    key: 'booking_process',
    label: 'How booking works',
    value:
      'Choose the apartment at the site office, pay the booking amount (10% of the agreement value), sign the agreement for sale within 30 days, then pay the rest in construction-linked stages. A sales executive guides every step, and a site visit is the best first step.',
  },
  {
    key: 'documents_needed',
    label: 'Documents needed',
    value:
      'PAN card, Aadhaar card, two passport-size photos and address proof for each buyer. For a home loan, banks also ask for salary slips or income tax returns for the last 2–3 years and 6 months of bank statements.',
  },
  {
    key: 'approvals_legal',
    label: 'Approvals and legal',
    value:
      'Registered with GujRERA; building plans approved by AUDA; non-agricultural (NA) land with a clear title and a title clearance report from an independent advocate. Copies of the approvals are available to see at the site office.',
  },
  {
    key: 'possession_process',
    label: 'Possession process',
    value:
      'Possession is offered after the building use (BU) permission. Buyers are informed at least 2 months before, pay the final instalment and charges, complete registration and then receive the keys after a joint inspection of the apartment.',
  },
  {
    key: 'warranty',
    label: 'Defect warranty',
    value:
      'As required under RERA, the developer fixes structural defects and workmanship issues reported within 5 years of possession, free of cost.',
  },
  {
    key: 'cancellation',
    label: 'Cancellation and refund',
    value:
      'Cancellation and refunds follow the agreement for sale and GujRERA rules. The sales team explains the cancellation terms in writing before booking.',
  },
  {
    key: 'nri',
    label: 'NRI buyers',
    value:
      'NRIs can buy. Payments are accepted from NRE or NRO accounts, and registration can be done through a power of attorney holder in India.',
  },
  {
    key: 'customization',
    label: 'Changes to the apartment',
    value:
      'Small changes such as tile colour or extra electrical points may be possible before the finishing stage, at extra cost. Structural changes, and changes to the elevation or plumbing shafts, are not allowed.',
  },
  {
    key: 'resale_rental',
    label: 'Resale and renting',
    value:
      'Apartments can be rented out or resold after possession, following the residents’ society rules. Resale before possession needs the developer’s consent and a transfer fee.',
  },
  {
    key: 'furniture_fittings',
    label: 'Furniture and furnishing',
    value:
      'Apartments are handed over unfurnished: wardrobes, kitchen cabinets, beds and loose furniture are not included. Owners can do their own interiors after possession.',
  },
  {
    key: 'walls_paint',
    label: 'Walls and paint',
    value:
      'AAC block walls with gypsum or putty finish and acrylic emulsion paint inside; weatherproof texture paint outside.',
  },
  {
    key: 'structure',
    label: 'Structure and construction quality',
    value:
      'Earthquake-resistant RCC frame structure designed for seismic zone III, checked by an independent structural consultant; branded cement and TMT steel.',
  },
  {
    key: 'pets',
    label: 'Pets',
    value: 'Pets are welcome, following the residents’ society rules for common areas.',
  },
  {
    key: 'floor_plans',
    label: 'Floor plans and brochure',
    value:
      'The sales team shares the brochure and floor plans on WhatsApp, and the furnished sample flat at the site office shows the actual layout.',
  },
  {
    key: 'tax_benefits',
    label: 'Tax benefits',
    value:
      'Home loan borrowers may claim interest under Section 24(b) and principal under Section 80C of the Income Tax Act after possession. Please confirm with your tax adviser.',
  },
  {
    key: 'site_visit',
    label: 'Site visits',
    value:
      'A site visit takes about 45 minutes with a sales executive, including the sample flat and the construction site. Visits can be booked in this chat.',
  },
];

const P1_FACTS = [
  { key: 'towers', label: 'Towers', value: '4 towers of 14 floors, 240 apartments in all' },
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
  { key: 'vastu', label: 'Vastu', value: 'Every apartment is east or north facing' },
  {
    key: 'connectivity',
    label: 'Location and connectivity',
    value:
      '2 km from Vaishnodevi Circle on SG Highway; Sardar Patel Ring Road 4 km, GIFT City about 15 km, Ahmedabad airport about 16 km and Ahmedabad Railway Station about 17 km. BRTS and AMTS bus stops within 2 km.',
  },
  {
    key: 'nearby',
    label: 'Schools, hospitals and shopping nearby',
    value:
      'CBSE and GSEB schools and two multispecialty hospitals within 3 km; Nirma University about 4 km; malls, supermarkets and restaurants along SG Highway within 5 km.',
  },
  {
    key: 'site_office',
    label: 'Site office',
    value: 'Open every day from 10 am to 7 pm, including Sundays, with a sample flat to see',
  },
  {
    key: 'flooring',
    label: 'Flooring',
    value:
      '800 × 1600 mm vitrified tiles (Kajaria or equivalent) in the living room, dining and bedrooms; wooden-finish tiles in the master bedroom; anti-skid tiles on balconies.',
  },
  {
    key: 'bathroom',
    label: 'Bathrooms',
    value:
      'Anti-skid ceramic floor tiles and full-height glazed wall tiles; Jaquar or equivalent taps and shower; Hindware or equivalent wall-hung WC; geyser and exhaust fan points in every bathroom.',
  },
  {
    key: 'kitchen',
    label: 'Kitchen',
    value:
      'Granite platform with a stainless-steel sink, glazed tiles up to 2 ft above the platform, a separate wash area, and points for a water purifier, chimney and microwave.',
  },
  {
    key: 'doors_windows',
    label: 'Doors and windows',
    value:
      'Laminated main door with a digital lock; flush doors inside; UPVC sliding windows with mosquito mesh.',
  },
  {
    key: 'electrical',
    label: 'Electrical',
    value:
      'Concealed copper wiring (Polycab or equivalent), modular switches (Legrand or equivalent), AC points in the living room and all bedrooms, TV and internet points, and a 3-phase connection.',
  },
  {
    key: 'plumbing',
    label: 'Plumbing and pipelines',
    value:
      'Concealed CPVC pipes for water supply (Astral or equivalent) and UPVC drainage lines; underground and overhead water tanks for each tower.',
  },
  {
    key: 'gas_pipeline',
    label: 'Gas pipeline',
    value:
      'Piped natural gas (PNG) connection in every kitchen from Adani Total Gas; the connection deposit is paid by the buyer.',
  },
  {
    key: 'lifts',
    label: 'Lifts',
    value: '2 lifts in every tower, one of them a stretcher lift, with full power backup',
  },
  {
    key: 'security',
    label: 'Security',
    value:
      'Gated campus with 24-hour security, CCTV in common areas, a video door phone in every apartment and intercom to the gate.',
  },
  {
    key: 'fire_safety',
    label: 'Fire safety',
    value:
      'Fire hydrants, sprinklers and smoke detectors in common areas, fire-rated staircases, as per the fire NOC.',
  },
  {
    key: 'green_features',
    label: 'Green features',
    value:
      'Solar panels for common-area lighting, rainwater harvesting and EV charging points in the parking.',
  },
  {
    key: 'maintenance',
    label: 'Maintenance charges',
    value:
      'Advance maintenance of ₹3 per sq ft per month for 2 years is collected at possession, plus a one-time maintenance deposit of ₹50,000.',
  },
];

const P2_FACTS = [
  { key: 'towers', label: 'Towers', value: '3 towers of 12 floors, 180 apartments in all' },
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
    label: 'Location and connectivity',
    value:
      '10 minutes to SP Ring Road; Bopal BRTS stop 2 km, ISKCON Cross Roads about 7 km, Ahmedabad Railway Station about 20 km and the airport about 25 km.',
  },
  {
    key: 'nearby',
    label: 'Schools, hospitals and shopping nearby',
    value:
      'Schools, a multispecialty hospital and a supermarket within 2 km; Bopal market, banks and restaurants within 3 km.',
  },
  {
    key: 'site_office',
    label: 'Site office',
    value: 'Open every day from 10 am to 7 pm, including Sundays, with a sample flat to see',
  },
  {
    key: 'flooring',
    label: 'Flooring',
    value:
      '600 × 1200 mm vitrified tiles (Somany or equivalent) in all rooms; anti-skid tiles on balconies.',
  },
  {
    key: 'bathroom',
    label: 'Bathrooms',
    value:
      'Anti-skid floor tiles and glazed wall tiles up to 7 ft; Cera or equivalent taps, shower and sanitaryware; geyser and exhaust fan points in every bathroom.',
  },
  {
    key: 'kitchen',
    label: 'Kitchen',
    value:
      'Granite platform with a stainless-steel sink, tiles up to 2 ft above the platform and a separate wash area.',
  },
  {
    key: 'doors_windows',
    label: 'Doors and windows',
    value: 'Laminated main door; flush doors inside; powder-coated aluminium sliding windows.',
  },
  {
    key: 'electrical',
    label: 'Electrical',
    value:
      'Concealed copper wiring, modular switches, AC points in all bedrooms, a TV point in the living room and a 3-phase connection.',
  },
  {
    key: 'plumbing',
    label: 'Plumbing and pipelines',
    value:
      'Concealed CPVC pipes for water supply and UPVC drainage lines; underground and overhead water tanks for each tower.',
  },
  {
    key: 'gas_pipeline',
    label: 'Gas pipeline',
    value:
      'Piped natural gas (PNG) connection in every kitchen from Adani Total Gas; the connection deposit is paid by the buyer.',
  },
  { key: 'lifts', label: 'Lifts', value: '2 lifts in every tower, with power backup' },
  {
    key: 'security',
    label: 'Security',
    value: 'Gated campus with 24-hour security, CCTV in common areas and intercom to the gate.',
  },
  {
    key: 'fire_safety',
    label: 'Fire safety',
    value:
      'Fire hydrants and smoke detectors in common areas and fire-rated staircases, as per the fire NOC.',
  },
  {
    key: 'green_features',
    label: 'Green features',
    value: 'Rainwater harvesting, solar lighting in common areas and an organic waste converter.',
  },
  {
    key: 'maintenance',
    label: 'Maintenance charges',
    value:
      'Advance maintenance of ₹2.5 per sq ft per month for 2 years is collected at possession, plus a one-time maintenance deposit of ₹40,000.',
  },
];

export const FACT_SHEETS = {
  P1: [...P1_FACTS, ...COMMON_FACTS],
  P2: [...P2_FACTS, ...COMMON_FACTS],
};
