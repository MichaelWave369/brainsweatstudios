import { clone } from "../runtime/data";
import { truth } from "../worlds/compiler";
import type { Predicate, Visibility, WorldSpec } from "../worlds/types";

function NumberField({
  label,
  value,
  min = 0,
  max = 1000000,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="world-field">
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="world-field">
      {label}
      <input
        aria-label={label}
        maxLength={80}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function PredicateField({
  value,
  refs,
  label,
  onChange,
  depth = 0,
}: {
  value: Predicate;
  refs: string[];
  label: string;
  onChange: (v: Predicate) => void;
  depth?: number;
}) {
  const op = value.op;
  return (
    <fieldset className="world-rule">
      <legend>{label}</legend>
      <label>
        Rule operator
        <select
          aria-label={`${label} operator`}
          value={op}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "all" || next === "any")
              onChange({ op: next, rules: [] });
            else if (next === "not") onChange({ op: "not", rule: truth });
            else onChange({ op: next as "eq", ref: "tick", value: 1 });
          }}
        >
          {[
            "all",
            "any",
            "not",
            "eq",
            "ne",
            "lt",
            "lte",
            "gt",
            "gte",
            "contains",
          ].map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
      {"rules" in value ? (
        <>
          {value.rules.map((r, i) => (
            <div key={i}>
              <PredicateField
                label={`Condition ${i + 1}`}
                value={r}
                refs={refs}
                depth={depth + 1}
                onChange={(v) =>
                  onChange({
                    ...value,
                    rules: value.rules.map((x, j) => (i === j ? v : x)),
                  })
                }
              />
              <button
                className="btn secondary"
                onClick={() =>
                  onChange({
                    ...value,
                    rules: value.rules.filter((_, j) => j !== i),
                  })
                }
              >
                Remove condition
              </button>
            </div>
          ))}
          <button
            className="btn secondary"
            disabled={depth >= 5 || value.rules.length >= 8}
            onClick={() =>
              onChange({
                ...value,
                rules: [...value.rules, { op: "gte", ref: "tick", value: 1 }],
              })
            }
          >
            Add condition
          </button>
        </>
      ) : "rule" in value ? (
        <PredicateField
          label="Nested condition"
          value={value.rule}
          refs={refs}
          depth={depth + 1}
          onChange={(v) => onChange({ op: "not", rule: v })}
        />
      ) : (
        <>
          <label>
            State reference
            <select
              aria-label={`${label} reference`}
              value={value.ref}
              onChange={(e) => {
                const ref = e.target.value as typeof value.ref;
                onChange({
                  ...value,
                  ref,
                  value: ref.startsWith("flag:")
                    ? true
                    : ref.startsWith("objective:")
                      ? "complete"
                      : 1,
                });
              }}
            >
              {refs.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {typeof value.value === "boolean" ? (
            <label>
              Flag value
              <select
                value={String(value.value)}
                onChange={(e) =>
                  onChange({ ...value, value: e.target.value === "true" })
                }
              >
                <option>true</option>
                <option>false</option>
              </select>
            </label>
          ) : typeof value.value === "number" ? (
            <NumberField
              label={`${label} value`}
              min={-1000000}
              value={value.value}
              onChange={(n) => onChange({ ...value, value: n })}
            />
          ) : (
            <label>
              Objective state
              <select
                value={value.value}
                onChange={(e) => onChange({ ...value, value: e.target.value })}
              >
                {["pending", "complete", "failed"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
    </fieldset>
  );
}
function VisibilityField({
  value,
  label,
  roles,
  locations,
  onChange,
}: {
  value: Visibility;
  label: string;
  roles: string[];
  locations: string[];
  onChange: (v: Visibility) => void;
}) {
  return (
    <fieldset className="world-rule">
      <legend>{label}</legend>
      <label>
        Observation mode
        <select
          value={value.mode}
          onChange={(e) => {
            const mode = e.target.value;
            if (mode === "roles") onChange({ mode, roles: [roles[0]] });
            else if (mode === "delayed") onChange({ mode, tick: 24 });
            else if (mode === "location")
              onChange({ mode, location: locations[0] });
            else if (mode === "bucket")
              onChange({ mode, thresholds: [40, 100] });
            else onChange({ mode: mode as "always" });
          }}
        >
          {[
            "always",
            "roles",
            "inspect",
            "bucket",
            "hidden",
            "delayed",
            "location",
          ].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      {value.mode === "roles" ? (
        roles.map((r) => (
          <label key={r}>
            <input
              type="checkbox"
              checked={value.roles.includes(r)}
              onChange={(e) =>
                onChange({
                  mode: "roles",
                  roles: e.target.checked
                    ? [...value.roles, r]
                    : value.roles.filter((x) => x !== r),
                })
              }
            />
            {r}
          </label>
        ))
      ) : value.mode === "delayed" ? (
        <NumberField
          label="Reveal at tick"
          value={value.tick}
          max={10000}
          onChange={(tick) => onChange({ mode: "delayed", tick })}
        />
      ) : value.mode === "bucket" ? (
        value.thresholds.map((n, i) => (
          <NumberField
            key={i}
            label={`Bucket boundary ${i + 1}`}
            value={n}
            onChange={(x) =>
              onChange({
                mode: "bucket",
                thresholds: value.thresholds.map((v, j) => (j === i ? x : v)),
              })
            }
          />
        ))
      ) : value.mode === "location" ? (
        <label>
          Visible location
          <select
            value={value.location}
            onChange={(e) =>
              onChange({ mode: "location", location: e.target.value })
            }
          >
            {locations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      ) : null}
    </fieldset>
  );
}
export default function WorldAuthoring({
  spec,
  onChange,
  disabled = false,
}: {
  spec: WorldSpec;
  onChange: (s: WorldSpec) => void;
  disabled?: boolean;
}) {
  const edit = (update: (s: WorldSpec) => void) => {
    const next = clone(spec);
    update(next);
    onChange(next);
  };
  const roles = spec.roles.map((r) => r.id),
    locations = spec.locations.map((l) => l.id),
    refs = [
      "tick",
      ...spec.resources.map((r) => `resource:${r.id}`),
      ...spec.entities.map((e) => `entity:${e.id}`),
      ...spec.flags.map((f) => `flag:${f.id}`),
      ...spec.objectives.map((o) => `objective:${o.id}`),
    ];
  return (
    <fieldset disabled={disabled} className="world-authoring">
      <legend>World authoring forms</legend>
      <details>
        <summary>Basics and simulation clock</summary>
        <div className="world-grid">
          <TextField
            label="World identifier"
            value={spec.id}
            onChange={(v) =>
              edit((s) => {
                s.id = v;
              })
            }
          />
          <TextField
            label="World title"
            value={spec.title}
            onChange={(v) =>
              edit((s) => {
                s.title = v;
              })
            }
          />
          <TextField
            label="World version"
            value={spec.version}
            onChange={(v) =>
              edit((s) => {
                s.version = v;
              })
            }
          />
          <NumberField
            label="Maximum simulation ticks"
            max={10000}
            min={1}
            value={spec.clock.maxTicks}
            onChange={(n) =>
              edit((s) => {
                s.clock.maxTicks = n;
              })
            }
          />
          <NumberField
            label="Ticks per simulated day"
            min={1}
            max={240}
            value={spec.clock.ticksPerDay}
            onChange={(n) =>
              edit((s) => {
                s.clock.ticksPerDay = n;
              })
            }
          />
          <label>
            Turn model
            <select
              aria-label="Turn model"
              value={spec.turnMode}
              onChange={(e) =>
                edit((s) => {
                  s.turnMode = e.target.value as WorldSpec["turnMode"];
                })
              }
            >
              <option value="ordered">Ordered turns</option>
              <option value="simultaneous">Simultaneous intents</option>
            </select>
          </label>
        </div>
        <label className="world-field">
          World objective
          <textarea
            maxLength={600}
            value={spec.description}
            onChange={(e) =>
              edit((s) => {
                s.description = e.target.value;
              })
            }
          />
        </label>
      </details>
      <details>
        <summary>Resources and observation rules</summary>
        {spec.resources.map((r, i) => (
          <fieldset className="world-rule" key={r.id}>
            <legend>{r.label}</legend>
            <div className="world-grid">
              <NumberField
                label={`${r.label} starting reserve`}
                value={r.initial}
                max={r.max}
                min={r.min}
                onChange={(n) =>
                  edit((s) => {
                    s.resources[i].initial = n;
                  })
                }
              />
              <NumberField
                label={`${r.label} maximum`}
                value={r.max}
                min={1}
                onChange={(n) =>
                  edit((s) => {
                    s.resources[i].max = n;
                  })
                }
              />
            </div>
            <VisibilityField
              label={`${r.label} visibility`}
              value={r.visibility}
              roles={roles}
              locations={locations}
              onChange={(v) =>
                edit((s) => {
                  s.resources[i].visibility = v;
                })
              }
            />
          </fieldset>
        ))}
        <button
          className="btn secondary"
          disabled={spec.resources.length >= 16}
          onClick={() =>
            edit((s) => {
              s.resources.push({
                id: `resource-${s.resources.length}`,
                label: "New resource",
                initial: 10,
                min: 0,
                max: 100,
                visibility: { mode: "always" },
              });
            })
          }
        >
          Add resource
        </button>
      </details>
      <details>
        <summary>Roles and capabilities</summary>
        {spec.roles.map((r, i) => (
          <fieldset className="world-rule" key={r.id}>
            <legend>{r.label}</legend>
            <p>Only checked capabilities can reach the world validator.</p>
            <div className="world-checks">
              {spec.actions.map((a) => (
                <label key={a.id}>
                  <input
                    type="checkbox"
                    checked={r.actions.includes(a.id)}
                    onChange={(e) =>
                      edit((s) => {
                        s.roles[i].actions = e.target.checked
                          ? [...r.actions, a.id]
                          : r.actions.filter((x) => x !== a.id);
                      })
                    }
                  />
                  {a.label}
                </label>
              ))}
            </div>
            <div className="world-checks">
              {spec.resources.map((x) => (
                <label key={x.id}>
                  <input
                    type="checkbox"
                    checked={r.resources.includes(x.id)}
                    onChange={(e) =>
                      edit((s) => {
                        s.roles[i].resources = e.target.checked
                          ? [...r.resources, x.id]
                          : r.resources.filter((v) => v !== x.id);
                      })
                    }
                  />
                  {x.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </details>
      <details>
        <summary>Locations and facilities</summary>
        {spec.locations.map((l, i) => (
          <fieldset className="world-rule" key={l.id}>
            <legend>{l.label}</legend>
            <TextField
              label={`${l.label} label`}
              value={l.label}
              onChange={(v) =>
                edit((s) => {
                  s.locations[i].label = v;
                })
              }
            />
            <div className="world-checks">
              {locations
                .filter((x) => x !== l.id)
                .map((x) => (
                  <label key={x}>
                    <input
                      type="checkbox"
                      checked={l.neighbors.includes(x)}
                      onChange={(e) =>
                        edit((s) => {
                          s.locations[i].neighbors = e.target.checked
                            ? [...l.neighbors, x]
                            : l.neighbors.filter((v) => v !== x);
                        })
                      }
                    />
                    {x}
                  </label>
                ))}
            </div>
          </fieldset>
        ))}
        {spec.entities.map((e, i) => (
          <fieldset className="world-rule" key={e.id}>
            <legend>{e.label}</legend>
            <NumberField
              label={`${e.label} abstract status`}
              max={100}
              value={e.status}
              onChange={(n) =>
                edit((s) => {
                  s.entities[i].status = n;
                })
              }
            />
            <VisibilityField
              label={`${e.label} visibility`}
              value={e.visibility}
              roles={roles}
              locations={locations}
              onChange={(v) =>
                edit((s) => {
                  s.entities[i].visibility = v;
                })
              }
            />
          </fieldset>
        ))}
      </details>
      <details>
        <summary>Objectives and bounded conditions</summary>
        {spec.objectives.map((o, i) => (
          <fieldset className="world-rule" key={o.id}>
            <legend>{o.label}</legend>
            <label>
              <input
                type="checkbox"
                checked={o.critical}
                onChange={(e) =>
                  edit((s) => {
                    s.objectives[i].critical = e.target.checked;
                  })
                }
              />
              Campaign requirement
            </label>
            <PredicateField
              value={o.condition}
              refs={refs}
              label={`${o.label} condition`}
              onChange={(v) =>
                edit((s) => {
                  s.objectives[i].condition = v;
                })
              }
            />
          </fieldset>
        ))}
      </details>
      <details>
        <summary>Actions and delayed operations</summary>
        <button
          className="btn secondary"
          disabled={spec.actions.length >= 48}
          onClick={() =>
            edit((s) => {
              s.actions.push({
                id: `action-${s.actions.length}`,
                label: "New action",
                costs: [],
                condition: truth,
                effects: s.resources.length
                  ? [{ type: "resource", id: s.resources[0].id, delta: 1 }]
                  : [],
                duration: 0,
                exclusive: null,
                location: null,
              });
            })
          }
        >
          Add action
        </button>
        {spec.actions.map((a, i) => (
          <fieldset className="world-rule" key={a.id}>
            <legend>{a.label}</legend>
            <NumberField
              label={`${a.label} duration`}
              max={72}
              value={a.duration}
              onChange={(n) =>
                edit((s) => {
                  s.actions[i].duration = n;
                })
              }
            />
            {a.costs.map((c, j) => (
              <NumberField
                key={c.resource}
                label={`${a.label} ${c.resource} cost`}
                max={100000}
                value={c.amount}
                onChange={(n) =>
                  edit((s) => {
                    s.actions[i].costs[j].amount = n;
                  })
                }
              />
            ))}
            <PredicateField
              value={a.condition}
              refs={refs}
              label={`${a.label} precondition`}
              onChange={(v) =>
                edit((s) => {
                  s.actions[i].condition = v;
                })
              }
            />
            {a.effects.map((e, j) =>
              e.type === "resource" ? (
                <NumberField
                  key={j}
                  label={`${a.label} ${e.id} change`}
                  min={-100000}
                  max={100000}
                  value={e.delta}
                  onChange={(n) =>
                    edit((s) => {
                      const effect = s.actions[i].effects[j];
                      if (effect.type === "resource") effect.delta = n;
                    })
                  }
                />
              ) : e.type === "entity" ? (
                <NumberField
                  key={j}
                  label={`${a.label} ${e.id} resulting status`}
                  max={100}
                  value={e.status}
                  onChange={(n) =>
                    edit((s) => {
                      const effect = s.actions[i].effects[j];
                      if (effect.type === "entity") effect.status = n;
                    })
                  }
                />
              ) : (
                <p key={j} translate="no">
                  {e.type}:{" "}
                  {"id" in e ? e.id : "event" in e ? e.event : "world"}
                </p>
              ),
            )}
          </fieldset>
        ))}
      </details>
      <details>
        <summary>Events and long-horizon consequences</summary>
        <button
          className="btn secondary"
          disabled={spec.events.length >= 32}
          onClick={() =>
            edit((s) => {
              s.events.push({
                id: `event-${s.events.length}`,
                label: "New event",
                at: Math.min(6, s.clock.maxTicks),
                when: null,
                repeat: 0,
                maxRuns: 1,
                effects: s.resources.length
                  ? [{ type: "resource", id: s.resources[0].id, delta: -1 }]
                  : [],
                variants: [],
              });
            })
          }
        >
          Add event
        </button>
        {spec.events.map((e, i) => (
          <fieldset className="world-rule" key={e.id}>
            <legend>{e.label}</legend>
            {e.at !== null ? (
              <NumberField
                label={`${e.label} scheduled tick`}
                value={e.at}
                max={spec.clock.maxTicks}
                onChange={(n) =>
                  edit((s) => {
                    s.events[i].at = n;
                  })
                }
              />
            ) : (
              <p>Scheduled by a rule or action.</p>
            )}
            <NumberField
              label={`${e.label} recurrence`}
              value={e.repeat}
              max={10000}
              onChange={(n) =>
                edit((s) => {
                  s.events[i].repeat = n;
                })
              }
            />
            <NumberField
              label={`${e.label} maximum runs`}
              value={e.maxRuns}
              min={1}
              max={10000}
              onChange={(n) =>
                edit((s) => {
                  s.events[i].maxRuns = n;
                })
              }
            />
            {e.effects.map((effect, j) =>
              effect.type === "schedule" ? (
                <NumberField
                  key={j}
                  label={`${e.label} delayed ${effect.event}`}
                  min={1}
                  max={10000}
                  value={effect.delay}
                  onChange={(n) =>
                    edit((s) => {
                      const f = s.events[i].effects[j];
                      if (f.type === "schedule") f.delay = n;
                    })
                  }
                />
              ) : effect.type === "resource" ? (
                <NumberField
                  key={j}
                  label={`${e.label} ${effect.id} change`}
                  min={-100000}
                  max={100000}
                  value={effect.delta}
                  onChange={(n) =>
                    edit((s) => {
                      const f = s.events[i].effects[j];
                      if (f.type === "resource") f.delta = n;
                    })
                  }
                />
              ) : null,
            )}
          </fieldset>
        ))}
      </details>
      <details>
        <summary>Rules and metrics</summary>
        {spec.rules.map((r, i) => (
          <PredicateField
            key={r.id}
            label={r.id}
            value={r.when}
            refs={refs}
            onChange={(v) =>
              edit((s) => {
                s.rules[i].when = v;
              })
            }
          />
        ))}
        <p>
          Completion, reserves, recovery, coordination, information gathering
          and invalid attempts remain separate measures.
        </p>
      </details>
    </fieldset>
  );
}
