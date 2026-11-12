/**
 * Curated Namma Metro network topology.
 *
 * Station order, names, section opening dates and interchanges are assembled
 * from public sources (BMRCL announcements, Wikipedia's line and station-list
 * articles, press coverage of each opening) current to November 2026 — see
 * ../SOURCES.md for the citation log and known gaps.
 *
 * Coordinates are NOT authored here: they are imported from OpenStreetMap by
 * `scripts/import-osm.ts` into `./coords.ts`, keyed by the station names
 * below.
 */

export type LineId = "purple" | "green" | "yellow" | "pink" | "blue";
export type LineStatus = "operational" | "opening_soon" | "under_construction";

/**
 * A contiguous stretch of a line that opened (or will open) together.
 * `from` and `to` are station names, inclusive, in line order. Sections share
 * their boundary station, which takes the earlier section's status and date.
 */
export interface SectionDef {
  from: string;
  to: string;
  status: LineStatus;
  /** First day of passenger service, YYYY-MM-DD (IST). */
  openDate?: string;
  /** Target for sections without a firm date. */
  expected?: string;
}

export interface LineDef {
  id: LineId;
  name: string;
  nameKn?: string;
  color: string;
  /** Published route length, terminal to terminal, including unopened sections. */
  lengthKm: number;
  /** Ordered station names, terminal to terminal. */
  stations: string[];
  sections: SectionDef[];
  /** Stations whose platforms on this line are below ground. Everything else is elevated. */
  underground: string[];
  atGrade?: string[];
  source: string;
}

// ---------------------------------------------------------------------------
// Purple Line — Challaghatta <-> Whitefield (Kadugodi). 37 stations.
// ---------------------------------------------------------------------------
export const purple: LineDef = {
  id: "purple",
  name: "Purple Line",
  nameKn: "ನೇರಳೆ ಮಾರ್ಗ",
  color: "#7B2D8E",
  lengthKm: 43.49,
  stations: [
    "Challaghatta",
    "Kengeri",
    "Kengeri Bus Terminal",
    "Pattanagere",
    "Jnanabharathi",
    "Rajarajeshwari Nagar",
    "Pantharapalya - Nayandahalli",
    "Mysuru Road",
    "Deepanjali Nagar",
    "Attiguppe",
    "Vijayanagar",
    "Sri Balagangadharanatha Swamiji Station, Hosahalli",
    "Magadi Road",
    "Krantivira Sangolli Rayanna Railway Station",
    "Nadaprabhu Kempegowda Station, Majestic",
    "Sir M. Visvesvaraya Station, Central College",
    "Dr. B.R. Ambedkar Station, Vidhana Soudha",
    "Cubbon Park",
    "Mahatma Gandhi Road",
    "Trinity",
    "Halasuru",
    "Indiranagar",
    "Swami Vivekananda Road",
    "Baiyappanahalli",
    "Benniganahalli",
    "Krishnarajapura",
    "Singayyanapalya",
    "Garudacharpalya",
    "Hoodi",
    "Seetharamapalya",
    "Kundalahalli",
    "Nallurhalli",
    "Sri Sathya Sai Hospital",
    "Pattandur Agrahara",
    "Kadugodi Tree Park",
    "Hopefarm Channasandra",
    "Whitefield (Kadugodi)",
  ],
  sections: [
    { from: "Challaghatta", to: "Kengeri", status: "operational", openDate: "2023-10-09" },
    { from: "Kengeri", to: "Mysuru Road", status: "operational", openDate: "2021-08-30" },
    { from: "Mysuru Road", to: "Magadi Road", status: "operational", openDate: "2015-11-16" },
    { from: "Magadi Road", to: "Mahatma Gandhi Road", status: "operational", openDate: "2016-04-30" },
    { from: "Mahatma Gandhi Road", to: "Baiyappanahalli", status: "operational", openDate: "2011-10-20" },
    { from: "Baiyappanahalli", to: "Krishnarajapura", status: "operational", openDate: "2023-10-09" },
    { from: "Krishnarajapura", to: "Whitefield (Kadugodi)", status: "operational", openDate: "2023-03-26" },
  ],
  underground: [
    "Krantivira Sangolli Rayanna Railway Station",
    "Nadaprabhu Kempegowda Station, Majestic",
    "Sir M. Visvesvaraya Station, Central College",
    "Dr. B.R. Ambedkar Station, Vidhana Soudha",
    "Cubbon Park",
  ],
  atGrade: ["Baiyappanahalli"],
  source:
    "BMRCL announcements + Wikipedia 'Purple Line (Namma Metro)' and 'List of Namma Metro stations', checked November 2026.",
};

