import { useState, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { useLang } from "@/lib/lang-context";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  disabled?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
}

export function MarkdownEditor({
  value, onChange, placeholder, className, textareaClassName, disabled, onKeyDown, autoFocus,
}: MarkdownEditorProps) {
  const { t } = useLang();
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <div className={cn("space-y-1", className)}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "write" | "preview")}>
        <TabsList className="h-6 p-0.5">
          <TabsTrigger value="write" className="h-5 px-2 text-[11px]">{t("requests.markdownWrite")}</TabsTrigger>
          <TabsTrigger value="preview" className="h-5 px-2 text-[11px]">{t("requests.markdownPreview")}</TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="mt-1.5">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={textareaClassName}
            disabled={disabled}
            onKeyDown={onKeyDown}
            autoFocus={autoFocus}
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-1.5">
          {value.trim() ? (
            <div className={cn("rounded-md border border-input px-3 py-2 overflow-y-auto", textareaClassName)}>
              <MarkdownContent content={value} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic px-1 py-2">{t("requests.markdownEmptyPreview")}</p>
          )}
        </TabsContent>
      </Tabs>
      <p className="text-[10.5px] text-muted-foreground">{t("requests.markdownHint")}</p>
    </div>
  );
}
