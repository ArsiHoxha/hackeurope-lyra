"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, X, Loader2 } from "lucide-react";
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

interface DemoInputCardProps {
  onVerify: (content: string, type: "text" | "file", file?: File) => void;
  isLoading: boolean;
}

export function DemoInputCard({ onVerify, isLoading }: DemoInputCardProps) {
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Verify Watermark</CardTitle>
          <CardDescription>
            Paste AI-generated content or upload a file to check for embedded
            cryptographic watermarks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="text" className="flex-1 gap-2">
                <FileText className="size-4" />
                Text / Code
              </TabsTrigger>
              <TabsTrigger value="file" className="flex-1 gap-2">
                <Upload className="size-4" />
                File Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Paste AI-generated text, code, or content here..."
                  rows={8}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="resize-none font-mono text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {text.length} characters
                </p>
                <Button
                  onClick={() => onVerify(text, "text")}
                  disabled={!text.trim() || isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {isLoading ? "Verifying..." : "Verify Watermark"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label>Upload File</Label>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mb-3 size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Click to upload or drag & drop
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Images, text files, code files (max 10MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".txt,.py,.js,.ts,.jsx,.tsx,.md,.json,.png,.jpg,.jpeg,.webp,.wav"
                  />
                </div>
                {file && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-foreground" />
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={removeFile}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => onVerify(file?.name || "", "file", file ?? undefined)}
                  disabled={!file || isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {isLoading ? "Verifying..." : "Verify Watermark"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
