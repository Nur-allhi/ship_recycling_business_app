
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
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog"


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
    showSearch?: boolean
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
      showSearch: showSearchProp,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [open, setOpen] = React.useState(false)
    
    const searchDefault = items.length > 8;

    const showSearch = showSearchProp !== undefined ? showSearchProp : searchDefault;
    
    const selectedItem = React.useMemo(() => {
       const item = items.find((item) => item.value === value);
       return item ? item.label : placeholder;
    }, [items, value, placeholder]);


    const handleSelect = (currentValue: string) => {
        onValueChange(currentValue)
        setOpen(false)
        if (onSelect) {
            onSelect(currentValue)
        }
    }
    
    const renderItems = (itemList: SelectItem[]) => {
       return itemList.map((item, index) => (
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
        ));
    }

    const content = (
      <Command>
        {showSearch && <CommandInput placeholder="Search..." />}
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
                {renderItems(items)}
            </CommandGroup>
        </CommandList>
      </Command>
    )

    if (isMobile) {
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn("w-full justify-between", className)}
              ref={ref}
              {...props}
            >
              <span className="truncate">
                {selectedItem}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DialogTrigger>
          <DialogContent className="p-0">
             <DialogHeader className="p-4 pb-0">
               <DialogTitle>{title || "Select an option"}</DialogTitle>
             </DialogHeader>
            <div className="mt-2 border-t">{content}</div>
          </DialogContent>
        </Dialog>
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
              {selectedItem}
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
