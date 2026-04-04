import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeInput } from "@/lib/sanitize";

type SearchableSelectOption = {
  label: string;
  value?: string;
  sublabel?: string;
  itemDescription?: string;
  group?: string;
};

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  options: SearchableSelectOption[];
  disabled?: boolean;
  error?: string;
  allowCustom?: boolean;
  customPlaceholder?: string;
  variant?: "default" | "filter";
  panelSize?: "trigger" | "wide" | "xwide";
  className?: string;
}

const normalizeForSearch = (input: string) => input.toLowerCase().replace(/i̇/g, "i");

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
  variant = "default",
  panelSize = "trigger",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFilterVariant = variant === "filter";

  const getOptionDescription = (option: SearchableSelectOption) => option.itemDescription || option.sublabel || "";
  const getOptionValue = (option: SearchableSelectOption) => sanitizeInput(option.value ?? option.label);

  const filtered = search.trim()
    ? options.filter((option) => {
        const q = normalizeForSearch(search);
        const description = getOptionDescription(option);
        return (
          normalizeForSearch(option.label).includes(q) ||
          (description && normalizeForSearch(description).includes(q))
        );
      })
    : options;

  const grouped = filtered.reduce<Record<string, SearchableSelectOption[]>>((acc, option) => {
    const group = option.group || "";
    if (!acc[group]) acc[group] = [];
    acc[group].push(option);
    return acc;
  }, {});

  const flatFiltered = filtered;
  const selectedOption = options.find((option) => getOptionValue(option) === value) || null;
  const triggerValueLabel = selectedOption?.label || (allowCustom && value ? value : "");

  const closeDropdown = () => {
    setOpen(false);
    setSearch("");
    setHighlightIndex(-1);
  };

  const handleSelectOption = useCallback(
    (option: SearchableSelectOption) => {
      onValueChange(getOptionValue(option));
      closeDropdown();
    },
    [onValueChange]
  );

  const handleSelectCustom = useCallback(() => {
    const customValue = sanitizeInput(search.trim());
    if (!customValue) return;
    onValueChange(customValue);
    closeDropdown();
  }, [onValueChange, search]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === "Enter" || event.key === "ArrowDown" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < flatFiltered.length) {
          handleSelectOption(flatFiltered[highlightIndex]);
        } else if (allowCustom && search.trim()) {
          handleSelectCustom();
        }
        break;
      case "Escape":
        closeDropdown();
        break;
    }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option]");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const groupKeys = Object.keys(grouped);
  const panelWidthClass =
    panelSize === "xwide"
      ? "min-w-full sm:min-w-[34rem] max-w-[calc(100vw-1.5rem)]"
      : panelSize === "wide"
        ? "min-w-full sm:min-w-[28rem] max-w-[calc(100vw-1.5rem)]"
        : "w-full";

  return (
    <div ref={containerRef} className={cn("relative", className)} onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between border py-2 text-sm ring-offset-background transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isFilterVariant
            ? "h-9 rounded-xl border-border/70 bg-muted/35 px-3.5 shadow-sm hover:border-primary/35 hover:bg-muted/60"
            : "h-10 rounded-lg border-input bg-background px-3",
          open && "border-primary/40 ring-2 ring-primary/15",
          error ? "border-destructive" : "",
          triggerValueLabel ? "text-foreground" : "text-muted-foreground"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 flex-1 truncate text-left">{triggerValueLabel || placeholder}</span>
        <ChevronsUpDown className={cn("ml-2 h-4 w-4 shrink-0", isFilterVariant ? "opacity-70" : "opacity-50")} />
      </button>

      {error && <p className="mt-1 text-[10px] text-destructive">{error}</p>}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute left-0 z-50 mt-1 overflow-hidden border bg-popover text-popover-foreground shadow-xl",
              panelWidthClass,
              isFilterVariant ? "rounded-xl border-border/80" : "rounded-lg border-border"
            )}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
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

            <div ref={listRef} className={cn("overflow-y-auto", isFilterVariant ? "max-h-64 p-2" : "max-h-56 p-1.5")} role="listbox">
              {flatFiltered.length === 0 && !allowCustom && (
                <p className="py-4 text-center text-xs text-muted-foreground">Sonuç bulunamadı</p>
              )}

              {flatFiltered.length === 0 && allowCustom && search.trim() && (
                <button
                  type="button"
                  data-option
                  onClick={handleSelectCustom}
                  className={cn(
                    "w-full text-left font-medium text-primary transition-colors",
                    isFilterVariant ? "rounded-lg px-3 py-2.5 text-sm hover:bg-primary/10" : "rounded-md px-3 py-2 text-sm hover:bg-accent/10"
                  )}
                >
                  {customPlaceholder}
                </button>
              )}

              {groupKeys.map((group) => (
                <div key={group}>
                  {group && (
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </div>
                  )}
                  {grouped[group].map((option) => {
                    const globalIndex = flatFiltered.indexOf(option);
                    const optionValue = getOptionValue(option);
                    const isSelected = value === optionValue;
                    const isHighlighted = globalIndex === highlightIndex;
                    const description = getOptionDescription(option);

                    return (
                      <button
                        key={`${optionValue}-${option.label}`}
                        type="button"
                        data-option
                        onClick={() => handleSelectOption(option)}
                        className={cn(
                          "flex w-full items-start justify-between gap-2 text-left transition-colors",
                          isFilterVariant ? "rounded-lg px-3.5 py-3 text-sm" : "rounded-md px-3 py-2 text-sm",
                          isHighlighted && (isFilterVariant ? "bg-muted/85" : "bg-accent/10"),
                          isSelected
                            ? isFilterVariant
                              ? "bg-primary/10 text-primary ring-1 ring-primary/25"
                              : "bg-primary/5 font-medium text-primary"
                            : "text-foreground hover:bg-accent/5"
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="min-w-0">
                          <span
                            className={cn(
                              "block",
                              isFilterVariant ? "whitespace-normal break-words leading-5" : "truncate",
                              isSelected && isFilterVariant ? "font-semibold" : ""
                            )}
                          >
                            {option.label}
                          </span>
                          {description && (
                            <span
                              className={cn(
                                "block text-muted-foreground",
                                isFilterVariant ? "mt-1 whitespace-normal break-words text-xs leading-5" : "truncate text-[10px]"
                              )}
                            >
                              {description}
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
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
