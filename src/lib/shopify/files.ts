import { shopifyAdminFetch } from '@/lib/shopify/admin';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function uploadShopifyImage(file: File, alt: string): Promise<string> {
  if (!ALLOWED.has(file.type)) throw new Error('Please upload a JPG, PNG, WebP, or GIF image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be smaller than 5MB.');

  const staged = await shopifyAdminFetch<{
    stagedUploadsCreate: {
      stagedTargets: { url: string; resourceUrl: string; parameters: { name: string; value: string }[] }[];
      userErrors: { message: string }[];
    };
  }>(
    `#graphql
      mutation LayaliStage($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }
    `,
    {
      input: [
        {
          filename: file.name || 'image.jpg',
          mimeType: file.type,
          resource: 'IMAGE',
          httpMethod: 'POST',
          fileSize: String(file.size),
        },
      ],
    }
  );
  const target = staged.data.stagedUploadsCreate.stagedTargets?.[0];
  const stageErrors = staged.data.stagedUploadsCreate.userErrors || [];
  if (!target || stageErrors.length) {
    throw new Error(stageErrors.map((error) => error.message).join('; ') || 'Could not stage the upload');
  }

  const form = new FormData();
  for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
  form.append('file', file);
  const uploaded = await fetch(target.url, { method: 'POST', body: form });
  if (!uploaded.ok) throw new Error('Image upload was rejected');

  const created = await shopifyAdminFetch<{
    fileCreate: {
      files: { id: string }[];
      userErrors: { message: string }[];
    };
  }>(
    `#graphql
      mutation LayaliFileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id }
          userErrors { field message }
        }
      }
    `,
    { files: [{ originalSource: target.resourceUrl, contentType: 'IMAGE', alt }] }
  );
  const fileErrors = created.data.fileCreate.userErrors || [];
  const fileId = created.data.fileCreate.files?.[0]?.id;
  if (!fileId || fileErrors.length) {
    throw new Error(fileErrors.map((error) => error.message).join('; ') || 'Could not create the file');
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ready = await shopifyAdminFetch<{
      node: { image?: { url?: string | null } | null } | null;
    }>(
      `#graphql
        query LayaliFile($id: ID!) {
          node(id: $id) {
            ... on MediaImage { image { url } }
          }
        }
      `,
      { id: fileId },
      { retries: 0, timeoutMs: 10_000 }
    );
    const url = ready.data.node?.image?.url;
    if (url) return url;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error('The image is still processing. Try again in a moment.');
}
