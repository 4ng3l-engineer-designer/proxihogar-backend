// src/utils/storage.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_EXPIRES_SECONDS = 3600; // 1 hora

let supabaseClient: SupabaseClient | null = null;

/**
 * Valida que las variables de entorno de Supabase Storage estén definidas.
 * Lanza un error claro sin exponer valores sensibles.
 */
export function validateStorageConfig(): void {
  const missing: string[] = [];
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.trim() === "") {
    missing.push("SUPABASE_URL");
  }
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim() === ""
  ) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.SUPABASE_BUCKET || process.env.SUPABASE_BUCKET.trim() === "") {
    missing.push("SUPABASE_BUCKET");
  }

  if (missing.length > 0) {
    throw new Error(
      `FATAL: Faltan variables de entorno requeridas para Supabase Storage: ${missing.join(", ")}.`
    );
  }
}

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    validateStorageConfig();
    const rawUrl = process.env.SUPABASE_URL!.trim();
    const normalizedUrl = new URL(rawUrl).origin;
    supabaseClient = createClient(
      normalizedUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return supabaseClient;
}

function getBucketName(): string {
  validateStorageConfig();
  return process.env.SUPABASE_BUCKET!.trim();
}

/**
 * Sube un buffer al bucket de Supabase Storage en la ruta especificada.
 */
export async function uploadToStorage(
  filePath: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const client = getSupabaseClient();
  const bucket = getBucketName();

  const { error } = await client.storage.from(bucket).upload(filePath, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error("Error al subir archivo a almacenamiento.");
  }
}

/**
 * Genera un enlace firmado temporal (por defecto válido 1 hora) para un archivo en el bucket.
 */
export async function createSignedStorageUrl(
  filePath: string,
  expiresInSeconds: number = SIGNED_URL_EXPIRES_SECONDS
): Promise<{ url: string; expiraEn: Date }> {
  const client = getSupabaseClient();
  const bucket = getBucketName();

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error("Error al generar enlace firmado.");
  }

  const expiraEn = new Date(Date.now() + expiresInSeconds * 1000);
  return {
    url: data.signedUrl,
    expiraEn,
  };
}

/**
 * Elimina uno o más archivos del bucket de Supabase Storage.
 */
export async function deleteFromStorage(filePaths: string[]): Promise<void> {
  const validPaths = filePaths.filter((p) => typeof p === "string" && p.trim() !== "");
  if (validPaths.length === 0) {
    return;
  }

  const client = getSupabaseClient();
  const bucket = getBucketName();

  const { error } = await client.storage.from(bucket).remove(validPaths);
  if (error) {
    console.error("[storage] No se pudieron eliminar archivos del bucket.");
  }
}

