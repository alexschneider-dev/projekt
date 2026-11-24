import { apiHandler } from "@/lib/http";
import {
  list,
  create
} from "@/lib/catalog/master-data-api";


export const GET = apiHandler(list);
export const POST = apiHandler(create);
