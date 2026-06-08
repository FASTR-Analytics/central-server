import type { ContentBlock } from "platform-lib";
import type { LayoutNode } from "panther";

export function convertBlockType(
  layout: LayoutNode<ContentBlock>,
  targetId: string,
  newType: "text" | "figure" | "image",
): LayoutNode<ContentBlock> {
  function walk(node: LayoutNode<ContentBlock>): LayoutNode<ContentBlock> {
    if (node.id === targetId && node.type === "item") {
      const current = node.data;
      let newBlock: ContentBlock;
      switch (newType) {
        case "text":
          newBlock = { type: "text", markdown: current.type === "text" ? current.markdown : "" };
          break;
        case "figure":
          newBlock = { type: "figure" };
          break;
        case "image":
          newBlock = { type: "image", imgFile: current.type === "image" ? current.imgFile : "" };
          break;
      }
      return { ...node, data: newBlock };
    }
    if (node.type === "rows" || node.type === "cols") {
      return { ...node, children: node.children.map(walk) };
    }
    return node;
  }
  return walk(layout);
}
