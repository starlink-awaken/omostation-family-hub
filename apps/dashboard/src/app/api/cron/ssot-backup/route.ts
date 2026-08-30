import { documentsWriteDisabledResponse } from "@/lib/write-policy";

export async function GET(_request: Request) {
  return documentsWriteDisabledResponse();
}
