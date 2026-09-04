/**
 * Curated Namma Metro network topology, v1.
 *
 * Station lists and interchange points are assembled from public sources
 * (BMRCL announcements, Wikipedia station/line articles, and metro-tracking
 * sites) current to September 2026 — see ../../data/SOURCES.md for the full
 * citation log and known gaps. Coordinates are geographic estimates
 * (`coordConfidence: "approximate"`) placed by interpolating between a
 * handful of anchor points per line; they are good enough for "nearest
 * station" search but are NOT survey-grade. Segment run times are modelled
 * from published line lengths / average commercial speed, not measured
 * per-segment timings — see SOURCES.md.
 */

export type LineId = "purple" | "green" | "yellow" | "pink" | "blue";
export type LineStatus = "operational" | "opening_soon" | "under_construction";

export interface Anchor {
  /** 0-based index into the line's station list */
  index: number;
  lat: number;
  lng: number;
}

export interface LineDef {
  id: LineId;
  name: string;
  nameKn?: string;
  color: string;
  status: LineStatus;
  /** Ordered station names, terminal to terminal. */
  stations: string[];
  anchors: Anchor[];
  source: string;
}

// ---------------------------------------------------------------------------
// Purple Line — Challaghatta <-> Whitefield (Kadugodi). Fully operational.
// ---------------------------------------------------------------------------
export const purple: LineDef = {
  id: "purple",
  name: "Purple Line",
  nameKn: "ನೇರಳೆ ಮಾರ್ಗ",
  color: "#7B2D8E",
  status: "operational",
  stations: [
    "Challaghatta",
    "Kengeri",
    "Kengeri Bus Terminal",
    "Pattanagere",
    "Jnanabharathi",
    "Rajarajeshwari Nagar",
    "Nayandahalli",
    "Mysuru Road",
    "Deepanjali Nagar",
    "Attiguppe",
    "Vijayanagar",
    "Hosahalli",
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
    "Pattandur Agrahara",
    "Kadugodi Tree Park",
    "Hopefarm Channasandra",
    "Whitefield (Kadugodi)",
  ],
  anchors: [
    { index: 0, lat: 12.9075, lng: 77.4832 }, // Challaghatta
    { index: 1, lat: 12.9105, lng: 77.4823 }, // Kengeri
    { index: 6, lat: 12.9459, lng: 77.5354 }, // Nayandahalli
    { index: 7, lat: 12.9508, lng: 77.5432 }, // Mysuru Road
    { index: 10, lat: 12.9719, lng: 77.5392 }, // Vijayanagar
    { index: 13, lat: 12.9767, lng: 77.5658 }, // KSR City Railway Station
    { index: 14, lat: 12.9767, lng: 77.5713 }, // Majestic
    { index: 18, lat: 12.9757, lng: 77.6069 }, // MG Road
    { index: 21, lat: 12.9784, lng: 77.6408 }, // Indiranagar
    { index: 23, lat: 12.9905, lng: 77.6547 }, // Baiyappanahalli
    { index: 25, lat: 12.9944, lng: 77.6970 }, // Krishnarajapura (KR Puram)
    { index: 35, lat: 12.9931, lng: 77.75 }, // Whitefield (Kadugodi)
  ],
  source:
    "BMRCL public announcements + Wikipedia 'Purple Line (Namma Metro)' and per-station articles, checked September 2026. Station count (36 modelled here vs. 37 commonly cited) has one unresolved gap — see SOURCES.md.",
};

