export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };
    video.src = URL.createObjectURL(file);
  });
}
