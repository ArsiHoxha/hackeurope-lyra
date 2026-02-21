import { Separator } from "@/components/ui/separator";

export function DashboardFooter() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="px-6 py-4">
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} CryptoAI Watermarker. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-[12px] text-muted-foreground transition-colors hover:text-foreground">
              Privacy
            </a>
            <Separator orientation="vertical" className="h-3" />
            <a href="#" className="text-[12px] text-muted-foreground transition-colors hover:text-foreground">
              Terms
            </a>
            <Separator orientation="vertical" className="h-3" />
            <a href="#" className="text-[12px] text-muted-foreground transition-colors hover:text-foreground">
              Docs
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
