import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeInput } from "@/lib/sanitize";

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  options: { label: string; sublabel?: string; group?: string }[];
  disabled?: boolean;
  error?: string;
  allowCustom?: boolean;
  customPlaceholder?: string;
  className?: string;
}

export default function SearchableSelect({
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = "Ara...",
  options,
  disabled = false,
  error,
  allowCustom = false,
  customPlaceholder = "Listede yoksa yazın...",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? options.filter((o) => {
        const q = search.toLowerCase().replace(/i̇/g, "i");
        return (
          o.label.toLowerCase().replace(/i̇/g, "i").includes(q) ||
          (o.sublabel && o.sublabel.toLowerCase().replace(/i̇/g, "i").includes(q))
        );
      })
    : options;

  // Group options
  const grouped = filtered.reduce<Record<string, typeof options>>((acc, opt) => {
    const group = opt.group || "";
    if (!acc[group]) acc[group] = [];
    acc[group].push(opt);
    return acc;
  }, {});

  const flatFiltered = filtered;

  const handleSelect = useCallback(
    (label: string) => {
      onValueChange(sanitizeInput(label));
      setOpen(false);
      setSearch("");
      setHighlightIndex(-1);
    },
    [onValueChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < flatFiltered.length) {
          handleSelect(flatFiltered[highlightIndex].label);
        } else if (allowCustom && search.trim()) {
          handleSelect(search.trim());
        }
        break;
      case "Escape":
        setOpen(false);
        setSearch("");
        setHighlightIndex(-1);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option]");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
        setHighlightIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const groupKeys = Object.keys(grouped);

  return (
    <div ref={containerRef} className={cn("relative", className)} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-destructive" : "border-input hover:border-primary/40",
          value ? "text-foreground" : "text-muted-foreground"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 flex-1 truncate text-left">{value || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg"
          >
            {/* Search input */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightIndex(-1);
                }}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="off"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setHighlightIndex(-1);
                    inputRef.current?.focus();
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Options list */}
            <div ref={listRef} className="max-h-56 overflow-y-auto p-1" role="listbox">
              {flatFiltered.length === 0 && !allowCustom && (
                <p className="py-4 text-center text-xs text-muted-foreground">Sonuç bulunamadı</p>
              )}

              {flatFiltered.length === 0 && allowCustom && search.trim() && (
                <button
                  type="button"
                  data-option
                  onClick={() => handleSelect(search.trim())}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent/10 text-primary font-medium"
                >
                  "{search.trim()}" olarak ekle
                </button>
              )}

              {groupKeys.map((group) => (
                <div key={group}>
                  {group && (
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {group}
                    </div>
                  )}
                  {grouped[group].map((option) => {
                    const globalIndex = flatFiltered.indexOf(option);
                    const isSelected = value === option.label;
                    const isHighlighted = globalIndex === highlightIndex;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        data-option
                        onClick={() => handleSelect(option.label)}
                        className={cn(
                          "w-full rounded-md px-3 py-2 text-left text-sm flex items-center justify-between transition-colors",
                          isHighlighted && "bg-accent/10",
                          isSelected
                            ? "bg-primary/5 text-primary font-medium"
                            : "hover:bg-accent/5 text-foreground"
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="min-w-0">
                          <span className="block truncate">{option.label}</span>
                          {option.sublabel && (
                            <span className="block text-[10px] text-muted-foreground truncate">
                              {option.sublabel}
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
