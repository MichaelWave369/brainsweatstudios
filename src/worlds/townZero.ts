import { clone } from "../runtime/data.ts";
import { truth } from "./compiler.ts";
import type {
  ActionSpec,
  Effect,
  EventSpec,
  ObjectiveSpec,
  Predicate,
  Ref,
  WorldPack,
  WorldSpec,
} from "./types.ts";
const test = (
  ref: Ref,
  op: "eq" | "gte" | "lt",
  value: number | boolean,
): Predicate => ({ op, ref, value });
const all = (...rules: Predicate[]): Predicate => ({ op: "all", rules });
const add = (id: string, delta: number): Effect => ({
  type: "resource",
  id,
  delta,
});
const status = (id: string, value: number): Effect => ({
  type: "entity",
  id,
  status: value,
});
const flag = (id: string, value: boolean): Effect => ({
  type: "flag",
  id,
  value,
});
const action = (
  id: string,
  label: string,
  effects: Effect[],
  costs: ActionSpec["costs"] = [],
  duration = 0,
  condition: Predicate = truth,
  exclusive: string | null = null,
  location: string | null = null,
): ActionSpec => ({
  id,
  label,
  effects,
  costs,
  duration,
  condition,
  exclusive,
  location,
});
const event = (
  id: string,
  label: string,
  at: number | null,
  effects: Effect[],
  repeat = 0,
  maxRuns = 1,
  when: Predicate | null = null,
): EventSpec => ({
  id,
  label,
  at,
  effects,
  repeat,
  maxRuns,
  when,
  variants: [],
});
const objective = (
  id: string,
  label: string,
  condition: Predicate,
  critical = false,
): ObjectiveSpec => ({
  id,
  label,
  condition,
  critical,
  parent: null,
  requires: [],
  scope: critical ? "campaign" : "task",
  deadline: null,
  failure: "RESOURCE_EXHAUSTED",
});

