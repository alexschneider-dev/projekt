import { prisma } from "@/lib/prisma";
import { createApiError } from "@/lib/http/errors";
import { ERROR_MASTER_DATA } from "@/lib/http/errors/master-data";
import type { OptionInput } from "@/lib/schemas/master-data";
import {
  dictionaries,
  type Dictionary
} from "./dictionaries";


export async function listOptions(dictionary: Dictionary, categoryId: string, includeInactive = false) {
  return prisma.attributeOption.findMany({
    where: {
      definition: {
        categoryId,
        key: dictionaries[dictionary].key
      },
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [
      { label: "asc" },
      { id: "asc" }
    ],
  });
}

export async function getOption(dictionary: Dictionary, id: string) {
  const option = await prisma.attributeOption.findFirst({
    where: {
      id,
      definition: { key: dictionaries[dictionary].key }
    },
  });
  if (!option) throw createApiError(ERROR_MASTER_DATA.NOT_FOUND);

  return option;
}

export async function createOption(dictionary: Dictionary, categoryId: string, data: OptionInput) {
  const definition = await prisma.attributeDefinition.findUnique({
    where: {
      categoryId_key: {
        categoryId,
        key: dictionaries[dictionary].key
      }
    },
  });
  if (!definition) throw createApiError(ERROR_MASTER_DATA.NOT_FOUND);

  return prisma.attributeOption.create({
    data: {
      ...data,
      attributeId: definition.id
    }
  });
}

export async function updateOption(dictionary: Dictionary, id: string, data: Partial<OptionInput>) {
  await getOption(dictionary, id);

  return prisma.attributeOption.update({
    where: { id },
    data
  });
}

export async function getChairFilters() {
  const [
    material,
    color,
    kind
  ] = await Promise.all([
    listOptions("materials", "chairs"),
    listOptions("colors", "chairs"),
    listOptions("chair-types", "chairs")
  ]);

  return {
    material: {
      label: "Material",
      values: material
    },
    color: {
      label: "Farbe",
      values: color
    },
    kind: {
      label: "Stuhltyp",
      values: kind
    },
  };
}

export type MasterDataOption = Awaited<ReturnType<typeof getOption>>;
export type ChairFilters = Awaited<ReturnType<typeof getChairFilters>>;
