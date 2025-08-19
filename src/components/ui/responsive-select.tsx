
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from "./drawer"


interface SelectItem {
  value: string;
  label: React.ReactNode;
}

const ResponsiveSelect = React.forwardRef<
  React.ElementRef<typeof Button>,
  Omit<ButtonProps, 'onSelect'> & {
    value?: string
    onValueChange: (value: string) => void
    placeholder?: string
    title?: string
    items: SelectItem[]
    onSelect?: (value: string) => void
  }
>(
  (
    {
      value,
      onValueChange,
      className,
      placeholder,
      title,
      items,
      onSelect,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [open, setOpen] = React.useState(false)
    const showSearch = items.length > 8;

    const selectedItem = React.useMemo(() => {
      return items.find((item) => item.value === value)
    }, [items, value])

    const handleSelect = (currentValue: string) => {
        onValueChange(currentValue === value ? "" : currentValue)
        setOpen(false)
        if (onSelect) {
            onSelect(currentValue)
        }
    }

    const content = (
      <Command>
        {showSearch && <CommandInput placeholder="Search..." />}
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup>
            {items.map((item, index) => (
                <CommandItem
                    key={`${item.value}-${index}`}
                    value={item.value}
                    onSelect={handleSelect}
                    className="flex items-center justify-between"
                >
                    <span className="truncate">{item.label}</span>
                    <Check
                        className={cn(
                        "h-4 w-4",
                        value === item.value ? "opacity-100" : "opacity-0"
                        )}
                    />
                </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    )

    if (isMobile) {
      return (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn("w-full justify-between", className)}
              ref={ref}
              {...props}
            >
              <span className="truncate">
                {selectedItem ? selectedItem.label : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>{title || "Select an option"}</DrawerTitle>
            </DrawerHeader>
            <div className="mt-4 border-t">{content}</div>
          </DrawerContent>
        </Drawer>
      )
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", className)}
            ref={ref}
            {...props}
          >
            <span className="truncate">
              {selectedItem ? selectedItem.label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          {content}
        </PopoverContent>
      </Popover>
    )
  }
)
ResponsiveSelect.displayName = "ResponsiveSelect"

export { ResponsiveSelect }
