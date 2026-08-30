import { NextResponse } from "next/server";

export class DocumentsWriteDisabledError extends Error {
  readonly code = "DOCUMENTS_WRITE_DISABLED";

  constructor() {
    super("Documents writes require OMO proposal and approval");
    this.name = "DocumentsWriteDisabledError";
  }
}

export function assertDocumentsWriteDisabled(): never {
  throw new DocumentsWriteDisabledError();
}

export function documentsWriteDisabledResponse(): NextResponse {
  return NextResponse.json(
    {
      code: "DOCUMENTS_WRITE_DISABLED",
      error: "Documents writes require OMO proposal and approval",
    },
    { status: 403 },
  );
}
