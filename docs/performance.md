# Synthetic performance contracts

V11 supplies a local original music workflow in the advanced Agent Locker. It
uses the shared action boundary: a model proposes and the world decides.

## Artifacts and authority

| Contract | Meaning |
| --- | --- |
| `score-spec@1` | Original data-only notes, meter, tempo map, chord changes, parts, syllables and conductor cues; existing import shape retained. |
| `family-config@1` | Original V10 authority and replay semantics. |
| `family-config@2` | Registered V11 ensemble or scored Stunt Show/Stream Studio authority. No other family silently upgrades. |
| `synthetic-voice@1` | Fictional voice ID, MIDI range, timbre, formants, brightness, breathiness, vibrato, envelope and stereo position. |
| `performance-bundle@1` | Complete replay-verified native performance, matching bounded voice profiles and fixed render settings. |
| `audio-performance@1` | Recording/score/profile/settings hashes and the hashes, frame count and byte count of actual WAV/MIDI outputs. |

V11 enforces ordered chord changes, declared voice ranges and syllables, unique
voice identities, unambiguous cue windows, entry/final cutoff, and a maximum
32-second score. Every part proposes before a beat advances. Provider response
order cannot change logical score time. Entry/dynamics/cutoff operate through the
conductor's legal actions, not direct mutation of another controller.

Choir includes soprano, alto, tenor, bass, rhythm and accompaniment plus conductor.
Band includes drums, bass, keys, lead, texture and voice. Call and response uses
alternating original phrase windows. Composition creates eight constrained bars
under the chosen key, meter and chord relationships. These modes do not add
ordinary player XP, certifications or intelligence rankings.

## Local synthesis and export

The original formant synthesizer combines bounded harmonics, deterministic
breath/noise, vibrato, envelopes and stereo gains. It approximates vowels; it is
not speech synthesis or a real-person voice model. Other parts use original
oscillator/percussion synthesis. There are no prerecorded samples or licensed
song/lyric dependencies.

Rendering runs in a worker and stays independent of authoritative simulation.
It accepts at most 1.25 MB of bundle data, seven profiles and 1.5 million stereo
frames. Allowed sample rates are 22,050 and 44,100 Hz. Gain is bounded. WAV is
16-bit stereo PCM; MIDI is a standard format-zero track with tempo/meter events
and performed notes. Recorded errors remain audible/exported errors.

Score replay verifies actions and transitions. The WAV hash identifies the exact
exported bytes. Re-rendering in another engine may vary because math functions
and floating-point implementations differ; an audio verification mismatch does
not imply that score replay failed. Hashes identify content, not an authenticated
person or provider.

Profiles and render settings travel in explicitly exported bundles. The native
recording remains in the existing Locker archive. Audio buffers and profile
edits are transient until exported; no hidden second archive or upload is added.
Listening review is an explicitly saved, source-backed episode note with the
source partition retained.

## Cross-world handoff and optional bus

An owned verified music-score artifact can be admitted to V11 Stunt Show or
Stream Studio by the existing provenance/evaluation boundary. The scored media
wrapper records the actual source score, hash, cue role and logical beat. This
does not publish a show or change the destination's completion rules.

`PerformanceBus` defines explicit prepare/acknowledge/stop operations. A supplied
adapter must declare synthetic-only operation and acknowledge the validated
bundle hash. Abort and mismatched acknowledgements fail. This is a generic seam
compatible with an optional Commonline integration; no Commonline repository/API
has been qualified or connected in this build. No endpoint or credentials are
imported from a score. The studio works without the bus.

## Commands

```sh
npm run performance:compose -- --mode band --key 2 --tempo 120 --meter 3 --out score-config.json
npm run performance:run -- --mode choir --controller mock --out choir-bundle.json
npm run performance:verify -- --input choir-bundle.json
npm run performance:render -- --input choir-bundle.json --out audio-output
npm run family:run -- ensemble-lab --input score-config.json
```

Render exports are local files. CLI file access is the operator's explicit
command argument, never a path or command imported from an artifact.
