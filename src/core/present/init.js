/**
 * Builds a render-agnostic view of an `init` result.
 * @param {{dir: string, envPath: string, envCreated: boolean, envReused: boolean, filesCreated: string[]}} params
 * @returns {{dir: string, envPath: string, envCreated: boolean, envReused: boolean, filesCreated: string[]}}
 */
function buildInitView({ dir, envPath, envCreated, envReused, filesCreated }) {
  return { dir, envPath, envCreated, envReused, filesCreated };
}

module.exports = { buildInitView };