// ---------------------------------------------------------------------------
// Green Line — Madavara <-> Silk Institute. 32 stations.
// ---------------------------------------------------------------------------
export const green: LineDef = {
  id: "green",
  name: "Green Line",
  nameKn: "ಹಸಿರು ಮಾರ್ಗ",
  color: "#2E9E4C",
  lengthKm: 33.46,
  stations: [
    "Madavara",
    "Chikkabidarakallu",
    "Manjunathanagara",
    "Nagasandra",
    "Dasarahalli",
    "Jalahalli",
    "Peenya Industry",
    "Peenya",
    "Goraguntepalya",
    "Yeshwanthpur",
    "Sandal Soap Factory",
    "Mahalakshmi",
    "Rajajinagar",
    "Mahakavi Kuvempu Road",
    "Srirampura",
    "Mantri Square Sampige Road",
    "Nadaprabhu Kempegowda Station, Majestic",
    "Chickpete",
    "Krishna Rajendra Market",
    "National College",
    "Lalbagh",
    "South End Circle",
    "Jayanagar",
    "Rashtreeya Vidyalaya Road",
    "Banashankari",
    "Jaya Prakash Nagar",
    "Yelachenahalli",
    "Konanakunte Cross",
    "Doddakallasandra",
    "Vajarahalli",
    "Thalaghattapura",
    "Silk Institute",
  ],
  sections: [
    { from: "Madavara", to: "Nagasandra", status: "operational", openDate: "2024-11-07" },
    { from: "Nagasandra", to: "Peenya Industry", status: "operational", openDate: "2015-05-01" },
    { from: "Peenya Industry", to: "Mantri Square Sampige Road", status: "operational", openDate: "2014-03-01" },
    { from: "Mantri Square Sampige Road", to: "Yelachenahalli", status: "operational", openDate: "2017-06-18" },
    { from: "Yelachenahalli", to: "Silk Institute", status: "operational", openDate: "2021-01-15" },
  ],
  underground: ["Nadaprabhu Kempegowda Station, Majestic", "Chickpete", "Krishna Rajendra Market"],
  source:
    "Wikipedia 'Green Line (Namma Metro)' and 'List of Namma Metro stations', checked November 2026.",
};

// ---------------------------------------------------------------------------
// Yellow Line — RV Road <-> Bommasandra. 16 stations, open since Aug 2025.
// ---------------------------------------------------------------------------
export const yellow: LineDef = {
  id: "yellow",
  name: "Yellow Line",
  nameKn: "ಹಳದಿ ಮಾರ್ಗ",
  color: "#F2C300",
  lengthKm: 19.15,
  stations: [
    "Rashtreeya Vidyalaya Road",
    "Ragigudda",
    "Jayadeva Hospital",
    "BTM Layout",
    "Central Silk Board",
    "Bommanahalli",
    "Hongasandra",
    "Kudlu Gate",
    "Singasandra",
    "Hosa Road",
    "Beratena Agrahara",
    "Electronic City",
    "Infosys Foundation Konappana Agrahara",
    "Huskur Road",
    "Biocon Hebbagodi",
    "Delta Electronics Bommasandra",
  ],
  sections: [
    {
      from: "Rashtreeya Vidyalaya Road",
      to: "Delta Electronics Bommasandra",
      status: "operational",
      openDate: "2025-08-11",
    },
  ],
  underground: [],
  source:
    "Deccan Herald opening coverage (inaugurated 10 Aug 2025, public service from 11 Aug) + Wikipedia 'List of Namma Metro stations', checked November 2026.",
};

// ---------------------------------------------------------------------------
// Pink Line — Kalena Agrahara <-> Nagawara. 18 stations.
// The 7.5 km elevated section (first six stations) is inaugurated on
// 13 Nov 2026 with passenger service from 14 Nov. The 12 underground stations
// north of Tavarekere are still being built.
// ---------------------------------------------------------------------------
export const PINK_OPENING_DATE = "2026-11-14";

export const pink: LineDef = {
  id: "pink",
  name: "Pink Line",
  nameKn: "ಗುಲಾಬಿ ಮಾರ್ಗ",
  color: "#EC6EAD",
  lengthKm: 21.25,
  stations: [
    "Kalena Agrahara",
    "Hulimavu",
    "IIMB",
    "JP Nagar 4th Phase",
    "Jayadeva Hospital",
    "Tavarekere",
    "Dairy Circle",
    "Lakkasandra",
    "Langford Town",
    "National Military School",
    "Mahatma Gandhi Road",
    "Shivajinagar",
    "Cantonment Railway Station",
    "Pottery Town",
    "Tannery Road",
    "Venkateshpura",
    "Kadugundanahalli",
    "Nagawara",
  ],
  sections: [
    { from: "Kalena Agrahara", to: "Tavarekere", status: "opening_soon", openDate: PINK_OPENING_DATE },
    { from: "Tavarekere", to: "Nagawara", status: "under_construction", expected: "March 2027" },
  ],
  underground: [
    "Dairy Circle",
    "Lakkasandra",
    "Langford Town",
    "National Military School",
    "Mahatma Gandhi Road",
    "Shivajinagar",
    "Cantonment Railway Station",
    "Pottery Town",
    "Tannery Road",
    "Venkateshpura",
    "Kadugundanahalli",
    "Nagawara",
  ],
  source:
    "Wikipedia 'Pink Line (Namma Metro)' (station order, layout, length) + November 2026 press coverage of the Kalena Agrahara–Tavarekere opening (Oneindia, Urban Acres), checked 12 November 2026. Underground section date is a target, not confirmed.",
};

