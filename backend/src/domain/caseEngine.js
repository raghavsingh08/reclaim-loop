import { CaseTransitionEngine } from './caseTransitionEngine.js';

// Temporary compatibility facade for workflows not yet migrated to CaseTransitionEngine.
const runInTransaction = (work) => CaseTransitionEngine.execute({
  work: ({ session }) => work(session),
});

export const CaseEngine = Object.freeze({
  runInTransaction,
  // LEGACY: do not use for new migrations; remove after all workflows migrate.
  transition: CaseTransitionEngine.transition,
});
