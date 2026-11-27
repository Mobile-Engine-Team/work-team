import { useEffect, useImperativeHandle, type Ref } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer.js";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin.js";
import { ContentEditable } from "@lexical/react/LexicalContentEditable.js";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary.js";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin.js";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin.js";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $isElementNode,
  TextNode,
  type NodeKey,
  type SerializedTextNode,
  type LexicalNode,
} from "lexical";
import { text } from "./client";

type SerializedMention = SerializedTextNode & { target: string; label: string };
class TeamMentionNode extends TextNode {
  __target: string;
  __label: string;
  static getType() {
    return "team-mention";
  }
  static clone(node: TeamMentionNode) {
    return new TeamMentionNode(node.__target, node.__label, node.__key);
  }
  constructor(target: string, label: string, key?: NodeKey) {
    super(`@${label}`, key);
    this.__target = target;
    this.__label = label;
  }
  createDOM() {
    const node = document.createElement("span");
    node.className = "team-mention";
    node.textContent = this.__text;
    return node;
  }
  updateDOM() {
    return false;
  }
  static importJSON(json: SerializedMention) {
    return new TeamMentionNode(json.target, json.label).setMode("token");
  }
  exportJSON(): SerializedMention {
    return {
      ...super.exportJSON(),
      type: "team-mention",
      target: this.__target,
      label: this.__label,
    };
  }
  markdown() {
    return `[@${this.__label.replace(/[\\[\]]/g, "\\$&")}](mention://${this.__target})`;
  }
}
function serialize(node: LexicalNode): string {
  if (node instanceof TeamMentionNode) return node.markdown();
  if ($isElementNode(node))
    return node
      .getChildren()
      .map(serialize)
      .join(node.getType() === "root" ? "\n" : "");
  return node.getTextContent();
}
export interface MentionEditorHandle {
  focus: () => void;
  mention: (id: string, name: string, type: string) => void;
  clear: () => void;
}
function EditorBridge({
  editorRef,
  disabled,
}: {
  editorRef: Ref<MentionEditorHandle>;
  disabled: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);
  useImperativeHandle(
    editorRef,
    () => ({
      focus: () => editor.focus(),
      clear: () => editor.update(() => $getRoot().clear()),
      mention: (id, name, type) => {
        editor.update(() => {
          let selection = $getSelection();
          if (!$isRangeSelection(selection)) selection = $getRoot().selectEnd();
          if (!$isRangeSelection(selection)) return;
          const anchor = selection.anchor.getNode();
          if (
            selection.isCollapsed() &&
            $isTextNode(anchor) &&
            !(anchor instanceof TeamMentionNode)
          ) {
            const prefix = anchor
              .getTextContent()
              .slice(0, selection.anchor.offset);
            const typed = prefix.match(/(?:^|\s)(@[^\s@]*)$/u)?.[1];
            if (typed) selection.anchor.offset -= typed.length;
          }
          selection.insertNodes([
            new TeamMentionNode(`${type}/${id}`, name).setMode("token"),
          ]);
          selection.insertText(" ");
        });
        editor.focus();
      },
    }),
    [editor],
  );
  return null;
}
export function MentionEditor({
  editorRef,
  disabled,
  onChange,
  placeholder = text("commentHint"),
}: {
  editorRef: Ref<MentionEditorHandle>;
  disabled: boolean;
  onChange: (markdown: string) => void;
  placeholder?: string;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: "team-comment",
        nodes: [TeamMentionNode],
        onError: (error) => {
          throw error;
        },
      }}
    >
      <PlainTextPlugin
        contentEditable={
          <ContentEditable
            className="team-comment-editor"
            aria-label={text("comment")}
            aria-multiline="true"
            aria-placeholder={placeholder}
            placeholder={
              <span className="team-editor-placeholder">{placeholder}</span>
            }
          />
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(state) => state.read(() => onChange(serialize($getRoot())))}
      />
      <EditorBridge editorRef={editorRef} disabled={disabled} />
    </LexicalComposer>
  );
}
