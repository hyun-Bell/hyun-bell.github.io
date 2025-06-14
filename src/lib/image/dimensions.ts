/// <reference lib="dom" />

interface ImageDimensions {
  width: number;
  height: number;
}

const HEADER_CHUNK_SIZE = 4096;
const FETCH_TIMEOUT = 5000;

export async function extractImageDimensionsFromUrl(imageUrl: string): Promise<ImageDimensions> {
  try {
    const headerBytes = await fetchImageHeader(imageUrl);
    const parsedDimensions = extractDimensionsFromImageHeader(headerBytes);
    
    return parsedDimensions || inferDimensionsFromImageUrl(imageUrl);
  } catch (error) {
    console.warn(`Failed to extract dimensions from ${imageUrl}:`, error);
    return inferDimensionsFromImageUrl(imageUrl);
  }
}

async function fetchImageHeader(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { 'Range': `bytes=0-${HEADER_CHUNK_SIZE - 1}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function extractDimensionsFromImageHeader(headerBytes: Uint8Array): ImageDimensions | null {
  const imageTypeHandlers = [
    { matcher: isJpegHeader, parser: extractJpegDimensions },
    { matcher: isPngHeader, parser: extractPngDimensions },
    { matcher: isWebpHeader, parser: extractWebpDimensions },
  ];

  for (const { matcher, parser } of imageTypeHandlers) {
    if (matcher(headerBytes)) {
      return parser(headerBytes);
    }
  }

  return null;
}

const isJpegHeader = (bytes: Uint8Array) => bytes[0] === 0xFF && bytes[1] === 0xD8;
const isPngHeader = (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
const isWebpHeader = (bytes: Uint8Array) => bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;

function extractJpegDimensions(jpegBytes: Uint8Array): ImageDimensions | null {
  const JPEG_HEADER_SIZE = 2;
  const START_OF_FRAME_MARKERS = [0xC0, 0xC1, 0xC2];
  
  let currentOffset = JPEG_HEADER_SIZE;
  
  while (currentOffset < jpegBytes.length - 8) {
    if (jpegBytes[currentOffset] !== 0xFF) {
      currentOffset++;
      continue;
    }
    
    const markerType = jpegBytes[currentOffset + 1];
    
    if (START_OF_FRAME_MARKERS.includes(markerType)) {
      const hasSufficientBytes = currentOffset + 8 < jpegBytes.length;
      if (hasSufficientBytes) {
        const imageHeight = (jpegBytes[currentOffset + 5]! << 8) | jpegBytes[currentOffset + 6]!;
        const imageWidth = (jpegBytes[currentOffset + 7]! << 8) | jpegBytes[currentOffset + 8]!;
        return { width: imageWidth, height: imageHeight };
      }
    }
    
    currentOffset = advanceToNextJpegSegment(jpegBytes, currentOffset);
    if (currentOffset === -1) break;
  }
  
  return null;
}

function advanceToNextJpegSegment(bytes: Uint8Array, currentOffset: number): number {
  const hasSegmentLength = currentOffset + 3 < bytes.length;
  if (!hasSegmentLength) return -1;
  
  const segmentLength = (bytes[currentOffset + 2]! << 8) | bytes[currentOffset + 3]!;
  return currentOffset + 2 + segmentLength;
}

function extractPngDimensions(pngBytes: Uint8Array): ImageDimensions | null {
  const PNG_IHDR_CHUNK_OFFSET = 16;
  const MINIMUM_PNG_HEADER_SIZE = 24;
  
  if (pngBytes.length < MINIMUM_PNG_HEADER_SIZE) return null;
  
  const imageWidth = readBigEndianUint32(pngBytes, PNG_IHDR_CHUNK_OFFSET);
  const imageHeight = readBigEndianUint32(pngBytes, PNG_IHDR_CHUNK_OFFSET + 4);
  
  return { width: imageWidth, height: imageHeight };
}

function readBigEndianUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
}

function extractWebpDimensions(webpBytes: Uint8Array): ImageDimensions | null {
  const MINIMUM_WEBP_HEADER_SIZE = 30;
  const VP8_FORMAT_OFFSET = 12;
  const DIMENSION_OFFSET = 26;
  const DIMENSION_MASK = 0x3fff;
  
  if (webpBytes.length < MINIMUM_WEBP_HEADER_SIZE) return null;
  
  const hasVp8Format = webpBytes[VP8_FORMAT_OFFSET] === 0x56 && 
                      webpBytes[VP8_FORMAT_OFFSET + 1] === 0x50 && 
                      webpBytes[VP8_FORMAT_OFFSET + 2] === 0x38;
  
  if (!hasVp8Format) return null;
  
  const imageWidth = ((webpBytes[DIMENSION_OFFSET]! | (webpBytes[DIMENSION_OFFSET + 1]! << 8)) & DIMENSION_MASK) + 1;
  const imageHeight = ((webpBytes[DIMENSION_OFFSET + 2]! | (webpBytes[DIMENSION_OFFSET + 3]! << 8)) & DIMENSION_MASK) + 1;
  
  return { width: imageWidth, height: imageHeight };
}

function inferDimensionsFromImageUrl(imageUrl: string): ImageDimensions {
  const NOTION_IMAGE_DIMENSIONS = { width: 1200, height: 800 };
  const SCREENSHOT_DIMENSIONS = { width: 1600, height: 900 };
  const DEFAULT_WEB_IMAGE_DIMENSIONS = { width: 1200, height: 900 };
  
  const urlPath = imageUrl.toLowerCase();
  
  if (urlPath.includes('notion')) return NOTION_IMAGE_DIMENSIONS;
  if (urlPath.includes('screenshot') || urlPath.includes('wide')) return SCREENSHOT_DIMENSIONS;
  
  return DEFAULT_WEB_IMAGE_DIMENSIONS;
}

export async function extractMultipleImageDimensions(
  imageUrls: string[], 
  maxConcurrentRequests = 3
): Promise<Map<string, ImageDimensions>> {
  const dimensionsMap = new Map<string, ImageDimensions>();
  const BATCH_DELAY_MS = 100;
  
  const urlBatches = createConcurrentBatches(imageUrls, maxConcurrentRequests);
  
  for (let batchIndex = 0; batchIndex < urlBatches.length; batchIndex++) {
    const currentBatch = urlBatches[batchIndex]!;
    
    const batchResults = await Promise.allSettled(
      currentBatch.map(async (url) => ({
        url,
        dimensions: await extractImageDimensionsFromUrl(url)
      }))
    );
    
    addSuccessfulResultsToMap(batchResults, dimensionsMap);
    
    const isNotLastBatch = batchIndex < urlBatches.length - 1;
    if (isNotLastBatch) {
      await delay(BATCH_DELAY_MS);
    }
  }
  
  return dimensionsMap;
}

function createConcurrentBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

function addSuccessfulResultsToMap(
  batchResults: PromiseSettledResult<{ url: string; dimensions: ImageDimensions }>[], 
  targetMap: Map<string, ImageDimensions>
): void {
  batchResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      targetMap.set(result.value.url, result.value.dimensions);
    }
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}