/**
 * Chart Vector SVG and High-Resolution PNG Export Utility
 * Converts client-rendered SVGs into clean downloadable vector files or 300 DPI PNGs.
 */

export function exportSvgToFile(svgElement: SVGSVGElement | null, filename: string): void {
  if (!svgElement) return;

  try {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);

    // Ensure XML namespace is present
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Failed to export SVG:', e);
  }
}

export function exportSvgToPng(
  svgElement: SVGSVGElement | null,
  filename: string,
  scale: number = 2
): void {
  if (!svgElement) return;

  try {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);

    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const viewBox = svgElement.viewBox.baseVal;
    const width = (viewBox && viewBox.width > 0 ? viewBox.width : svgElement.clientWidth || 800) * scale;
    const height = (viewBox && viewBox.height > 0 ? viewBox.height : svgElement.clientHeight || 450) * scale;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill dark background matching studio aesthetic
    ctx.fillStyle = '#090d16'; // slate-950
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };

    img.src = url;
  } catch (e) {
    console.error('Failed to export PNG:', e);
  }
}
