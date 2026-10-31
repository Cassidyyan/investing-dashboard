import { getConfig } from "@/server/config";
import { createWealthsimpleDataset } from "@/server/wealthsimple-dataset";
import { csvOptionsSource } from "@/server/csv-options-source";

export const runtime = "nodejs";
const MAX_BYTES = 10_000_000;
const MAX_BODY = MAX_BYTES + 65_536;
function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Stateless: no disk writes, session store, brokerage calls or shared imports.
export async function POST(request: Request) {
  if (getConfig().settings.demo)
    return json(
      {
        error:
          "Uploads are disabled in demo mode. Turn demo mode off to use your own exports.",
      },
      403,
    );
  const url = new URL(request.url);
  let origin: URL;
  try {
    origin = new URL(request.headers.get("origin") || "");
  } catch {
    return json({ error: "Upload must come from this app." }, 403);
  }
  // Next's internal URL can use localhost while the browser uses 127.0.0.1.
  // The Host header represents the actual request authority in that case.
  if (
    origin.host !== (request.headers.get("host") || url.host) ||
    origin.protocol !== url.protocol
  )
    return json({ error: "Upload must come from this app." }, 403);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    return json({ error: "Select a Wealthsimple activity CSV." }, 415);
  if (Number(request.headers.get("content-length")) > MAX_BODY)
    return json({ error: "Upload limit is 10 MB in total." }, 413);
  try {
    // Bound even chunked requests before the multipart parser allocates a body.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "No files received." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        return json({ error: "Upload limit is 10 MB in total." }, 413);
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type")! },
      body,
    }).formData();
    const files = form.getAll("files");
    if (
      !files.length ||
      files.length > 20 ||
      files.some(
        (file) =>
          !(file instanceof File) ||
          !/\.csv$/i.test(file.name) ||
          file.size === 0,
      )
    )
      return json(
        { error: "Choose 1–20 non-empty .csv activity exports." },
        422,
      );
    const uploads = files as File[];
    if (uploads.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES)
      return json({ error: "Upload limit is 10 MB in total." }, 413);
    const dataset = createWealthsimpleDataset(
      await Promise.all(
        uploads.map(async (file) => ({ text: await file.text() })),
      ),
    );
    // Reject the entire batch instead of silently installing a partial import.
    if (
      dataset.preview.warnings.some(
        (warning) => !warning.includes("identical file already previewed"),
      )
    )
      return json(
        {
          error:
            "Import not applied. Use Wealthsimple activity exports with valid rows, up to 20,000 rows total. Unsupported or malformed files need correction.",
        },
        422,
      );
    if (dataset.activities.some((row) => row.option && !row.accountId))
      return json(
        {
          error:
            "Import not applied. Every option row needs a source account ID.",
        },
        422,
      );
    const data = csvOptionsSource(dataset);
    if (!data || !data.trades.length)
      return json(
        {
          error:
            "No recognizable options activity found. Use a Wealthsimple activity export containing option contracts; gain/loss reports are not supported.",
        },
        422,
      );
    return json({ data });
  } catch {
    return json(
      {
        error:
          "Import not applied. The upload could not be read as a Wealthsimple activity CSV.",
      },
      422,
    );
  }
}
