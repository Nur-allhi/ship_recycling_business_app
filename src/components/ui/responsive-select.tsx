
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

type SelectContextValue = {
  value?: string
  onValueChange: (value: string) => void
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext() {
  const context = React.useContext(SelectContext)

  if (!context) {
    throw new Error(
      "useSelectContext must be used within a ResponsiveSelect component"
    )
  }

  return context
}

const ResponsiveSelect = React.forwardRef<
  React.ElementRef<typeof Button>,
  ButtonProps & {
    value?: string
    onValueChange: (value: string) => void
    placeholder?: string
    title?: string
    children: React.ReactNode
  }
>(
  (
    {
      value,
      onValueChange,
      className,
      placeholder,
      children,
      title,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [open, setOpen] = React.useState(false)

    // Using React.Children.toArray to get the text content of the selected item.
    const selectedItem = React.useMemo(() => {
      const childrenArray = React.Children.toArray(children) as React.ReactElement[]
      return childrenArray.find((child) => child.props.value === value)
    }, [children, value])

    const content = (
       <SelectContext.Provider value={{ value, onValueChange, setOpen }}>
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>{children}</CommandGroup>
            </CommandList>
          </Command>
      </SelectContext.Provider>
    )

    return (
      <SelectContext.Provider value={{ value, onValueChange, setOpen }}>
        {isMobile ? (
          <ResponsiveDialog
            open={open}
            onOpenChange={setOpen}
            title={title}
          >
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
                  {selectedItem ? selectedItem.props.children : placeholder}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </ResponsiveDialogTrigger>
            {content}
          </ResponsiveDialog>
        ) : (
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
                  {selectedItem ? selectedItem.props.children : placeholder}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              {content}
            </PopoverContent>
          </Popover>
        )}
      </SelectContext.Provider>
    )
  }
)
ResponsiveSelect.displayName = "ResponsiveSelect"

const ResponsiveSelectItem = React.forwardRef<
  React.ElementRef<typeof CommandItem>,
  React.ComponentProps<typeof CommandItem>
>(({ className, children, onSelect, value, ...props }, ref) => {
  const { value: contextValue, onValueChange, setOpen } = useSelectContext()

  return (
    <CommandItem
      ref={ref}
      onSelect={(currentValue) => {
        onValueChange(currentValue === contextValue ? "" : currentValue)
        setOpen(false)
        onSelect?.(currentValue)
      }}
      value={value}
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      <span className="truncate">{children}</span>
      <Check
        className={cn(
          "h-4 w-4",
          contextValue === value ? "opacity-100" : "opacity-0"
        )}
      />
    </CommandItem>
  )
})
ResponsiveSelectItem.displayName = "ResponsiveSelectItem"

export { ResponsiveSelect, ResponsiveSelectItem }

    