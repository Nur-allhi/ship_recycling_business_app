
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
import {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog"
import { useIsMobile } from "@/hooks/use-mobile"

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
        <CommandInput placeholder="Search..." />
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
        <ResponsiveDialog open={open} onOpenChange={setOpen} title={title}>
          <ResponsiveDialogTrigger asChild>
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
          </ResponsiveDialogTrigger>
          {content}
        </ResponsiveDialog>
      )
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-[200px] justify-between", className)}
            ref={ref}
            {...props}
          >
            <span className="truncate">
              {selectedItem ? selectedItem.label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          {content}
        </PopoverContent>
      </Popover>
    )
  }
)
ResponsiveSelect.displayName = "ResponsiveSelect"

// Keeping ResponsiveSelectItem for any potential legacy usage, but it is not needed with the new `items` prop structure.
const ResponsiveSelectItem = React.forwardRef<
  React.ElementRef<typeof CommandItem>,
  React.ComponentProps<typeof CommandItem>
>(({ className, children, ...props }, ref) => {
  return (
    <CommandItem
      ref={ref}
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      <span className="truncate">{children}</span>
      <Check
        className={cn(
          "h-4 w-4",
          "opacity-0"
        )}
      />
    </CommandItem>
  )
})
ResponsiveSelectItem.displayName = "ResponsiveSelectItem"


export { ResponsiveSelect, ResponsiveSelectItem }
