/// <reference lib="dom" />

export interface ImageLoadingManager {
  initializeProgressiveImageLoading: () => void;
}

export const createImageLoadingManager = (): ImageLoadingManager => {
  const initializeProgressiveImageLoading = (): void => {
    const blogImages = document.querySelectorAll('.blog-content img');

    if (import.meta.env.DEV) {
      console.log(`[Client] Initializing progressive loading for ${blogImages.length} images`);
    }

    blogImages.forEach((imageElement, imageIndex) => {
      if (!(imageElement instanceof HTMLImageElement)) return;

      applyOptimalAspectRatio(imageElement, imageIndex);
      setupBlurPlaceholder(imageElement, imageIndex);
      attachImageLoadingHandlers(imageElement, imageIndex);
    });
  };

  return { initializeProgressiveImageLoading };
};

function applyOptimalAspectRatio(imageElement: HTMLImageElement, imageIndex: number): void {
  const widthAttribute = imageElement.getAttribute('width');
  const heightAttribute = imageElement.getAttribute('height');

  if (!widthAttribute || !heightAttribute) return;

  const calculatedAspectRatio = calculatePreciseAspectRatio(
    parseFloat(widthAttribute),
    parseFloat(heightAttribute),
  );

  imageElement.style.aspectRatio = calculatedAspectRatio;

  if (import.meta.env.DEV) {
    console.log(
      `[Client] Applied aspect ratio ${calculatedAspectRatio} to image ${imageIndex + 1}`,
    );
  }
}

function setupBlurPlaceholder(imageElement: HTMLImageElement, imageIndex: number): void {
  const blurPlaceholder = imageElement.getAttribute('data-blur-placeholder');

  if (!blurPlaceholder) return;

  imageElement.style.setProperty('--blur-placeholder', `url("${blurPlaceholder}")`);

  if (import.meta.env.DEV) {
    console.log(`[Client] Applied blur placeholder to image ${imageIndex + 1}`);
  }
}

function attachImageLoadingHandlers(imageElement: HTMLImageElement, imageIndex: number): void {
  const blurPlaceholder = imageElement.getAttribute('data-blur-placeholder');

  const handleSuccessfulImageLoad = (): void => {
    markImageAsLoaded(imageElement);
    upgradeToNaturalAspectRatio(imageElement, imageIndex);
    removeBlurPlaceholder(imageElement, blurPlaceholder);
  };

  const handleImageLoadError = (): void => {
    markImageAsLoaded(imageElement);
    removeBlurPlaceholder(imageElement, blurPlaceholder);

    if (import.meta.env.DEV) {
      console.log(`[Client] Image ${imageIndex + 1} failed to load`);
    }
  };

  if (imageElement.complete && imageElement.naturalHeight !== 0) {
    if (import.meta.env.DEV) {
      console.log(`[Client] Image ${imageIndex + 1} already loaded`);
    }
    handleSuccessfulImageLoad();
  } else {
    imageElement.addEventListener('load', handleSuccessfulImageLoad);
    imageElement.addEventListener('error', handleImageLoadError);
  }
}

function markImageAsLoaded(imageElement: HTMLImageElement): void {
  imageElement.setAttribute('data-loaded', 'true');
}

function upgradeToNaturalAspectRatio(imageElement: HTMLImageElement, imageIndex: number): void {
  const hasNaturalDimensions = imageElement.naturalWidth && imageElement.naturalHeight;

  if (!hasNaturalDimensions) return;

  const naturalAspectRatio = calculatePreciseAspectRatio(
    imageElement.naturalWidth,
    imageElement.naturalHeight,
  );

  imageElement.style.aspectRatio = naturalAspectRatio;

  if (import.meta.env.DEV) {
    console.log(
      `[Client] Upgraded to natural aspect ratio ${naturalAspectRatio} for image ${imageIndex + 1}`,
    );
  }
}

function removeBlurPlaceholder(
  imageElement: HTMLImageElement,
  blurPlaceholder: string | null,
): void {
  if (blurPlaceholder) {
    imageElement.style.removeProperty('--blur-placeholder');
  }
}

function calculatePreciseAspectRatio(width: number, height: number): string {
  return (width / height).toFixed(4);
}
