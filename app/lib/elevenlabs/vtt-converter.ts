export function convertSRTToVTT(srtContent: string): string {
  const lines = srtContent.split("\n");
  let vtt = "WEBVTT\n\n";
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line && !isNaN(Number(line))) {
      i++;
      if (i < lines.length) {
        const timeLine = lines[i].trim();
        if (timeLine.includes("-->")) {
          const vttTime = timeLine.replace(/,/g, ".");
          i++;
          const textLines: string[] = [];
          while (i < lines.length && lines[i].trim()) {
            textLines.push(lines[i].trim());
            i++;
          }
          if (textLines.length > 0) {
            vtt += `${vttTime}\n${textLines.join("\n")}\n\n`;
          }
        }
      }
    } else {
      i++;
    }
  }
  
  return vtt;
}

export function convertTextToVTT(text: string): string {
  const lines = text.split("\n").filter((line) => line.trim());
  let vtt = "WEBVTT\n\n";
  
  lines.forEach((line, index) => {
    const startTime = formatVTTTime((index * 2) * 1000);
    const endTime = formatVTTTime((index * 2 + 2) * 1000);
    vtt += `${startTime} --> ${endTime}\n${line}\n\n`;
  });
  
  return vtt;
}

function formatVTTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}