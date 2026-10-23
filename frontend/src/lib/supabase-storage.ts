const baseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "research-papers";

function storageConfig() {
  if (!baseUrl || !secretKey) throw new Error("Supabase Storage is not configured");
  return {
    base: `${baseUrl.replace(/\/$/, "")}/storage/v1`,
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  };
}

function encodeObjectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function uploadPrivatePdf(
  projectId: string,
  paperId: string,
  filename: string,
  bytes: Buffer
) {
  if (bytes.byteLength === 0 || bytes.byteLength > 15 * 1024 * 1024) {
    throw new Error("PDF must be between 1 byte and 15 MB");
  }
  if (bytes.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error("Downloaded file is not a valid PDF");
  }

  const { base, headers } = storageConfig();
  const bucketInfo = await fetch(`${base}/bucket/${encodeURIComponent(bucket)}`, { headers });
  if (!bucketInfo.ok) throw new Error("Could not verify the Supabase Storage bucket");
  const settings = await bucketInfo.json();
  if (
    settings.public !== false ||
    settings.file_size_limit > 15 * 1024 * 1024 ||
    !settings.allowed_mime_types?.includes("application/pdf")
  ) {
    throw new Error("Supabase bucket must be private and allow files up to 15 MB");
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${projectId}/${paperId}/${safeFilename}`;
  const response = await fetch(
    `${base}/object/${encodeURIComponent(bucket)}/${encodeObjectPath(storagePath)}`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/pdf", "x-upsert": "true" },
      body: new Uint8Array(bytes),
    }
  );
  if (!response.ok) throw new Error(`Supabase PDF upload failed (${response.status})`);
  return { bucket, storagePath };
}

export async function createPrivatePdfUrl(storageBucket: string, storagePath: string) {
  const { base, headers } = storageConfig();
  const response = await fetch(
    `${base}/object/sign/${encodeURIComponent(storageBucket)}/${encodeObjectPath(storagePath)}`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 60 }),
    }
  );
  if (!response.ok) throw new Error("Could not create a private PDF download link");
  const result = (await response.json()) as { signedURL?: string };
  if (!result.signedURL) throw new Error("Supabase returned no PDF download link");
  return new URL(result.signedURL.replace(/^\/+/, ""), `${base}/`).toString();
}

export async function removePrivateObject(storageBucket: string, storagePath: string) {
  const { base, headers } = storageConfig();
  await fetch(
    `${base}/object/${encodeURIComponent(storageBucket)}`,
    {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [storagePath] }),
    }
  );
}
