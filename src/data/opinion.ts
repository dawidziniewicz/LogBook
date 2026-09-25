/** dozwolone wartości z arkusza „Wartości dozwolone” (opinia z rejsu AKŻ AGH) */
export const GRADES = ['Brak', 'Żeglarz Jachtowy', 'Sternik Jachtowy', 'Jachtowy Sternik Morski', 'Kapitan Jachtowy'];
export const ROLES = ['Kapitan', 'Pierwszy oficer', 'Drugi Oficer', 'Trzeci Oficer', 'Oficer Wachtowy', 'Załoga', 'Kuk', 'Mechanik', 'Bosman'];
export const DUTIES = ['Bardzo dobrze', 'Dobrze', 'Miernie', 'Niewłaściwie'];
export const SEASICK = { m: ['Nie podlegał', 'Chorował, ale mógł pracować', 'Chorował, co wykluczało pracę'], f: ['Nie podlegała', 'Chorowała, ale mogła pracować', 'Chorowała, co wykluczało pracę'] };
export const RESILIENCE = ['Dobra', 'Średnia', 'Słaba', 'Nie wystąpiły trudne warunki'];
export const TRAINING_FOR = ['Sternika Jachtowego', 'Jachtowego Sternika Morskiego', 'Kapitana Jachtowego', 'Nie dotyczy'];

export const DEFAULT_CLUB_HEADER = 'Akademicki Klub Żeglarski AGH\nul. Reymonta 21a\n30-059 Kraków';

/** funkcja dla nowo dodawanej osoby: kolejno I, II, III oficer (pierwsza wolna), potem załoga */
export function nextDefaultRole(crew: { role: string }[]) {
  const taken = (r: string) => crew.some((m) => m.role.trim().toLowerCase() === r.toLowerCase());
  return ['Pierwszy oficer', 'Drugi Oficer', 'Trzeci Oficer'].find((r) => !taken(r)) ?? 'Załoga';
}

/** ranga funkcji na jachcie: 0 kapitan, 1–3 oficerowie, dalej reszta załogi */
export function roleRank(role: string) {
  const r = role.trim().toLowerCase();
  if (/kapitan|captain|skipper/.test(r)) return 0;
  if (/^(i|1)\.?\s*oficer|pierwszy|first/.test(r)) return 1;
  if (/^(ii|2)\.?\s*oficer|drugi|second/.test(r)) return 2;
  if (/^(iii|3)\.?\s*oficer|trzeci|third/.test(r)) return 3;
  if (/oficer|officer|mate/.test(r)) return 4;
  if (/bosman|mechanik|kuk/.test(r)) return 5;
  return 6;
}

/** ranga stopnia żeglarskiego: wyższy stopień = mniejsza liczba */
export function gradeRank(grade: string) {
  const g = grade.trim().toLowerCase();
  if (/kapitan/.test(g)) return 0;
  if (/morski/.test(g)) return 1;
  if (/sternik/.test(g)) return 2;
  if (/żeglarz/.test(g)) return 3;
  return 4;
}

/** czy stopień jest „pusty” (nie wypisywać go w opinii) */
export const noGrade = (grade?: string) => !grade?.trim() || /^(brak|nie dotyczy|none|-|—)$/i.test(grade.trim());
