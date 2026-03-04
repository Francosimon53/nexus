export const PROTOCOL_VERSION = '0.1.0' as const;
export {
  computeComponents,
  computeTrustScore,
  recalculateTrust,
  type TrustProfile,
} from './trust.js';