export function townZero(
  days: 7 | 14 | 30 = 7,
  turnMode: WorldSpec["turnMode"] = "ordered",
): WorldSpec {
  const locations = [
    ["operations", "Operations Center", 16, 14],
    ["power", "Power Station", 48, 14],
    ["water", "Water Facility", 80, 14],
    ["depot", "Depot", 16, 50],
    ["food", "Food Store", 48, 50],
    ["clinic", "Clinic", 80, 50],
    ["homes", "Residential Zone", 16, 84],
    ["bridge", "Road Junction", 48, 84],
    ["comms", "Communications Tower", 80, 84],
  ] as const;
  const actions: ActionSpec[] = [
    action("wait", "Wait for the next hour", []),
    action(
      "fund-services",
      "Review fictional funding",
      [add("budget", 45)],
      [{ resource: "energy", amount: 3 }],
      2,
      truth,
      "funding",
      "operations",
    ),
    action(
      "reserve-supplies",
      "Allocate supply reserve",
      [add("parts", 3), add("fuel", 12)],
      [{ resource: "budget", amount: 18 }],
      3,
      truth,
      "depot",
      "depot",
    ),
    action(
      "ration",
      "Reduce simulated demand",
      [flag("ration", true)],
      [{ resource: "budget", amount: 8 }],
      2,
      truth,
      null,
      "operations",
    ),
    action(
      "inspect-generator",
      "Inspect abstract generator",
      [
        {
          type: "reveal",
          kind: "entity",
          id: "generator",
          roles: ["infrastructure"],
        },
      ],
      [{ resource: "energy", amount: 1 }],
      1,
      truth,
      null,
      "power",
    ),
    action(
      "inspect-pump",
      "Inspect abstract pump",
      [
        {
          type: "reveal",
          kind: "entity",
          id: "pump",
          roles: ["infrastructure"],
        },
      ],
      [{ resource: "energy", amount: 1 }],
      1,
      truth,
      null,
      "water",
    ),
    action(
      "maintain-generator",
      "Schedule generator maintenance",
      [
        status("generator", 100),
        flag("generator-serviced", true),
        { type: "cancel", event: "generator-failure" },
      ],
      [
        { resource: "parts", amount: 2 },
        { resource: "budget", amount: 12 },
        { resource: "fuel", amount: 2 },
      ],
      6,
      truth,
      "generator",
      "power",
    ),
    action(
      "maintain-pump",
      "Schedule pump maintenance",
      [
        status("pump", 100),
        flag("pump-serviced", true),
        flag("strain", false),
        { type: "cancel", event: "pump-failure" },
      ],
      [
        { resource: "parts", amount: 2 },
        { resource: "budget", amount: 12 },
      ],
      8,
      truth,
      "pump",
      "water",
    ),
    action(
      "clear-road",
      "Clear fictional road blockage",
      [status("road", 100)],
      [
        { resource: "parts", amount: 2 },
        { resource: "budget", amount: 10 },
      ],
      6,
      truth,
      "road",
      "bridge",
    ),
    action(
      "buy-food",
      "Arrange food tokens",
      [add("food", 42)],
      [{ resource: "budget", amount: 16 }],
      4,
      test("entity:road", "gte", 1),
      "depot",
      "food",
    ),
    action(
      "buy-fuel",
      "Arrange fuel tokens",
      [add("fuel", 36)],
      [{ resource: "budget", amount: 14 }],
      4,
      test("entity:road", "gte", 1),
      "depot",
      "depot",
    ),
    action(
      "measure-water",
      "Measure the water reserve",
      [
        {
          type: "reveal",
          kind: "resource",
          id: "water",
          roles: ["logistics", "planner"],
        },
      ],
      [{ resource: "energy", amount: 2 }],
      2,
      truth,
      null,
      "water",
    ),
    action(
      "restore-comms",
      "Restore abstract communications",
      [status("tower", 100)],
      [
        { resource: "parts", amount: 1 },
        { resource: "budget", amount: 8 },
      ],
      5,
      truth,
      "tower",
      "comms",
    ),
    action("request-repair", "Signal an inspection request", [
      {
        type: "signal",
        recipient: "infrastructure",
        signal: "NEED_INSPECTION",
        resource: null,
        amount: null,
      },
    ]),
    action("request-supplies", "Signal a resource request", [
      {
        type: "signal",
        recipient: "planner",
        signal: "REQUEST_RESOURCE",
        resource: "parts",
        amount: 2,
      },
    ]),
    action("report-risk", "Report a bounded risk", [
      {
        type: "signal",
        recipient: "team",
        signal: "RISK_DETECTED",
        resource: null,
        amount: null,
      },
    ]),
  ];
  const horizon = days * 24;
  const events: EventSpec[] = [
    event(
      "daily-demand",
      "Daily simulated demand",
      24,
      [
        add("energy", -40),
        add("water", -36),
        add("food", -20),
        add("fuel", -8),
        add("budget", -12),
        flag("daily", true),
      ],
      24,
      days,
    ),
    event(
      "supply-delivery",
      "Scheduled depot delivery",
      48,
      [add("food", 70), add("fuel", 35), add("parts", 5), add("budget", -20)],
      72,
      10,
      test("entity:road", "gte", 1),
    ),
    event(
      "pump-wear",
      "Pump wear becomes visible",
      48,
      [
        status("pump", 55),
        flag("pump-serviced", false),
        flag("strain", true),
        { type: "schedule", event: "pump-failure", delay: 120 },
      ],
      168,
      5,
    ),
    event(
      "pump-failure",
      "Delayed pump consequence",
      null,
      [status("pump", 0), add("energy", -20)],
      0,
      1,
      test("flag:pump-serviced", "eq", false),
    ),
    event(
      "generator-wear",
      "Generator maintenance pressure",
      72,
      [
        status("generator", 50),
        flag("generator-serviced", false),
        { type: "schedule", event: "generator-failure", delay: 72 },
      ],
      168,
      4,
    ),
    event(
      "generator-failure",
      "Deferred generator consequence",
      null,
      [status("generator", 0)],
      0,
      1,
      test("flag:generator-serviced", "eq", false),
    ),
    event(
      "storm",
      "Seeded fictional weather",
      96,
      [
        flag("storm", true),
        { type: "schedule", event: "storm-clear", delay: 48 },
        { type: "schedule", event: "comms-outage", delay: 12 },
      ],
      168,
      4,
    ),
    event("storm-clear", "Weather clears", null, [flag("storm", false)], 0, 1),
    event(
      "comms-outage",
      "Delayed communications outage",
      null,
      [status("tower", 0)],
      0,
      1,
    ),
    event(
      "unexpected-cost",
      "Unexpected fictional cost",
      132,
      [add("budget", -25)],
      168,
      4,
    ),
  ];
  events.find((e) => e.id === "storm")!.variants = [
    [status("road", 0), add("energy", -18), add("water", -8)],
    [status("road", 0), add("energy", -30), add("water", -12)],
    [status("road", 35), add("energy", -12)],
  ];
  // Child events may be rescheduled by later storms without recurrence loops.
  for (const id of [
    "storm-clear",
    "comms-outage",
    "pump-failure",
    "generator-failure",
  ]) {
    const e = events.find((x) => x.id === id)!;
    e.maxRuns = 4;
    e.repeat = 1;
  }
  // Explicitly event-scheduled children have no automatic repeat. Their bounded
  // run count is independent of the fixed-time recurrence interval.
  for (const e of events.filter((e) => e.at === null)) e.repeat = 0;
  return {
    schema: "brain-sweat-world@1",
    id: "town-zero",
    version: "1.0.0",
    title: "Town Zero",
    description:
      "Keep a fictional settlement functional across changing weather, delayed maintenance and limited supplies. All units and repairs are abstract.",
    clock: { unit: "hour", ticksPerDay: 24, maxTicks: horizon },
    turnMode,
    roles: [
      {
        id: "planner",
        label: "Planner",
        actions: [
          "wait",
          "fund-services",
          "reserve-supplies",
          "ration",
          "request-repair",
        ],
        resources: ["energy", "budget", "parts", "fuel"],
        locations: ["operations", "depot"],
        signals: true,
      },
      {
        id: "logistics",
        label: "Logistics",
        actions: [
          "wait",
          "clear-road",
          "buy-food",
          "buy-fuel",
          "measure-water",
          "request-supplies",
        ],
        resources: ["parts", "budget", "food", "fuel", "energy"],
        locations: ["bridge", "food", "depot", "water"],
        signals: true,
      },
      {
        id: "infrastructure",
        label: "Infrastructure",
        actions: [
          "wait",
          "inspect-generator",
          "inspect-pump",
          "maintain-generator",
          "maintain-pump",
          "request-supplies",
        ],
        resources: ["energy", "parts", "budget", "fuel"],
        locations: ["power", "water"],
        signals: true,
      },
      {
        id: "communications",
        label: "Communications",
        actions: ["wait", "restore-comms", "report-risk", "request-repair"],
        resources: ["parts", "budget"],
        locations: ["comms"],
        signals: true,
      },
    ],
    resources: [
      ["energy", "Energy", 180, 500],
      ["water", "Water", 180, 500],
      ["food", "Food", 140, 500],
      ["parts", "Parts", 12, 80],
      ["fuel", "Fuel", 150, 500],
      ["budget", "Budget", 200, 600],
    ].map(([id, label, initial, max]) => ({
      id: String(id),
      label: String(label),
      initial: Number(initial),
      max: Number(max),
      min: 0,
      visibility:
        id === "water"
          ? { mode: "bucket", thresholds: [60, 140] }
          : { mode: "always" },
    })),
    locations: locations.map(([id, label, x, y], i) => ({
      id,
      label,
      x,
      y,
      neighbors: locations
        .filter((_, j) => Math.abs(j - i) === 1 || Math.abs(j - i) === 3)
        .map((l) => l[0]),
    })),
    entities: [
      {
        id: "generator",
        label: "Generator",
        location: "power",
        status: 100,
        visibility: { mode: "inspect" },
      },
      {
        id: "pump",
        label: "Pump",
        location: "water",
        status: 100,
        visibility: { mode: "inspect" },
      },
      {
        id: "road",
        label: "Road access",
        location: "bridge",
        status: 100,
        visibility: { mode: "always" },
      },
      {
        id: "tower",
        label: "Communications",
        location: "comms",
        status: 100,
        visibility: { mode: "always" },
      },
    ],
    flags: [
      "daily",
      "storm",
      "strain",
      "ration",
      "pump-serviced",
      "generator-serviced",
    ].map((id) => ({
      id,
      initial: id.endsWith("serviced"),
      visibility: id === "daily" ? { mode: "hidden" } : { mode: "always" },
    })),
    objectives: [
      objective(
        "settlement",
        "Functional settlement",
        all(
          test("resource:energy", "gte", 20),
          test("resource:water", "gte", 20),
          test("resource:food", "gte", 10),
          test("resource:budget", "gte", 1),
        ),
        true,
      ),
      {
        ...objective(
          "utilities",
          "Keep abstract utilities available",
          all(
            test("entity:generator", "gte", 1),
            test("entity:pump", "gte", 1),
          ),
          true,
        ),
        failure: "CRITICAL_FACILITY_OFFLINE",
      },
      objective(
        "reserve",
        "Preserve emergency reserve",
        all(
          test("resource:energy", "gte", 80),
          test("resource:water", "gte", 80),
          test("resource:food", "gte", 40),
        ),
      ),
      objective("roads", "Maintain road access", test("entity:road", "gte", 1)),
      objective(
        "communications",
        "Keep communications available",
        test("entity:tower", "gte", 1),
      ),
    ],
    actions,
    events,
    rules: [
      {
        id: "power-production",
        frequency: "tick",
        when: all(
          test("flag:daily", "eq", true),
          test("entity:generator", "gte", 50),
          test("resource:fuel", "gte", 1),
        ),
        effects: [add("energy", 45)],
      },
      {
        id: "water-production",
        frequency: "tick",
        when: all(
          test("flag:daily", "eq", true),
          test("entity:pump", "gte", 60),
        ),
        effects: [add("water", 38)],
      },
      {
        id: "pump-strain",
        frequency: "tick",
        when: all(
          test("flag:daily", "eq", true),
          test("entity:pump", "lt", 60),
          test("entity:pump", "gte", 1),
        ),
        effects: [add("water", 20), add("energy", -10)],
      },
      {
        id: "demand-reduction",
        frequency: "tick",
        when: all(
          test("flag:daily", "eq", true),
          test("flag:ration", "eq", true),
        ),
        effects: [add("food", 6)],
      },
      {
        id: "daily-end",
        frequency: "tick",
        when: test("flag:daily", "eq", true),
        effects: [flag("daily", false)],
      },
      {
        id: "exhausted",
        frequency: "once",
        when: {
          op: "any",
          rules: ["energy", "water", "food", "budget"].map((id) =>
            test(`resource:${id}`, "eq", 0),
          ),
        },
        effects: [{ type: "objective", id: "settlement", status: "failed" }],
      },
    ],
    metrics: [
      "completion",
      "reserves",
      "recovery",
      "coordination",
      "information",
      "invalid-actions",
    ],
  };
}
export function tutorialWorld(): WorldSpec {
  const s = townZero();
  return {
    ...s,
    id: "reserve-lesson",
    title: "Reserve Lesson",
    description:
      "Inspect a hidden store and refill it before delayed demand arrives. A tiny data-defined tutorial.",
    clock: { unit: "tick", ticksPerDay: 4, maxTicks: 12 },
    turnMode: "ordered",
    roles: [
      {
        id: "operator",
        label: "Operator",
        actions: ["wait", "inspect-store", "refill"],
        resources: ["water", "budget"],
        locations: ["store"],
        signals: false,
      },
    ],
    resources: [
      {
        id: "water",
        label: "Water tokens",
        min: 0,
        max: 20,
        initial: 6,
        visibility: { mode: "inspect" },
      },
      {
        id: "budget",
        label: "Budget tokens",
        min: 0,
        max: 20,
        initial: 10,
        visibility: { mode: "always" },
      },
    ],
    locations: [{ id: "store", label: "Store", x: 50, y: 50, neighbors: [] }],
    entities: [],
    flags: [],
    objectives: [
      objective(
        "reserve",
        "Keep a reserve",
        test("resource:water", "gte", 2),
        true,
      ),
    ],
    actions: [
      action("wait", "Wait", []),
      action(
        "inspect-store",
        "Inspect store",
        [
          {
            type: "reveal",
            kind: "resource",
            id: "water",
            roles: ["operator"],
          },
        ],
        [{ resource: "budget", amount: 1 }],
      ),
      action(
        "refill",
        "Refill tokens",
        [add("water", 6)],
        [{ resource: "budget", amount: 2 }],
        2,
      ),
    ],
    events: [event("demand", "Delayed demand", 6, [add("water", -8)])],
    rules: [],
    metrics: ["completion", "reserves", "information"],
  };
}
export const townPack = (
  days: 7 | 14 | 30 = 7,
  mode: WorldSpec["turnMode"] = "ordered",
): WorldPack => ({
  schema: "brain-sweat-pack@1",
  id: "town-zero-pack",
  version: "1.0.0",
  worlds: [townZero(days, mode), tutorialWorld()],
});
export const copySpec = (s: Readonly<WorldSpec>): WorldSpec =>
  clone(s) as WorldSpec;
