# Agent Academy guide

The Controller Lab and Learning Rover remain the quickest starting points. Try
an incomplete controller, train it, then evaluate on separate trials. Read the
failure explanation and replay before revising it. Academy experiments never
grant game XP or label a person’s intelligence.

For deeper inspection, open **Experiment lab** (`#/academy?tab=lab`). Choose one
of the five environments, an inspectable curriculum, seed and method. Existing
profile champions/rover values are available; **Use authored baseline** supplies
the documented teaching strategy. Frozen comparison changes no values. Rule
search selects nearby policies only from TRAIN. Q-learning adds up to 1,000
TRAIN episodes to a copied value table; its result is a separate lab package,
so the ordinary Learning Rover record is preserved.

**Run experiment** measures eight TRAIN, eight VALIDATION, eight ordinary
HOLDOUT and eight changed HOLDOUT trials. The last report is transfer. Read the
variant description before interpreting its delta or failures. Validation can
help choose a curriculum; treat holdout as a final check. Repeated tuning on
holdout makes it another development set. These are small fictional tasks.

**Record one episode** is faster when you want to understand a controller.
The trace inspector shows a precise vector map beside the 3D view, world seed,
chosen/executed action, step reward, controller-provided reason, terminal reason,
optional Q-values, observation, available actions/events, changed state and
hashes. At tick zero no action has occurred. Previous/next buttons and the
scrubber move through the recording without changing it. **Verify replay**
reruns every intent through the rules, including deterministic wind.

Use **Export controller package**, **Export episode receipt** and **Export
experiment manifest** for local files. Importing a receipt verifies it before
replacing the saved recording. Importing a manifest reruns the original
experiment and checks its stored result/hash evidence. Mismatches preserve
the last saved result. Legacy arena policy JSON is also accepted. Imported
files never run code or contact a model provider.

Three recent manifests, one controller and one verified receipt stay with the
current local profile and travel with validated progress/Academy backups.
Unfinished runs resume stopped. Pause academy, hide the tab, switch tools or
leave the page to stop active work. Shared devices can use separate anonymous
profiles. Nothing from the notebook uploads automatically; online controller
submission remains a separate explicit action.

Keyboard tab navigation, touch controls, English/Spanish, high contrast,
reduced motion and vector fallback apply here too. JSON displays preserve
technical ids for reproducibility. Online commons still requires a separately
configured service; the current public site reports setup pending accurately.

## Agent Garage

Open **Agent garage** or `#/academy?tab=garage`. Start with the offline mock and
Survey. Step once: scanning spends one tick and two energy to reveal one site.
Compare proposed, validated and executed actions, then inspect the receipt.
Illegal output spends a request/retry budget while leaving the world unchanged.

Try Community Restore with a model and reference controller; each role has its
own turn and capabilities, so both are needed. Try Signal Maze and notice that
fictional signs cannot replace the mission. Pause, take manual control and hand
back to a reference/model controller without resetting the world.

Frozen comparisons use identical world seeds for candidate and baseline, with
practice, validation, final holdout and transfer kept separate. No model weight
or prompt is changed. A notebook contains short public facts/plans/alerts, not
private reasoning. Receipt replay repeats world actions; a fresh model request
may differ. English/Spanish, keyboard tabs, small screens, vector fallback and
reduced motion remain supported. Runs award no game XP.

Ollama is optional: [connect a local bridge](agent-bridge.md), explicitly choose
an installed model, and set time/request limits. No model/cloud account is
required for the Garage, and unavailable providers remain explicit errors.

## World authoring and Town Zero

Open **World authoring lab** (`#/academy?tab=worlds`). Choose Reserve Lesson for
12 steps or Town Zero for 7/14/30 simulated days. Forms edit bounded resources,
role capabilities, visibility, graph locations, objectives, actions and events.
Validation errors identify fields; an invalid draft cannot start. The preview
summary and content hash describe the exact compiled rules. Export/import packs
for local exchange; files do not install plugins or execute code.

Choose a baseline, human + baseline, offline mock, or explicitly connected local
team. Each role has separate authority, memory, context and request accounting.
The operator role selector lets one human rotate or replace roles. Simultaneous
human teams stage each intent before **Resolve staged human intents**. To assign
different installed models, select a role/model and hand that role to the selected
local model. Connect/model selection alone does not infer or download anything.

Step, run to a day/event/decision boundary or use a tick cap. Pause, stop or hide
the page to halt active work. Refresh/import restores stopped. Costs occur when
a delayed operation starts; effects complete later. The operations board shows
operator state, while the role panel shows only the selected controller's public
observation. Hidden resources may appear as buckets until a paid inspection.

The causal timeline has event/objective/failure/handoff/checkpoint jumps and
source/target/type/cause filtering. Each frame shows proposals, validation,
resource changes and resulting hashes. Inspecting an old frame leaves the live
run unchanged. Public plans/notebooks are explicit annotations, not private
reasoning or proof that a plan was followed. Verify and export long receipts.

Compare frozen baselines or public context strategies in an offline worker.
Read each partition's sample count, range, mean/median, success and failures.
Expand **Individual frozen trials** to recreate a trial and check its receipt
hash. Saved summaries are not signed model results. Repeated tuning against
holdout contaminates that interpretation. Results never award game XP or rank
human intelligence. [Authoring/SDK](world-authoring.md) and [Town Zero](town-zero.md)
explain the data and model limits.
