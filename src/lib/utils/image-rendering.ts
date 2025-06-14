import type { ImageInfo } from '@/lib/types/notion';

interface ImageEnhancementResult {
  enhancedHtml: string;
  processedImageCount: number;
}

export function enhanceHtmlWithImageMetadata(
  htmlContent: string, 
  imageMetadata: ImageInfo[] = []
): ImageEnhancementResult {
  if (imageMetadata.length === 0) {
    return {
      enhancedHtml: applyFallbackImageDimensions(htmlContent),
      processedImageCount: 0
    };
  }

  let imageIndex = 0;
  const enhancedHtml = htmlContent.replace(
    /<img([^>]+)>/g,
    (imageTag, attributes) => {
      const currentImageData = imageMetadata[imageIndex];
      imageIndex++;
      
      return currentImageData 
        ? createEnhancedImageTag(attributes, currentImageData)
        : ensureImageHasDimensions(imageTag, attributes);
    }
  );

  return {
    enhancedHtml,
    processedImageCount: imageIndex
  };
}

function createEnhancedImageTag(attributes: string, imageData: ImageInfo): string {
  const aspectRatio = calculateAspectRatio(imageData.width, imageData.height);
  const enhancedStyle = addAspectRatioToStyle(attributes, aspectRatio);
  const blurAttribute = imageData.blurDataURL ? ` data-blur-placeholder="${imageData.blurDataURL}"` : '';
  
  return `<img${enhancedStyle} width="${imageData.width}" height="${imageData.height}"${blurAttribute}>`;
}

function calculateAspectRatio(width: number, height: number): string {
  return (width / height).toFixed(4);
}

function addAspectRatioToStyle(attributes: string, aspectRatio: string): string {
  const aspectRatioStyle = `aspect-ratio: ${aspectRatio};`;
  
  return attributes.includes('style=') 
    ? attributes.replace(/style="([^"]*)"/, `style="$1; ${aspectRatioStyle}"`)
    : `${attributes} style="${aspectRatioStyle}"`;
}

function applyFallbackImageDimensions(htmlContent: string): string {
  const FALLBACK_DIMENSIONS = { width: 1200, height: 900 };
  const FALLBACK_ASPECT_RATIO = calculateAspectRatio(FALLBACK_DIMENSIONS.width, FALLBACK_DIMENSIONS.height);
  
  return htmlContent.replace(
    /<img([^>]+)>/g,
    (imageTag, attributes) => ensureImageHasDimensions(imageTag, attributes, FALLBACK_DIMENSIONS, FALLBACK_ASPECT_RATIO)
  );
}

function ensureImageHasDimensions(
  originalTag: string, 
  attributes: string, 
  fallbackDimensions = { width: 1200, height: 900 },
  fallbackAspectRatio = '1.333'
): string {
  if (originalTag.includes('width=')) {
    return originalTag;
  }
  
  const dimensionAttributes = `width="${fallbackDimensions.width}" height="${fallbackDimensions.height}"`;
  const styleAttribute = `style="aspect-ratio: ${fallbackAspectRatio};"`;
  
  return `<img${attributes} ${dimensionAttributes} ${styleAttribute}>`;
}