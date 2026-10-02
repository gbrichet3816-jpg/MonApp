// src/agents/index.ts
// Liste centrale des agents disponibles

import { PROF_AGENT } from './prof/config';
import { SANTE_AGENT } from './sante/config';

export const AGENTS = [SANTE_AGENT, PROF_AGENT];

export type Agent = (typeof AGENTS)[number];