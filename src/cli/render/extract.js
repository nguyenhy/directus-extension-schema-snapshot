/**
 * Prints an extract view (from core/present/extract.js) as CLI text.
 * @param {ReturnType<import('../../core/present/extract').buildExtractView>} view
 */
function printExtractView(view) {
  const prefix = view.mode === 'added' ? '+' : view.mode === 'modified' ? '~' : '-';
  for (const key of view.keys) {
    console.log(`${prefix} ${key}`);
  }
  const target = view.file || view.dir;
  console.log(`\n${view.count} ${view.mode}${view.file ? ' snapshot' : ''} -> ${target}`);
  if (view.verification) printVerification(view.verification);
}

/**
 * Prints a pass/fail line for a merge verification result (see
 * core/operations/extract.js's verifyMerge).
 * @param {{ok: boolean, unexpectedAdded: string[], unexpectedRemoved: string[], unexpectedModified: string[], missingKeys: string[]}} verification
 */
function printVerification(verification) {
  if (verification.ok) {
    console.log('✓ merge verified');
    return;
  }
  const details = [];
  if (verification.unexpectedAdded.length) details.push(`unexpectedAdded: ${verification.unexpectedAdded.join(', ')}`);
  if (verification.unexpectedRemoved.length) details.push(`unexpectedRemoved: ${verification.unexpectedRemoved.join(', ')}`);
  if (verification.unexpectedModified.length) details.push(`unexpectedModified: ${verification.unexpectedModified.join(', ')}`);
  if (verification.missingKeys.length) details.push(`missingKeys: ${verification.missingKeys.join(', ')}`);
  console.log(`✗ merge verification failed: ${details.join('; ')}`);
}

module.exports = { printExtractView, printVerification };
