// src/lib/cloudinary.js
export async function uploadToCloudinary(file, folder = "rewards") {
  const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary não configurada (.env).");
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  if (folder) form.append("folder", folder);

  const res = await fetch(url, { method: "POST", body: form });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error?.message || "Falha no upload Cloudinary");
  }
  return json.secure_url;
}
