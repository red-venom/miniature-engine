// index.ts — every template the gallery shows: one array for each group.
// Authors add templates to their group file. Nobody needs to edit this file.

import { biology } from './biology'
import { chemistry } from './chemistry'
import { general } from './general'
import { labs } from './labs'
import { physics } from './physics'
import type { TemplateDef } from './types'

export const TEMPLATES: TemplateDef[] = [...general, ...chemistry, ...labs, ...biology, ...physics]
