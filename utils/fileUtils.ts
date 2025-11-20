export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const textFileToString = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const compressImageBase64 = (base64: string, maxWidth = 2048, quality = 0.95): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const aspect = img.width / img.height;
            
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                width = maxWidth;
                height = width / aspect;
            }

            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error("Could not get canvas context"));
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };
        img.onerror = (error) => reject(error);
    });
};

export const cropImageBase64 = (base64: string, targetAspect = 3 / 4): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Could not get canvas context"));

            const imgAspect = img.width / img.height;
            let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

            if (imgAspect > targetAspect) { // Image is wider than target
                sWidth = img.height * targetAspect;
                sx = (img.width - sWidth) / 2;
            } else { // Image is taller than target
                sHeight = img.width / targetAspect;
                sy = (img.height - sHeight) / 2;
            }
            
            canvas.width = sWidth;
            canvas.height = sHeight;

            // Optional: Resize if too small for better quality preview
            const minWidth = 512;
            if (canvas.width < minWidth) {
                canvas.height = (minWidth / canvas.width) * canvas.height;
                canvas.width = minWidth;
            }


            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

            resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = (error) => reject(error);
    });
};

export const downloadBase64Image = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};