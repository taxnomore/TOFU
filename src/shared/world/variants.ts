// "Ambiances": variants of the same neighborhood. Each one changes the look of
// the world and adds its own mischief (leaf piles, snowmen, market stalls).

export type Variant = 'ete' | 'automne' | 'hiver' | 'marche';

export interface VariantDef {
  id: Variant;
  name: string;
  icon: string;
  /** One line for the setup screens. */
  desc: string;
}

export const VARIANTS: VariantDef[] = [
  { id: 'ete', name: 'Été', icon: '☀️', desc: 'Le quartier comme d’habitude : linge au soleil et fleurs à arroser.' },
  { id: 'automne', name: 'Automne', icon: '🍂', desc: 'Des tas de feuilles à éparpiller, et des feuilles plein les poils.' },
  { id: 'hiver', name: 'Hiver', icon: '❄️', desc: 'De la neige partout, des pattes mouillées et des bonshommes de neige.' },
  { id: 'marche', name: 'Jour de marché', icon: '🧀', desc: 'Des étals sur le square : fromage, saucisson et poulet rôti…' },
];

export const DEFAULT_VARIANT: Variant = 'ete';

export function isVariant(v: unknown): v is Variant {
  return typeof v === 'string' && VARIANTS.some((d) => d.id === v);
}

export function variantDef(v: Variant): VariantDef {
  return VARIANTS.find((d) => d.id === v) ?? VARIANTS[0];
}

/** Map entries tagged with `only` exist in those ambiances alone. */
export function presentIn(only: readonly Variant[] | undefined, v: Variant): boolean {
  return !only || only.includes(v);
}

/** Outdoor zones covered with snow in winter (the street is cleared). */
export const SNOWY_ZONES = ['jardin', 'terrasse', 'devant', 'allee', 'square', 'voisins'];
