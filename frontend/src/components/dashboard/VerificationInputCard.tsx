"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VerificationInputCardProps {
  onVerify: (content: string, type: "text" | "file") => void;
  isLoading: boolean;
}

export function VerificationInputCard({
  onVerify,
  isLoading,
}: VerificationInputCardProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card className="border-border/40 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/8">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-[15px]">Verify Watermark</CardTitle>
              <CardDescription className="text-[13px]">
                Paste content or upload a file to check for cryptographic watermarks.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="mb-4 h-9 w-full rounded-lg bg-secondary p-0.5">
              <TabsTrigger
                value="text"
                className="flex-1 gap-1.5 rounded-md text-[13px] data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <FileText className="size-3.5" />
                Text / Code
              </TabsTrigger>
              <TabsTrigger
                value="file"
                className="flex-1 gap-1.5 rounded-md text-[13px] data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Upload className="size-3.5" />
                File Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content" className="text-[13px]">
                  Content
                </Label>
                <Textarea
                  id="content"
                  placeholder="Paste AI-generated text, code, or content here..."
                  rows={7}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="resize-none rounded-xl border-border/50 bg-secondary/50 font-mono text-[13px] transition-colors focus:bg-card"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-muted-foreground">
                  {text.length.toLocaleString()} characters
                </p>
                <Button
                  onClick={() => onVerify(text, "text")}
                  disabled={!text.trim() || isLoading}
                  className="h-9 rounded-lg px-5 text-[13px] font-medium shadow-sm"
                >
                  {isLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  {isLoading ? "Verifying…" : "Verify Watermark"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-3">
                <Label className="text-[13px]">Upload File</Label>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-secondary/30 p-8 transition-all duration-200 hover:border-primary/30 hover:bg-secondary/60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/8 mb-3">
                    <Upload className="size-5 text-primary" />
                  </div>
                  <p className="text-[13px] font-medium">
                    Click to upload or drag & drop
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Images, text files, code files (max 10MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".txt,.py,.js,.ts,.jsx,.tsx,.md,.json,.png,.jpg,.jpeg,.webp"
                  />
                </div>
                {file && (
                  <div className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/8">
                        <FileText className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium">{file.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={removeFile}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => onVerify(file?.name || "", "file")}
                  disabled={!file || isLoading}
                  className="h-9 rounded-lg px-5 text-[13px] font-medium shadow-sm"
                >
                  {isLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  {isLoading ? "Verifying…" : "Verify Watermark"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
