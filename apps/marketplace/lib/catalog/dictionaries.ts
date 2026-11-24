import { ROUTES } from "@/lib/constants/routes";


export const dictionaries = {
  materials: {
    key: "material",
    label: "Materialien",
    api: ROUTES.materialsApi,
    href: ROUTES.adminMaterials,
    section: "materialien",
    singular: "Material"
  },
  colors: {
    key: "color",
    label: "Farben",
    api: ROUTES.colorsApi,
    href: ROUTES.adminColors,
    section: "farben",
    singular: "Farbe"
  },
  "chair-types": {
    key: "kind",
    label: "Stuhltypen",
    api: ROUTES.chairTypesApi,
    href: ROUTES.adminChairTypes,
    section: "stuhltypen",
    singular: "Stuhltyp"
  },
  "model-names": {
    key: "model",
    label: "Modellnamen",
    api: ROUTES.modelNamesApi,
    href: ROUTES.adminModelNames,
    section: "modellnamen",
    singular: "Modellname"
  },
} as const;

export type Dictionary = keyof typeof dictionaries;

export function dictionaryForSection(section: string): Dictionary | undefined {
  return (Object.keys(dictionaries) as Dictionary[]).find((key) => dictionaries[key].section === section);
}