export const lines: LineDef[] = [purple, green, yellow, pink];

/** Interchange stations: name -> lines that share that physical station. */
export const interchanges: Record<string, LineId[]> = {
  "Nadaprabhu Kempegowda Station, Majestic": ["purple", "green"],
  "Rashtreeya Vidyalaya Road": ["green", "yellow"],
  "Jayadeva Hospital": ["yellow", "pink"],
  // Purple is open here today; the Pink platforms arrive with the underground section.
  "Mahatma Gandhi Road": ["purple", "pink"],
};

/** Modelled platform-to-platform walking time at each interchange, in seconds. */
export const interchangeWalkSeconds: Record<string, number> = {
  "Nadaprabhu Kempegowda Station, Majestic": 240,
  "Rashtreeya Vidyalaya Road": 180,
  "Jayadeva Hospital": 240,
  "Mahatma Gandhi Road": 300,
};

/** Names people actually type: older names, abbreviations, locality names. */
export const aliases: Record<string, string[]> = {
  "Pantharapalya - Nayandahalli": ["Nayandahalli"],
  "Mysuru Road": ["Mysore Road"],
  "Sri Balagangadharanatha Swamiji Station, Hosahalli": ["Hosahalli"],
  "Krantivira Sangolli Rayanna Railway Station": ["KSR Railway Station", "City Railway Station", "SBC"],
  "Nadaprabhu Kempegowda Station, Majestic": ["Majestic", "Kempegowda"],
  "Sir M. Visvesvaraya Station, Central College": ["Central College"],
  "Dr. B.R. Ambedkar Station, Vidhana Soudha": ["Vidhana Soudha"],
  "Mahatma Gandhi Road": ["MG Road", "M G Road"],
  Halasuru: ["Ulsoor"],
  "Swami Vivekananda Road": ["SV Road"],
  Krishnarajapura: ["KR Puram", "KR Pura", "K R Puram"],
  "Sri Sathya Sai Hospital": ["Sathya Sai"],
  "Whitefield (Kadugodi)": ["Kadugodi"],
  "Hopefarm Channasandra": ["Hope Farm", "Channasandra"],
  Manjunathanagara: ["Manjunath Nagar"],
  Goraguntepalya: ["Yeshwanthpur Industry"],
  Yeshwanthpur: ["Yeshwantpur", "Yeshwantpura"],
  "Mahakavi Kuvempu Road": ["Kuvempu Road"],
  "Mantri Square Sampige Road": ["Sampige Road", "Malleshwaram"],
  "Krishna Rajendra Market": ["KR Market", "K R Market", "City Market"],
  "Rashtreeya Vidyalaya Road": ["RV Road", "R V Road"],
  "Jaya Prakash Nagar": ["JP Nagar"],
  "Central Silk Board": ["Silk Board"],
  "Infosys Foundation Konappana Agrahara": ["Konappana Agrahara", "Infosys"],
  "Biocon Hebbagodi": ["Hebbagodi"],
  "Delta Electronics Bommasandra": ["Bommasandra"],
  "Jayadeva Hospital": ["Jayadeva"],
  IIMB: ["Bilekahalli", "IIM Bangalore", "IIM-B"],
  "JP Nagar 4th Phase": ["N S Palya", "NS Palya"],
  Tavarekere: ["Suddaguntepalya", "S G Palya", "SG Palya"],
  "National Military School": ["Rashtriya Military School", "Vellara Junction"],
  "Cantonment Railway Station": ["Cantonment", "Bangalore Cantonment"],
  Kadugundanahalli: ["Kadugondanahalli", "KG Halli"],
  Venkateshpura: ["Venkateshapura"],
};

/** Kannada names for stations whose OpenStreetMap record has none. */
export const nameKnOverrides: Record<string, string> = {
  "Dairy Circle": "ಡೈರಿ ವೃತ್ತ",
  "JP Nagar 4th Phase": "ಜೆ.ಪಿ. ನಗರ 4ನೇ ಹಂತ",
  IIMB: "ಐಐಎಂಬಿ",
  Tavarekere: "ತಾವರೆಕೆರೆ",
};
