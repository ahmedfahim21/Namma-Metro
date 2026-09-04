import { z } from "zod";

export const LineIdSchema = z.enum(["purple", "green", "yellow", "pink", "blue"]);
export type LineId = z.infer<typeof LineIdSchema>;

export const LineStatusSchema = z.enum([
  "operational",
  "opening_soon",
  "under_construction",
]);
export type LineStatus = z.infer<typeof LineStatusSchema>;

export const LineSchema = z.object({
  id: LineIdSchema,
  name: z.string(),
  nameKn: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  status: LineStatusSchema,
  terminals: z.tuple([z.string(), z.string()]),
  source: z.string(),
});
export type Line = z.infer<typeof LineSchema>;

export const StationMembershipSchema = z.object({
  line: LineIdSchema,
  sequence: z.number().int().nonnegative(),
});

export const ExitGateSchema = z.object({
  id: z.string(),
  label: z.string(),
  landmarks: z.array(z.string()).default([]),
});

export const StationSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  nameKn: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  coordConfidence: z.enum(["surveyed", "approximate"]).default("approximate"),
  lines: z.array(StationMembershipSchema).min(1),
  interchange: z.boolean().default(false),
  interchangeWalkSeconds: z.number().int().positive().optional(),
  exits: z.array(ExitGateSchema).default([]),
  hasLift: z.boolean().default(false),
  hasEscalator: z.boolean().default(false),
  hasParking: z.boolean().default(false),
  status: LineStatusSchema.default("operational"),
  source: z.string(),
});
export type Station = z.infer<typeof StationSchema>;

export const SegmentSchema = z.object({
  line: LineIdSchema,
  from: z.string(),
  to: z.string(),
  runSeconds: z.number().int().positive(),
  distanceMeters: z.number().int().positive(),
  source: z.string(),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const DayTypeSchema = z.enum(["weekday", "saturday", "sunday_holiday"]);
export type DayType = z.infer<typeof DayTypeSchema>;

export const HeadwayBandSchema = z.object({
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
  headwaySeconds: z.number().int().positive(),
});

export const TimetableEntrySchema = z.object({
  line: LineIdSchema,
  direction: z.string(),
  /** 0 = travelling in increasing station-sequence order, 1 = decreasing. */
  directionIndex: z.union([z.literal(0), z.literal(1)]),
  dayType: DayTypeSchema,
  firstTrainMinute: z.number().int().min(0).max(1440),
  lastTrainMinute: z.number().int().min(0).max(1440),
  headwayBands: z.array(HeadwayBandSchema).min(1),
  source: z.string(),
});
export type TimetableEntry = z.infer<typeof TimetableEntrySchema>;

export const FareSlabSchema = z.object({
  minStops: z.number().int().nonnegative(),
  maxStops: z.number().int().positive(),
  tokenFare: z.number().int().positive(),
});

export const FareRulesSchema = z.object({
  slabs: z.array(FareSlabSchema).min(1),
  sameStationFare: z.number().int().positive(),
  qrDiscountPct: z.number().min(0).max(100),
  smartCardPeakDiscountPct: z.number().min(0).max(100),
  smartCardOffPeakDiscountPct: z.number().min(0).max(100),
  peakWindows: z
    .array(
      z.object({
        startMinute: z.number().int().min(0).max(1440),
        endMinute: z.number().int().min(0).max(1440),
      }),
    )
    .min(1),
  fullDiscountDates: z.array(z.string()).default([]),
  passes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        validDays: z.number().int().positive(),
        price: z.number().int().positive(),
      }),
    )
    .default([]),
  source: z.string(),
});
export type FareRules = z.infer<typeof FareRulesSchema>;

export const NetworkSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  lines: z.array(LineSchema),
  stations: z.array(StationSchema),
  segments: z.array(SegmentSchema),
  timetables: z.array(TimetableEntrySchema),
  fares: FareRulesSchema,
});
export type Network = z.infer<typeof NetworkSchema>;
