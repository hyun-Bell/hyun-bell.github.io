export function replaceImagesWithPlaceholders(content: string): string {
  let imageIndex = 0;
  return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, () => {
    return `<div class="notion-image-placeholder" data-image-index="${imageIndex++}"></div>`;
  });
}