// ---------------------------------------------------------------------------
// Green Line — Madavara <-> Silk Institute. Fully operational.
// ---------------------------------------------------------------------------
export const green: LineDef = {
  id: "green",
  name: "Green Line",
  nameKn: "ಹಸಿರು ಮಾರ್ಗ",
  color: "#2E9E4C",
  status: "operational",
  stations: [
    "Madavara",
    "Chikkabidarakallu",
    "Manjunath Nagar",
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
    "Kuvempu Road",
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
  anchors: [
    { index: 0, lat: 13.0453, lng: 77.4903 }, // Madavara
    { index: 3, lat: 13.0447, lng: 77.5075 }, // Nagasandra
    { index: 9, lat: 13.0284, lng: 77.554 }, // Yeshwanthpur
    { index: 12, lat: 12.9915, lng: 77.5545 }, // Rajajinagar
    { index: 16, lat: 12.9767, lng: 77.5713 }, // Majestic
    { index: 19, lat: 12.9422, lng: 77.576 }, // National College
    { index: 22, lat: 12.9294, lng: 77.5827 }, // Jayanagar
    { index: 23, lat: 12.941, lng: 77.592 }, // RV Road
    { index: 24, lat: 12.9161, lng: 77.573 }, // Banashankari
    { index: 26, lat: 12.8887, lng: 77.5713 }, // Yelachenahalli
    { index: 31, lat: 12.859, lng: 77.559 }, // Silk Institute
  ],
  source:
    "Wikipedia 'Green Line (Namma Metro)' and per-station articles, checked September 2026.",
};

// ---------------------------------------------------------------------------
// Yellow Line — RV Road <-> Bommasandra. Operational since 10 Aug 2025.
// ---------------------------------------------------------------------------
export const yellow: LineDef = {
  id: "yellow",
  name: "Yellow Line",
  nameKn: "ಹಳದಿ ಮಾರ್ಗ",
  color: "#F2C300",
  status: "operational",
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
  anchors: [
    { index: 0, lat: 12.941, lng: 77.592 }, // RV Road
    { index: 4, lat: 12.9166, lng: 77.6228 }, // Central Silk Board
    { index: 11, lat: 12.8452, lng: 77.6602 }, // Electronic City
    { index: 15, lat: 12.8065, lng: 77.6963 }, // Delta Electronics Bommasandra
  ],
  source:
    "Deccan Herald opening coverage (10 Aug 2025) + Wikipedia per-station articles, checked September 2026.",
};

// ---------------------------------------------------------------------------
// Pink Line — under construction / partial opening, Kalena Agrahara <->
// Nagawara corridor. Included with status flags only; not routable in v1.
// ---------------------------------------------------------------------------
export const pink: LineDef = {
  id: "pink",
  name: "Pink Line",
  nameKn: "ಗುಲಾಬಿ ಮಾರ್ಗ",
  color: "#EC6EAD",
  status: "under_construction",
  stations: [
    "Kalena Agrahara",
    "Tavarekere",
    "Jayadeva Hospital",
    "Dairy Circle",
    "Audugodi",
    "South End Circle (Pink Line)",
    "Lakkasandra",
    "National Military School",
    "Langford Town",
    "Shanthinagar",
    "Corporation Circle",
    "Vidhana Soudha (Pink Line)",
    "Mattikere",
    "Nagawara",
  ],
  anchors: [
    { index: 0, lat: 12.8843, lng: 77.6089 }, // Kalena Agrahara
    { index: 2, lat: 12.9285, lng: 77.6106 }, // Jayadeva Hospital
    { index: 13, lat: 13.0398, lng: 77.6221 }, // Nagawara
  ],
  source:
    "Public BMRCL Phase 2 status updates (April–September 2026 station-opening reports); exact final station order for the northern half is unconfirmed — flagged 'under_construction' and excluded from routing.",
};

export const lines: LineDef[] = [purple, green, yellow, pink];

/** Interchange stations: name -> lines that share that physical station. */
export const interchanges: Record<string, LineId[]> = {
  "Nadaprabhu Kempegowda Station, Majestic": ["purple", "green"],
  "Rashtreeya Vidyalaya Road": ["green", "yellow"],
  // Jayadeva Hospital is a planned (not yet built) interchange between the
  // operational Yellow Line and the under-construction Pink Line.
  "Jayadeva Hospital": ["yellow", "pink"],
};

/**
 * Familiar short names, for the many BMRCL stations whose official name is a
 * commemorative mouthful. Locals say "Majestic" and "RV Road"; signage and
 * announcements use both. The full name stays canonical for page titles and
 * search — these are used wherever space is tight (map labels, lists, the
 * route strip).
 */
export const shortNames: Record<string, string> = {
  "Nadaprabhu Kempegowda Station, Majestic": "Majestic",
  "Krantivira Sangolli Rayanna Railway Station": "City Railway Station",
  "Sir M. Visvesvaraya Station, Central College": "Sir M. Visvesvaraya",
  "Dr. B.R. Ambedkar Station, Vidhana Soudha": "Vidhana Soudha",
  "Whitefield (Kadugodi)": "Whitefield",
  "Krishnarajapura": "KR Puram",
  "Rashtreeya Vidyalaya Road": "RV Road",
  "Mantri Square Sampige Road": "Sampige Road",
  "Krishna Rajendra Market": "KR Market",
  "Infosys Foundation Konappana Agrahara": "Konappana Agrahara",
  "Delta Electronics Bommasandra": "Bommasandra",
  "Biocon Hebbagodi": "Hebbagodi",
  "Mahatma Gandhi Road": "MG Road",
  "Swami Vivekananda Road": "Swami Vivekananda Rd",
  "Jaya Prakash Nagar": "JP Nagar",
};

/** Manually-set interchange walking transfer time, in seconds. */
export const interchangeWalkSeconds: Record<string, number> = {
  "Nadaprabhu Kempegowda Station, Majestic": 240,
  "Rashtreeya Vidyalaya Road": 180,
};
