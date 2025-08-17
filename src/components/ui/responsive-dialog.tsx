
"use client"

import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"


interface ResponsiveDialogProps extends React.ComponentProps<typeof Dialog> {
  title?: React.ReactNode
  description?: React.ReactNode
}

export function ResponsiveDialog({
  children,
  title,
  description,
  ...props
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  const [header, content] = React.Children.toArray(children) as [
    React.ReactElement,
    React.ReactElement
  ]

  if (isMobile) {
    return (
      <Sheet {...props}>
        {header}
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
          <SheetHeader className="text-left">
            {title && <SheetTitle>{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="flex flex-col gap-4 py-4">{content}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog {...props}>
      {header}
      <DialogContent>
        <DialogHeader>
          {title && <DialogTitle>{title}</DialogTitle>}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">{content}</div>
      </DialogContent>
    </Dialog>
  )
}

ResponsiveDialog.Trigger = React.forwardRef<
  React.ElementRef<typeof DialogTrigger>,
  React.ComponentProps<typeof DialogTrigger>
>(function ResponsiveDialogTrigger(props, ref) {
  const isMobile = useIsMobile()
  const Trigger = isMobile ? SheetTrigger : DialogTrigger
  return <Trigger {...props} ref={ref} />
})

export { DialogTrigger as ResponsiveDialogTrigger }
