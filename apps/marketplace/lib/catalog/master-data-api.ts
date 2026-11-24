import { checkOrigin } from "@/lib/http/check-origin";
import { requireRole } from "@/lib/auth/api-guard";
import { SUPER_ADMIN } from "@/lib/auth/roles";
import { checkApiParams } from "@/lib/http/check-api-params";
import { checkApiQuery } from "@/lib/http/check-api-query";
import { checkApiRequest } from "@/lib/http/check-api-request";
import { successResponse } from "@/lib/http";
import {
  HTTP_STATUS
} from "@/lib/http/errors";
import {
  dictionaryParamsSchema,
  optionParamsSchema,
  optionQuerySchema,
  optionBodySchema
} from "@/lib/schemas/master-data";
import {
  listOptions,
  getOption,
  createOption,
  updateOption
} from "./master-data";


export type DictionaryContext = { params: Promise<{ dictionary: string }> };
export type OptionContext = {
  params: Promise<{
    dictionary: string;
    id: string
  }>
};

function response(data: unknown, status: number = HTTP_STATUS.OK) {
  const result = successResponse(data, status);
  result.headers.set("Cache-Control", "no-store");

  return result;
}

async function writeGate(request: Request) {
  const apiGate = await requireRole(SUPER_ADMIN);
  if (!apiGate.ok) return apiGate;

  checkOrigin(request);

  return apiGate;
}

export async function list(request: Request, context: DictionaryContext) {
  const params = await checkApiParams(await context.params, dictionaryParamsSchema);
  if (!params.ok) return params.response;

  const query = await checkApiQuery(request, optionQuerySchema);
  if (!query.ok) return query.response;

  const includeInactive = query.data.includeInactive === "true";

  if (includeInactive) {
    const apiGate = await requireRole(SUPER_ADMIN);
    if (!apiGate.ok) return apiGate.response;
  }

  return response(await listOptions(params.data.dictionary, query.data.categoryId, includeInactive));
}

export async function read(request: Request, context: OptionContext) {
  const params = await checkApiParams(await context.params, optionParamsSchema);
  if (!params.ok) return params.response;

  const option = await getOption(params.data.dictionary, params.data.id);

  if (!option.active) {
    const apiGate = await requireRole(SUPER_ADMIN);
    if (!apiGate.ok) return apiGate.response;
  }

  return response(option);
}

export async function create(request: Request, context: DictionaryContext) {

  const apiGate = await writeGate(request);
  if (!apiGate.ok) return apiGate.response;

  const params = await checkApiParams(await context.params, dictionaryParamsSchema);
  if (!params.ok) return params.response;

  const query = await checkApiQuery(request, optionQuerySchema);
  if (!query.ok) return query.response;

  const body = await checkApiRequest(request, optionBodySchema);
  if (!body.ok) return body.response;

  return response(await createOption(params.data.dictionary, query.data.categoryId, body.data), HTTP_STATUS.CREATED);
}

export async function update(request: Request, context: OptionContext) {
  const apiGate = await writeGate(request);
  if (!apiGate.ok) return apiGate.response;

  const params = await checkApiParams(await context.params, optionParamsSchema);
  if (!params.ok) return params.response;

  const body = await checkApiRequest(request, optionBodySchema);
  if (!body.ok) return body.response;

  return response(await updateOption(params.data.dictionary, params.data.id, body.data));
}

export async function deactivate(request: Request, context: OptionContext) {
  const apiGate = await writeGate(request);
  if (!apiGate.ok) return apiGate.response;

  const params = await checkApiParams(await context.params, optionParamsSchema);
  if (!params.ok) return params.response;

  return response(await updateOption(params.data.dictionary, params.data.id, { active: false }));
}
