import { customAlphabet } from "nanoid";
import type { ContentBlock } from "platform-lib";
import type { IdGenerator, LayoutNode } from "panther";

const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const generateId = customAlphabet(alphabet, 3);

function getAllIdsInLayout(layout: LayoutNode<ContentBlock>): Set<string> {
  const ids = new Set<string>();
  function traverse(node: LayoutNode<ContentBlock>) {
    ids.add(node.id);
    if (node.type !== "item") {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  traverse(layout);
  return ids;
}

export function generateUniqueBlockId(existingLayout?: LayoutNode<ContentBlock>): string {
  const existingIds = existingLayout ? getAllIdsInLayout(existingLayout) : new Set();
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    const id = generateId();
    if (!existingIds.has(id)) return id;
  }
  throw new Error("Failed to generate unique block ID after 20 attempts");
}

export function createIdGeneratorForLayout(existingLayout?: LayoutNode<ContentBlock>): IdGenerator {
  const existingIds = existingLayout ? getAllIdsInLayout(existingLayout) : new Set<string>();
  const generatedIds = new Set<string>();

  return () => {
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      const id = generateId();
      if (!existingIds.has(id) && !generatedIds.has(id)) {
        generatedIds.add(id);
        return id;
      }
    }
    throw new Error("Failed to generate unique block ID after 20 attempts");
  };
}
