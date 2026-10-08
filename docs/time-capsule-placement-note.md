# Time Capsule Placement Note

Date: 2026-05-23

The "time capsule" creation controls were temporarily removed from the main editor surface. The underlying `unlockAt` model and reader/archive behavior should remain intact so existing locked memories still behave correctly.

Keep this concept. It is important, but it should probably live closer to a deliberate memory-management moment rather than the default writing flow.

Candidate placements:

- Entry detail or viewer actions: "seal until..." after a memory has been written.
- Archive / encrypted cabin toolbar: batch-oriented capsule controls for selected entries.
- Advanced composer drawer: hidden behind an explicit "advanced" affordance, away from the primary writing rhythm.

Current preference: place it in the entry detail/viewer actions first. Time-locking feels like a reflective decision made after seeing the memory, not a default requirement before saving.
