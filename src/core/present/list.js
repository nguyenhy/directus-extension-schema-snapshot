/**
 * Builds a render-agnostic view of the version list.
 * @param {{id: string, timestamp: string, message: string}[]} versions - newest first
 * @returns {{count: number, versions: {id: string, shortId: string, timestamp: string, message: string}[]}}
 */
function buildListView(versions) {
  return {
    count: versions.length,
    versions: versions.map((v) => ({
      id: v.id,
      shortId: v.id.slice(0, 7),
      timestamp: new Date(v.timestamp).toISOString().replace('T', ' ').slice(0, 19),
      message: v.message,
    })),
  };
}

module.exports = { buildListView };
