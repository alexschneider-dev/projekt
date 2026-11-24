import { apiHandler } from "@/lib/http";
import {
  read,
  update,
  deactivate
} from "@/lib/catalog/master-data-api";


export const GET = apiHandler(read);
export const PATCH = apiHandler(update);
export const DELETE = apiHandler(deactivate);
