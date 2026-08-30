import { documentsWriteDisabledResponse } from "@/lib/write-policy";

export async function POST(_request: Request) {
  return documentsWriteDisabledResponse();
}
