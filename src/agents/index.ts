import { SANTE_AGENT } from './sante/config';

export const AGENTS = [SANTE_AGENT];

export type Agent = (typeof AGENTS)[number];