"use client"

import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SimpleMultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function SimpleMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "选择...",
  className,
}: SimpleMultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onChange(selected.filter((item) => item !== value))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between min-h-10 h-auto ${className}`}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selected.length > 0 ? (
              selected.map((item) => (
                <Badge key={item} variant="secondary" className="gap-1 pr-1 text-xs">
                  <span>{item}</span>
                  <button
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 transition-colors"
                    onClick={(e) => handleRemove(item, e)}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <ScrollArea className="h-[200px]">
          <div className="p-1">
            {options.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">暂无选项</div>
            ) : (
              options.map((option) => (
                <div
                  key={option}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                  onClick={() => handleSelect(option)}
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-sm border transition-colors ${
                      selected.includes(option)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/50"
                    }`}
                  >
                    {selected.includes(option) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="flex-1">{option}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
