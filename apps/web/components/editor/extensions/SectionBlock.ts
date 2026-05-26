import { Node } from "@tiptap/core";
import type { SectionType } from "@/types/resume";

export interface SectionBlockAttributes {
  sectionId: string;
  sectionType: SectionType;
  visible: boolean;
  displayOrder: number;
}

export const SectionBlockExtension = Node.create({
  name: "sectionBlock",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      sectionId: { default: "" },
      sectionType: { default: "header" },
      visible: { default: true },
      displayOrder: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-section-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-section-block": "", ...HTMLAttributes }];
  },
});
