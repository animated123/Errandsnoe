
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  return process.env[key];
};

export const cloudinaryConfig = {
  cloudName: getEnv('VITE_CLOUDINARY_CLOUD_NAME'),
  uploadPreset: getEnv('VITE_CLOUDINARY_UPLOAD_PRESET') || 'errands_unsigned'
};

class CloudinaryService {
  async uploadFile(file: File | Blob, resourceType: 'image' | 'video' | 'auto' = 'auto', folder: string = 'errands'): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', folder);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Cloudinary upload failed');
      }

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  }

  async uploadImage(file: File, folder: string = 'errands'): Promise<string> {
    return this.uploadFile(file, 'image', folder);
  }
}

export const cloudinaryService = new CloudinaryService();
