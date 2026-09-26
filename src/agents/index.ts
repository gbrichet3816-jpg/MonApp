import { SANTE_AGENT } from './sante/config';

// Liste de tous les agents disponibles dans l'application
export const AGENTS = [SANTE_AGENT];

export type Agent = (typeof AGENTS)[number];