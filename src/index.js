// Package entry point. Placeholder barrel — curated public API surface
// lands in a later migration step (see docs/roadmap-draft.md). For now
// re-exports the composition root only, matching current internal usage.
const { createEnv } = require('./core/env');

module.exports = { createEnv };
