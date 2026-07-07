/**
 * Builds a render-agnostic view of an `init` result.
 * @param {{dir: string, envPath: string, envCreated: boolean, filesCreated: string[]}} params
 * @returns {{dir: string, envPath: string, envCreated: boolean, filesCreated: string[]}}
 */
function buildInitView({ dir, envPath, envCreated, filesCreated }) {
  return { dir, envPath, envCreated, filesCreated };
}

module.exports = { buildInitView };
